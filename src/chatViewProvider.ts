import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import { TuiProcessManager, type RuntimeEvent, type SessionConfig, type SkillEntry, type SkillsListResponse, type UsageData, type WorkspaceStatus } from './tuiProcessManager';
import { BinaryDownloader } from './binaryDownloader';
import { getSecretStore } from './secretStorage';
import { logger } from './logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0;
    private _toolCache = new Map<string, { toolName: string; args: Record<string, unknown> }>();
    private _taskPollTimer: ReturnType<typeof setInterval> | null = null;
    private _binaryDownloader: BinaryDownloader;

    private static readonly TOOL_META: Record<string, { type: string; impact: string }> = {
        exec_shell:              { type: 'Shell 命令',         impact: '高 — 可执行任意系统命令' },
        write_file:              { type: '文件写入',           impact: '中 — 修改文件内容' },
        edit_file:               { type: '文件编辑',           impact: '中 — 修改文件片段' },
        apply_patch:             { type: '补丁应用',           impact: '中 — 批量修改文件' },
        code_execution:          { type: '代码执行',           impact: '高 — 执行 Python 代码' },
        js_execution:            { type: '代码执行',           impact: '高 — 执行 JavaScript 代码' },
        task_shell_start:        { type: '后台 Shell 命令',    impact: '高 — 后台执行系统命令' },
        list_dir:                { type: '目录列表',           impact: '低 — 只读操作' },
        read_file:               { type: '文件读取',           impact: '低 — 只读操作' },
        grep_files:              { type: '内容搜索',           impact: '低 — 只读操作' },
        file_search:             { type: '文件搜索',           impact: '低 — 只读操作' },
        web_search:              { type: '网络搜索',           impact: '低 — 只读操作' },
        fetch_url:               { type: '网络请求',           impact: '中 — 访问外部资源' },
        github_issue_context:    { type: 'GitHub 查询',        impact: '低 — 只读操作' },
        github_pr_context:       { type: 'GitHub 查询',        impact: '低 — 只读操作' },
        checklist_write:         { type: '任务管理',           impact: '低 — 修改内部状态' },
        update_plan:             { type: '计划管理',           impact: '低 — 修改内部状态' },
    };

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {
        this._binaryDownloader = new BinaryDownloader(context);

        this.tuiManager.onEvent((event: RuntimeEvent) => {
            switch (event.event) {
                case 'reasoningStarted':
                    break;
                case 'reasoningDelta':
                    if (event.delta) {
                        this.postMessage({ type: 'tuiReasoning', reasoning: event.delta });
                    }
                    break;
                case 'reasoningDone':
                    this.postMessage({ type: 'tuiReasoningDone' });
                    break;
                case 'messageDelta':
                    if (event.delta) {
                        this.postMessage({ type: 'tuiText', text: event.delta, sessionId: 'http-sse' });
                    }
                    break;
                case 'toolStarted': {
                    let input: Record<string, unknown> = {};
                    try { input = JSON.parse(event.delta || '{}'); } catch { /* keep empty */ }
                    const callId = event.itemId || String(Date.now());
                    const toolName = event.toolName || event.kind || 'tool';
                    this._toolCache.set(callId, { toolName: String(toolName), args: input });
                    logger.info(`[ToolCache] stored id="${callId}" tool=${toolName} args=${JSON.stringify(input).slice(0, 200)}`);
                    const toolCall = { name: toolName, arguments: input, callId };
                    this.postMessage({ type: 'tuiToolCall', toolCall });
                    break;
                }
                case 'toolProgress':
                    if (event.delta) {
                        this.postMessage({
                            type: 'tuiToolProgress',
                            toolResult: { callId: event.itemId || '', output: event.delta, status: 'running' as const },
                        });
                    }
                    break;
                case 'toolCompleted':
                case 'toolFailed': {
                    const callId = event.itemId || '';
                    const toolName = this._toolCache.get(callId)?.toolName || '';
                    const output = event.delta || '';
                    const toolResult = { callId, output, status: (event.event === 'toolFailed' ? 'error' : 'success') as string, toolName };
                    this.postMessage({ type: 'tuiToolResult', toolResult });
                    if (callId) this._toolCache.delete(callId);
                    // 只有 task_create / task_shell_start 等 task 工具才触发任务刷新
                    if (toolName && toolName.includes("task")) {
                        this.pushTasks();
                    }
                    break;
                }
                // Phase 6.3: Sub-agent events
                case 'agentSpawned':
                    this.postMessage({ type: 'agentSpawned', agentId: event.itemId, prompt: event.delta });
                    break;
                case 'agentProgress':
                    this.postMessage({ type: 'agentProgress', agentId: event.itemId, status: event.delta });
                    break;
                case 'agentCompleted':
                    this.postMessage({ type: 'agentCompleted', agentId: event.itemId, result: event.delta });
                    break;

                case 'turnInterrupted':
                    this.postMessage({ type: 'tuiWarning', message: 'Turn interrupted' });
                    break;
                case 'turnCompleted':
                    this.postMessage({ type: 'promptEnded' });
                    this.pushTasks();
                    this.stopTaskPolling();
                    break;
                // Phase 6.1: 新 SSE 事件
                case 'sandboxDenied':
                    this.postMessage({ type: 'tuiWarning', message: `Sandbox denied: ${event.delta || 'unknown operation'}` });
                    break;
                case 'turnStarted':
                    // 记录 turn_id（已在 tuiProcessManager 端处理，这里只做前端通知）
                    if (event.turnId) {
                        this.postMessage({ type: 'turnStarted', turnId: event.turnId });
                    }
                    break;
                case 'itemInterrupted':
                    this.postMessage({ type: 'tuiWarning', message: 'Operation interrupted by process restart' });
                    break;
                case 'tuiCrashed':
                    this.stopTaskPolling();
                    this.postMessage({ type: 'tuiCrashed', message: 'TUI process crashed' });
                    break;
                case 'approvalDecided':
                    this.postMessage({
                        type: 'tuiApprovalDecided',
                        approvalId: event.itemId,
                        decision: event.delta,
                    });
                    break;
                case 'approvalTimeout':
                    this.postMessage({
                        type: 'tuiApprovalTimeout',
                        approvalId: event.itemId,
                    });
                    break;
            }
        });

        this.tuiManager.onStatusChange(({ status }) => {
            this.postMessage({ type: 'tuiStatus', status });
        });

        this.tuiManager.onApprovalRequired((approval) => {
            if (this.tuiManager.autoApprove) {
                logger.info(`[Approval] skipped popup (autoApprove=true) for ${approval.tool_name}`);
                return;
            }
            let cached: { toolName: string; args: Record<string, unknown> } | undefined;
            for (const [, val] of this._toolCache) {
                if (val.toolName === approval.tool_name) {
                    cached = val;
                    break;
                }
            }
            const args = cached?.args || {};
            const meta = ChatViewProvider.TOOL_META[approval.tool_name] || { type: approval.tool_name, impact: '未知' };
            const argSummary = Object.keys(args).length > 0
                ? Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n')
                : '';
            this.postMessage({
                type: 'tuiApprovalRequired',
                approvalId: approval.id,
                toolName: approval.tool_name,
                toolType: meta.type,
                impact: meta.impact,
                description: approval.description,
                params: argSummary,
            });
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        const guiDir = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'gui');
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [guiDir] };
        webviewView.webview.html = this.buildHtml(webviewView.webview, guiDir);
        webviewView.webview.onDidReceiveMessage(msg => this.handleWebviewMessage(msg));
    }

    postMessage(message: unknown): void { this._view?.webview.postMessage(message); }
    newSession(): void { this.postMessage({ type: 'newSession' }); }

    addToChat(uri?: vscode.Uri): void {
        if (uri) {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const rel = wsRoot ? path.relative(wsRoot, uri.fsPath) : uri.fsPath;
            this.postMessage({ type: 'addAtMention', path: rel });
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            this.postMessage({ type: 'addContext', text: editor.document.getText(editor.selection) });
        }
    }

    clearChat(): void { this.postMessage({ type: 'clearChat' }); }

    private async handleWebviewMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'sendPrompt': {
                if (!this.tuiManager.connected) {
                    this.postMessage({ type: 'promptError', error: 'TUI not connected yet.' });
                    return;
                }
                const prompt = String(msg.prompt || '').trim();

                // Phase 6.1: /compact 命令 → REST API 调用
                if (prompt === '/compact') {
                    const currentThreadId = (this.tuiManager as any)._currentThreadId;
                    if (currentThreadId) {
                        const ok = await this.tuiManager.compactThread(currentThreadId);
                        this.postMessage({
                            type: 'tuiText',
                            text: ok
                                ? '✅ Context compaction triggered. The conversation has been compressed.'
                                : '⚠️ Compaction failed. The TUI process may not support this operation.',
                            sessionId: 'http-sse',
                        });
                        this.postMessage({ type: 'promptEnded' });
                    } else {
                        this.postMessage({ type: 'promptError', error: 'No active session to compact.' });
                    }
                    break;
                }

                this.startTaskPolling();
                const mySeq = ++this._promptSeq;
                if (mySeq > 1) this.tuiManager.cancel();
                try {
                    await this.tuiManager.sendPrompt(prompt);
                    if (mySeq !== this._promptSeq) return;
                } catch (err: any) {
                    if (mySeq !== this._promptSeq) return;
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            }
            case 'cancelPrompt':
                this.tuiManager.cancel();
                this.stopTaskPolling();
                this.postMessage({ type: 'promptEnded' });
                break;
            case 'openNewWindow':
                vscode.commands.executeCommand('workbench.action.newWindow');
                break;

            // Phase 4: 审批决策
            case 'approvalDecision':
                if (msg.approvalId && msg.decision) {
                    const result = await this.tuiManager.decideApproval(
                        msg.approvalId,
                        msg.decision,
                        msg.remember === true,
                    );
                    if (!result) {
                        this.postMessage({ type: 'promptError', error: 'Approval decision failed' });
                    }
                }
                break;

            // Phase 5: 设置相关消息
            case 'getSettings': {
                const config = vscode.workspace.getConfiguration('celest');
                const store = getSecretStore();
                const hasKey = !!(await store.getApiKey());
                const apiBase = config.get<string>('apiBase') || 'https://api.deepseek.com';
                
                // Phase 5: 读取 TUI runtime info
                let tuiVersion = '';
                const runtimeInfo = await this.tuiManager.getRuntimeInfo();
                if (runtimeInfo) {
                    tuiVersion = runtimeInfo.version;
                }
                
                this.postMessage({
                    type: 'settingsData',
                    config: {
                        apiBase,
                        defaultModel: config.get<string>('defaultModel') || 'deepseek-v4-flash',
                        autoDownloadBinary: config.get<boolean>('autoDownloadBinary') ?? true,
                        binaryPath: config.get<string>('binaryPath') || '',
                        locale: config.get<string>('locale') || 'zh-CN',
                        provider: config.get<string>('provider') || 'deepseek',
                        reasoningEffort: config.get<string>('reasoningEffort') || 'max',
                    },
                    apiKeyStored: hasKey,
                    tuiVersion,
                    tuiConnected: this.tuiManager.connected,
                    extVersion: '0.1.0',
                    nodeVersion: process.version,
                    vscodeVersion: vscode.version,
                });
                break;
            }

            case 'saveSettings': {
                const config = vscode.workspace.getConfiguration('celest');
                const data = msg.config;
                if (!data) break;
                
                // 保存普通配置
                if (data.apiBase !== undefined) await config.update('apiBase', data.apiBase, true);
                if (data.defaultModel !== undefined) await config.update('defaultModel', data.defaultModel, true);
                if (data.autoDownloadBinary !== undefined) await config.update('autoDownloadBinary', data.autoDownloadBinary, true);
                if (data.binaryPath !== undefined) await config.update('binaryPath', data.binaryPath, true);
                if (data.locale !== undefined) await config.update('locale', data.locale, true);
                if (data.provider !== undefined) {
                    await config.update('provider', data.provider, true);
                    await getSecretStore().setProvider(data.provider);
                }
                if (data.reasoningEffort !== undefined) await config.update('reasoningEffort', data.reasoningEffort, true);
                
                // 保存 API Key 到 SecretStorage
                if (data.apiKey) {
                    await getSecretStore().setApiKey(data.apiKey);
                    // Phase 5: 更新 TUI 配置
                    this.tuiManager.setConfig({ apiKey: data.apiKey, model: data.defaultModel, baseUrl: data.apiBase });
                }
                
                // Phase 5: 更新 TUI 模型配置
                const newModel = data.defaultModel || config.get<string>('defaultModel') || 'deepseek-v4-flash';
                this.tuiManager.setConfig({ model: newModel });
                
                this.postMessage({ type: 'settingsSaved' });
                vscode.window.showInformationMessage('Celest: Settings saved');
                break;
            }

            case 'switchMode': {
                const mode = msg.mode;
                if (!mode) break;
                logger.info(`[Mode] switching to ${mode}`);
                this.tuiManager.setConfig({ mode } as any);
                // yolo 模式自动信任所有工具，agent/plan 恢复审批
                this.tuiManager.autoApprove = mode === 'yolo';
                // 同步更新当前线程
                const currentThreadId = (this.tuiManager as any)._currentThreadId;
                if (currentThreadId) {
                    this.tuiManager.updateThreadConfig(currentThreadId, { mode }).catch(() => {});
                }
                this.postMessage({ type: 'modeSwitched', mode });
                break;
            }
            case 'switchModel': {
                const model = msg.model;
                if (!model) break;
                logger.info(`[Model] switching to ${model}`);
                this.tuiManager.setConfig({ model });
                // 如果当前有活跃 thread，尝试 PATCH
                const currentThreadId = (this.tuiManager as any)._currentThreadId;
                if (currentThreadId) {
                    await this.tuiManager.updateThreadConfig(currentThreadId, { model });
                }
                this.postMessage({ type: 'modelSwitched', model });
                break;
            }

            case 'getRuntimeInfo': {
                const info = await this.tuiManager.getRuntimeInfo();
                this.postMessage({ type: 'runtimeInfo', info });
                break;
            }

            case 'downloadBinary': {
                try {
                    this.postMessage({ type: 'downloadProgress', stage: 'downloading', percent: 0, message: 'Starting download...' });
                    
                    this._binaryDownloader.onProgress(progress => {
                        this.postMessage({ type: 'downloadProgress', ...progress });
                    });
                    
                    const binPath = await this._binaryDownloader.download();
                    this.postMessage({ type: 'downloadComplete', binPath });
                    vscode.window.showInformationMessage(`Celest: Binary downloaded to ${binPath}`);
                } catch (err: any) {
                    this.postMessage({ type: 'downloadFailed', error: err.message });
                    vscode.window.showErrorMessage(`Celest: Download failed — ${err.message}`);
                }
                break;
            }

            case 'browseBinary': {
                const result = await vscode.window.showOpenDialog({
                    title: 'Select deepseek-tui binary',
                    filters: process.platform === 'win32' 
                        ? { 'Executables': ['exe'] } 
                        : { 'All files': ['*'] },
                    canSelectFiles: true,
                    canSelectMany: false,
                });
                if (result && result[0]) {
                    const binPath = result[0].fsPath;
                    await vscode.workspace.getConfiguration('celest').update('binaryPath', binPath, true);
                    this.postMessage({ type: 'binaryPathUpdated', binPath });
                }
                break;
            }

            case 'checkUpdate': {
                const result = await this._binaryDownloader.checkUpdate();
                this.postMessage({ type: 'updateCheckResult', ...result });
                if (result.hasUpdate) {
                    vscode.window.showInformationMessage(`Celest: Update available — v${result.latestVersion}`);
                } else {
                    vscode.window.showInformationMessage(`Celest: No update available.`);
                }
                break;
            }

            // ── 原有消息处理 ──
            case 'newThreadClicked':
                this.newSession();
                break;
            case 'clear':
                this.clearChat();
                break;
            case 'copyToClipboard':
                if (msg.text) vscode.env.clipboard.writeText(msg.text);
                break;
            case 'viewDiff':
                if (msg.filePath && msg.oldContent !== undefined) {
                    this.showDiff(msg.filePath, msg.oldContent, msg.newContent);
                }
                break;
            case 'getFiles': {
                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                this.postMessage({ type: 'fileList', files: this.getWorkspaceFiles(wsRoot) });
                break;
            }
            case 'pasteImage':
                if (msg.filePath) {
                    this.postMessage({ type: 'pasteImageResult', filePath: msg.filePath, fileName: path.basename(msg.filePath) });
                }
                break;
            case 'ready':
                // Phase 5: 读取初始设置配置
                {
                    const cfg = vscode.workspace.getConfiguration('celest');
                    const defaultModel = cfg.get<string>('defaultModel') || 'deepseek-v4-flash';
                    this.tuiManager.setConfig({ model: defaultModel });
                    
                    // 尝试从 SecretStore 获取 API Key
                    try {
                        const apiKey = await getSecretStore().getApiKey();
                        if (apiKey) {
                            this.tuiManager.setConfig({ apiKey });
                            logger.info('[Config] loaded API key from SecretStore');
                        }
                    } catch { /* SecretStore may not be available yet */ }
                    
                    this.postMessage({ type: 'tuiConnected', sessionId: 'http-sse' });
                }
                break;
            case 'getTasks':
                this.pushTasks();
                break;

            // ── Phase 6.1 新增消息 ──

            case 'getSkills': {
                const skills = await this.tuiManager.listSkills();
                this.postMessage({ type: 'skillsList', skills });
                break;
            }

            case 'toggleSkill': {
                if (msg.name && typeof msg.enabled === 'boolean') {
                    const ok = await this.tuiManager.setSkillEnabled(msg.name, msg.enabled);
                    if (ok) {
                        // 刷新列表
                        const skills = await this.tuiManager.listSkills();
                        this.postMessage({ type: 'skillsList', skills });
                    } else {
                        this.postMessage({ type: 'promptError', error: `Failed to toggle skill: ${msg.name}` });
                    }
                }
                break;
            }

            case 'getWorkspaceStatus': {
                const status = await this.tuiManager.getWorkspaceStatus();
                this.postMessage({ type: 'workspaceStatus', status });
                break;
            }

            case 'getMcpStatus': {
                const servers = await this.tuiManager.listMcpServers();
                this.postMessage({ type: 'mcpStatus', servers });
                break;
            }

            case 'getUsage': {
                const groupBy = (msg.group_by || 'day') as 'day' | 'model' | 'provider' | 'thread';
                const usage = await this.tuiManager.getUsage({ group_by: groupBy });
                this.postMessage({ type: 'usageData', usage });
                break;
            }

            case 'compactThread': {
                const threadId = (this.tuiManager as any)._currentThreadId;
                if (threadId) {
                    const ok = await this.tuiManager.compactThread(threadId);
                    this.postMessage({ type: ok ? 'compactSuccess' : 'compactFailed' });
                } else {
                    this.postMessage({ type: 'compactFailed', error: 'No active thread' });
                }
                break;
            }
        }
    }

    // ── 辅助方法 ──

    private async showDiff(filePath: string, oldContent: string, newContent: string): Promise<void> {
        try {
            const oldUri = vscode.Uri.parse(`celest-diff:${filePath}.old`);
            const newUri = vscode.Uri.file(filePath);
            await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, `${filePath} (Changes)`);
        } catch (err: any) {
            logger.error('showDiff failed:', err.message);
        }
    }

    private getWorkspaceFiles(wsRoot: string): { path: string; name: string }[] {
        const results: { path: string; name: string }[] = [];
        if (!wsRoot || !fs.existsSync(wsRoot)) return results;
        try {
            const walk = (dir: string, depth: number) => {
                if (depth > 3) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
                    if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.relative(wsRoot, fullPath).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        walk(fullPath, depth + 1);
                    } else {
                        results.push({ path: relPath, name: entry.name });
                    }
                }
            };
            walk(wsRoot, 0);
        } catch { /* ignore */ }
        return results.slice(0, 200);
    }

    private startTaskPolling(): void {
        if (this._taskPollTimer) return;
        this.pushTasks();
        this._taskPollTimer = setInterval(() => this.pushTasks(), 5000);
    }

    private stopTaskPolling(): void {
        if (this._taskPollTimer) {
            clearInterval(this._taskPollTimer);
            this._taskPollTimer = null;
        }
    }

    private async pushTasks(): Promise<void> {
        try {
            const tasks = await this.tuiManager.listTasks();
            this.postMessage({ type: 'tasksList', tasks });
        } catch (err: any) {
            logger.warn('[Tasks] pushTasks error:', err.message);
        }
    }

    private buildHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        const indexPath = vscode.Uri.joinPath(guiDir, 'index.html');
        let html = fs.readFileSync(indexPath.fsPath, 'utf-8');

        // 替换资源路径为 webview URI
        const guiWebviewUri = webview.asWebviewUri(guiDir);
        html = html.replace(/(src|href)="\.?\/([^"]+)"/g, (_, attr, src) => {
            if (src.startsWith('http')) return `${attr}="${src}"`;
            if (src.startsWith('/')) src = src.slice(1);
            return `${attr}="${webview.asWebviewUri(vscode.Uri.joinPath(guiDir, src))}"`;
        });

        // CSP
        const nonce = 'celest-' + Math.random().toString(36).slice(2);
        html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; img-src ${webview.cspSource} data: https:; font-src ${webview.cspSource}; connect-src https: http:;">`);
        html = html.replace(/<script/g, `<script nonce="${nonce}"`);

        return html;
    }
}
