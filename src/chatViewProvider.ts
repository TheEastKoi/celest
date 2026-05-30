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
    private _lastTasks: any[] = [];
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
        private _onSessionChange?: () => void,
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
                    if (!this.hasActiveTasks()) {
                        this.stopTaskPolling();
                    }
                    this._onSessionChange?.();
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
            if (status === 'connected') {
                this._onSessionChange?.();
            }
        });

        this.tuiManager.onApprovalRequired((approval) => {
            if (this.tuiManager.autoApprove) {
                logger.info(`[Approval] skipped popup (autoApprove=true) for ${approval.tool_name}`);
                return;
            }
            // 低影响/只读工具自动批准（问题3-5：避免卡在审批弹窗）
            const toolMeta = ChatViewProvider.TOOL_META[approval.tool_name];
            if (toolMeta && toolMeta.impact.startsWith('低')) {
                logger.info(`[Approval] auto-allowed low-impact tool: ${approval.tool_name}`);
                this.tuiManager.decideApproval(approval.id, 'allow', false);
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
            const meta = toolMeta || { type: approval.tool_name, impact: '未知' };
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
    async newSession(): Promise<void> {
        // Cancel any active turn
        await this.tuiManager.cancel();
        // Reset current thread so next prompt creates a new one
        (this.tuiManager as any)._currentThreadId = undefined;
        (this.tuiManager as any)._lastEventSeq = 0;
        // Clear chat messages
        this.postMessage({ type: 'clearChat' });
        // Reset panel data
        this.postMessage({ type: 'newSession' });
        // Refresh sessions tree
        this._onSessionChange?.();
    }

    addToChat(uri?: vscode.Uri): void {
        if (uri) {
            // 使用绝对路径，TUI 可直接解析
            this.postMessage({ type: 'addAtMention', path: uri.fsPath });
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            this.postMessage({ type: 'addContext', text: editor.document.getText(editor.selection) });
        }
    }

    clearChat(): void { this.postMessage({ type: 'clearChat' }); }

    /** 恢复历史会话（由 TreeView 命令直接调用，不走 webview 中转） */
    async resumeSession(threadId: string): Promise<void> {
        logger.info(`[Session] resuming thread ${threadId}`);
        // 先中断当前 turn，避免旧 SSE 事件污染
        await this.tuiManager.cancel();
        this.stopTaskPolling();
        const thread = await this.tuiManager.resumeThread(threadId);
        if (!thread) {
            logger.warn(`[Session] resumeThread returned null for ${threadId}`);
            return;
        }
        // 检查工作区匹配
        const currentWs = (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '').replace(/\\/g, '/');
        const threadWs = (thread.workspace || '').replace(/\\/g, '/');
        if (threadWs && threadWs !== currentWs) {
            logger.warn(`[Session] workspace mismatch: thread=${threadWs} current=${currentWs}`);
            this.postMessage({ type: 'promptError', error: `此会话属于工作区 "${thread.workspace}"，与当前工作区不匹配。` });
            return;
        }
        logger.info(`[Session] resumed thread ${threadId}, loading history...`);
        // 清空当前消息
        this.postMessage({ type: 'clearChat' });
        this.postMessage({ type: 'newSession' });
        // 加载历史消息
        const detail = await this.tuiManager.getThreadDetail(threadId);
        if (!detail) {
            logger.warn(`[Session] getThreadDetail returned null for ${threadId}`);
        } else if (!Array.isArray(detail.turns)) {
            logger.warn(`[Session] detail.turns is not an array for ${threadId}`);
        } else {
            logger.info(`[Session] got ${detail.turns.length} turns, ${Array.isArray(detail.items) ? detail.items.length : 0} items`);
            const history: any[] = [];
            const itemMap = new Map<string, any>();
            let lastChecklistOutput: string | null = null;
            let lastPlanOutput: string | null = null;
            if (Array.isArray(detail.items)) {
                for (const item of detail.items) {
                    const it = item as any;
                    if (it.id) itemMap.set(it.id, it);
                    // 收集最后一个 checklist_write 和 update_plan 输出
                    if (it.kind === 'tool_call' && it.detail) {
                        if (it.summary && (it.summary.includes('checklist_write') || it.summary.includes('todo_write'))) {
                            lastChecklistOutput = it.detail;
                        } else if (it.summary && it.summary.includes('update_plan')) {
                            lastPlanOutput = it.detail;
                        }
                    }
                }
            }
            // 恢复 Work 面板
            if (lastChecklistOutput) {
                this.postMessage({ type: 'tuiToolResult', toolResult: { callId: '', output: lastChecklistOutput, status: 'success', toolName: 'checklist_write' } });
            }
            if (lastPlanOutput) {
                this.postMessage({ type: 'tuiToolResult', toolResult: { callId: '', output: lastPlanOutput, status: 'success', toolName: 'update_plan' } });
            }
            for (const turn of detail.turns) {
                const t = turn as any;
                const userText = String(t.input_summary || '');

                // 跳过被中断的 turn，显示提示
                if (t.status === 'interrupted' || t.status === 'canceled') {
                    if (userText) {
                        history.push({ role: 'user', content: userText });
                    }
                    history.push({ role: 'assistant', content: '> ⚠️ 此轮对话被中断' });
                    continue;
                }

                if (userText) {
                    history.push({ role: 'user', content: userText });
                }
                if (Array.isArray(t.item_ids)) {
                    for (const itemId of t.item_ids) {
                        const it = itemMap.get(itemId);
                        if (!it) continue;
                        // 跳过被中断的 item 和非 agent_message 类型（如 reasoning）
                        if (it.status === 'interrupted') continue;
                        if (it.kind === 'agent_message' && it.detail) {
                            history.push({ role: 'assistant', content: String(it.detail) });
                        }
                    }
                }
            }
            if (history.length > 0) {
                logger.info(`[Session] sending ${history.length} history messages`);
                this.postMessage({ type: 'loadHistory', history });
            } else {
                logger.warn(`[Session] no history extracted for ${threadId}`);
            }
        }
        // 恢复 Usage / Context 面板
        const usage = await this.tuiManager.getUsage({ group_by: 'day' });
        if (usage) this.postMessage({ type: 'usageData', usage });
        const ws = await this.tuiManager.getWorkspaceStatus();
        if (ws) this.postMessage({ type: 'workspaceStatus', status: ws });
        this.pushTasks();
        this._onSessionChange?.();
    }

    private async handleWebviewMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'sendPrompt': {
                if (!this.tuiManager.connected) {
                    this.postMessage({ type: 'promptError', error: 'TUI not connected yet.' });
                    return;
                }
                const prompt = String(msg.prompt || '').trim();

                // ── 斜杠命令拦截 ──
                const slashMatch = prompt.match(/^\/(\S+)(?:\s+(.*))?$/);
                if (slashMatch) {
                    try {
                        // 先中断任何进行中的 turn，避免上一轮 SSE 事件污染
                        await this.tuiManager.cancel();
                        this.stopTaskPolling();
                        const result = await Promise.race([
                            this.dispatchSlashCommand(slashMatch[1], slashMatch[2] || ''),
                            new Promise<string>((resolve) => setTimeout(() => resolve('⏱ 命令超时（5秒），请重试。'), 5000)),
                        ]);
                        if (result !== null) {
                            this.postMessage({ type: 'tuiText', text: result, sessionId: 'http-sse' });
                            this.postMessage({ type: 'promptEnded' });
                            break;
                        }
                    } catch (err: any) {
                        this.postMessage({ type: 'tuiText', text: '⚠️ 命令执行失败: ' + (err.message || '未知错误'), sessionId: 'http-sse' });
                        this.postMessage({ type: 'promptEnded' });
                        break;
                    }
                    // result === null → 交由 TUI steer 处理，等待 SSE
                }

                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                let enrichedPrompt = this.enrichPromptWithFiles(prompt, wsRoot);
                // 注入 shell 使用指导：长命令用 background 模式，可被中断
                enrichedPrompt += '\n\n[系统提示: 预计运行超过10秒的shell命令请使用background:true参数，通过exec_shell_wait轮询。前台模式仅用于秒级完成的命令。]';
                this.startTaskPolling();
                const mySeq = ++this._promptSeq;
                if (mySeq > 1) await this.tuiManager.cancel();
                try {
                    await this.tuiManager.sendPrompt(enrichedPrompt);
                    if (mySeq !== this._promptSeq) return;
                    this.postMessage({ type: 'promptEnded' });
                } catch (err: any) {
                    if (mySeq !== this._promptSeq) return;
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            }
            case 'cancelPrompt':
                await this.tuiManager.cancel();
                this.stopTaskPolling();
                this.postMessage({ type: 'tuiText', text: '> ⚠️ 此轮对话被中断', sessionId: 'http-sse' });
                this.postMessage({ type: 'promptEnded' });
                break;
            case 'cancelTool': {
                const callId = String(msg.callId || '');
                await this.cancelCurrentTool(callId);
                break;
            }
            case 'openNewWindow':
                vscode.commands.executeCommand('workbench.action.newWindow');
                break;

            // Phase 4: 审批决策
            case 'approvalDecision':
                if (msg.approvalId && msg.decision) {
                    // 先关闭弹窗，避免卡死
                    this.postMessage({ type: 'tuiApprovalDecided', approvalId: msg.approvalId, decision: msg.decision });
                    const result = await this.tuiManager.decideApproval(
                        msg.approvalId,
                        msg.decision,
                        msg.remember === true,
                    );
                    if (!result) {
                        logger.warn(`[Approval] decision failed for ${msg.approvalId}`);
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
                
                    // OCR 检测
                    let ocrAvailable = false;
                    try { cp.execSync('tesseract --version', { stdio: 'ignore' }); ocrAvailable = true; } catch { }

                    this.postMessage({
                        type: 'settingsData',
                        ocrAvailable,
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
                    extVersion: '0.1.4',
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
                    
                    const binPath = await this._binaryDownloader.download(msg.force === true);
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
            case 'newSession':
                this.newSession();
                break;
            case 'resumeSession':
                if (msg.threadId) {
                    await this.resumeSession(msg.threadId);
                }
                break;
            case 'clearChat':
                this.clearChat();
                break;
            case 'clear':
                this.clearChat();
                break;
            case 'copyToClipboard':
                if (msg.text) vscode.env.clipboard.writeText(msg.text);
                break;
            case 'viewDiff':
                if (msg.filePath) {
                    this.showDiff(msg.filePath, msg.oldContent, msg.newContent);
                }
                break;
            case 'getFiles': {
                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                this.postMessage({ type: 'fileList', files: this.getWorkspaceFiles(wsRoot) });
                break;
            }
            case 'openFile':
                if (msg.path) {
                    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                    const fullPath = path.resolve(wsRoot, msg.path);
                    if (fs.existsSync(fullPath)) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fullPath));
                    } else {
                        vscode.window.showWarningMessage(`File not found: ${msg.path}`);
                    }
                }
                break;
            case 'resolveFiles':
                if (Array.isArray(msg.names) && msg.names.length > 0) {
                    const resolved: Record<string, string> = {};
                    for (const name of msg.names) {
                        const uris = await vscode.workspace.findFiles('**/' + name, null, 1);
                        if (uris.length > 0) resolved[name] = uris[0].fsPath;
                    }
                    this.postMessage({ type: 'filesResolved', paths: resolved });
                }
                break;
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

    /** 斜杠命令分派 */
    private async dispatchSlashCommand(cmd: string, args: string): Promise<string | null> {
        switch (cmd) {
            case 'compact': {
                const tid = (this.tuiManager as any)._currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话，无法压缩。';
                const ok = await this.tuiManager.compactThread(tid);
                return ok ? '✅ 上下文已压缩。' : '⚠️ 压缩失败。';
            }
            case 'sessions': {
                const list = await this.tuiManager.listSessions(50);
                if (list.length === 0) return '📋 没有保存的会话。';
                return '📋 **会话列表** (' + list.length + ')\n\n'
                    + list.map(s => '• `' + s.id.slice(0, 8) + '` — ' + (s.title || '(无标题)') + ' (' + (s.updated_at?.slice(0, 10) || '?') + ')').join('\n');
            }
            case 'skills': {
                const data = await this.tuiManager.listSkills();
                if (!data || data.skills.length === 0) return '🧩 没有已安装的技能。';
                return '🧩 **技能列表** (' + data.skills.length + ')\n\n'
                    + data.skills.map(s => '• **' + s.name + '** — ' + s.description + ' ' + (s.enabled ? '✅' : '⏸')).join('\n');
            }
            case 'mcp': {
                const [rawServers, rawTools] = await Promise.all([this.tuiManager.listMcpServers(), this.tuiManager.listMcpTools()]);
                const servers = Array.isArray(rawServers) ? rawServers : [];
                const tools = Array.isArray(rawTools) ? rawTools : [];
                if (servers.length === 0 && tools.length === 0) return '🔌 没有配置 MCP 服务器。';
                const lines = ['🔌 **MCP 服务器** (' + servers.length + ')'];
                for (const s of servers) lines.push('• ' + ((s as any).name || (s as any).id || '?'));
                lines.push('', '🔧 **MCP 工具** (' + tools.length + ')');
                for (const t of tools.slice(0, 20)) lines.push('• `' + ((t as any).name || (t as any).id) + '`');
                if (tools.length > 20) lines.push('… 还有 ' + (tools.length - 20) + ' 个工具');
                return lines.join('\n');
            }
            case 'tasks': {
                const tasks = await this.tuiManager.listTasks();
                if (tasks.length === 0) return '📌 没有后台任务。';
                return '📌 **后台任务** (' + tasks.length + ')\n\n'
                    + tasks.map((t: any) => '• `' + (t.id || '').slice(0, 8) + '` [' + (t.status || '?') + '] ' + (t.summary || '')).join('\n');
            }
            case 'version': {
                const info = await this.tuiManager.getRuntimeInfo();
                return '🌙 **Celest / CodeWhale TUI**\n版本: ' + (info?.version || '未知');
            }
            case 'models':
                return '🤖 **可用模型**\n\n• `deepseek-v4-flash` (默认，快速)\n• `deepseek-v4-pro` (深度推理)\n\n切换: `/model <名称>`';
            case 'memory': {
                const sub = args.trim();
                const memPath = path.join(os.homedir(), '.deepseek', 'memory.md');
                if (sub === 'clear') {
                    fs.writeFileSync(memPath, '', 'utf-8');
                    return '🧠 记忆已清空。';
                }
                try {
                    const buf = fs.readFileSync(memPath);
                    // 自动检测编码：UTF-8 → GBK 回退（Windows 中文系统 Add-Content 可能用 GBK）
                    let content = new TextDecoder('utf-8', { fatal: false }).decode(buf);
                    if (buf.length > 0 && content.includes('\uFFFD')) {
                        try { content = new TextDecoder('gbk').decode(buf); } catch { /* keep original */ }
                    }
                    if (!content.trim()) return '🧠 记忆为空。在对话中输入 `# 记住：xxx` 添加。';
                    return '🧠 **当前记忆**\n\n```markdown\n' + content.slice(0, 3000) + '\n```';
                } catch {
                    return '🧠 记忆文件不存在。在 `~/.deepseek/config.toml` 中启用 `[memory] enabled = true`。';
                }
            }
            case 'new': {
                await this.newSession();
                return '✅ 已创建新会话。';
            }
            case 'load': {
                const id = args.trim();
                if (!id) return '⚠️ 用法: /load <会话ID>';
                await this.resumeSession(id);
                return null; // resumeSession 自行处理 UI
            }
            case 'rename': {
                const tid = (this.tuiManager as any)._currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话。';
                const name = args.trim();
                if (!name) return '⚠️ 用法: /rename <名称>';
                await this.tuiManager.updateThreadConfig(tid, { title: name });
                this._onSessionChange?.();
                return '✅ 已重命名为 "' + name + '"';
            }
            case 'fork': {
                const tid = (this.tuiManager as any)._currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话。';
                const forked = await this.tuiManager.forkThread(tid);
                return forked ? '✅ 已创建分支会话 `' + forked.id.slice(0, 8) + '`' : '⚠️ Fork 失败。';
            }
            case 'mode': {
                const mode = args.trim();
                if (!mode) return '⚠️ 用法: /mode <agent|plan|yolo>';
                this.tuiManager.setConfig({ mode } as any);
                this.tuiManager.autoApprove = mode === 'yolo';
                const tid = (this.tuiManager as any)._currentThreadId;
                if (tid) await this.tuiManager.updateThreadConfig(tid, { mode }).catch(() => {});
                this.postMessage({ type: 'modeSwitched', mode });
                return '✅ 已切换为 ' + mode + ' 模式';
            }
            case 'model': {
                const model = args.trim();
                if (!model) return '⚠️ 用法: /model <模型名>';
                this.tuiManager.setConfig({ model });
                const tid = (this.tuiManager as any)._currentThreadId;
                if (tid) await this.tuiManager.updateThreadConfig(tid, { model }).catch(() => {});
                this.postMessage({ type: 'modelSwitched', model });
                return '✅ 已切换为 ' + model;
            }
            case 'skill': {
                const name = args.trim();
                if (!name) return '⚠️ 用法: /skill <技能名>';
                const ok = await this.tuiManager.setSkillEnabled(name, true);
                return ok ? '✅ 技能 "' + name + '" 已启用' : '⚠️ 切换技能失败。';
            }
            case 'context': {
                const usage = await this.tuiManager.getUsage({ group_by: 'thread' });
                if (!usage) return '🔍 暂无上下文数据。';
                const t = usage.totals;
                return '🔍 **上下文用量**\n\n• 输入 token: ' + t.input_tokens.toLocaleString()
                    + '\n• 输出 token: ' + t.output_tokens.toLocaleString()
                    + '\n• 缓存 token: ' + t.cached_tokens.toLocaleString()
                    + '\n• 推理 token: ' + t.reasoning_tokens.toLocaleString()
                    + '\n• 总轮次: ' + t.turns
                    + '\n• 预估费用: $' + t.cost_usd.toFixed(4);
            }
            case 'cost': {
                const usage = await this.tuiManager.getUsage({ group_by: 'day' });
                if (!usage) return '💰 暂无费用数据。';
                return '💰 **费用估算**\n\n• 今日费用: $' + usage.totals.cost_usd.toFixed(4)
                    + '\n• 今日 token: ' + usage.totals.input_tokens.toLocaleString() + ' 入 / ' + usage.totals.output_tokens.toLocaleString() + ' 出';
            }
            case 'tokens': {
                const usage = await this.tuiManager.getUsage({ group_by: 'day' });
                if (!usage) return '🔢 暂无 token 数据。';
                const t = usage.totals;
                return '🔢 **Token 统计**\n\n• 总输入: ' + t.input_tokens.toLocaleString()
                    + '\n• 总输出: ' + t.output_tokens.toLocaleString()
                    + '\n• 缓存命中: ' + t.cached_tokens.toLocaleString()
                    + '\n• 推理: ' + t.reasoning_tokens.toLocaleString();
            }
            case 'task': {
                const id = args.trim();
                if (!id) return '⚠️ 用法: /task <任务ID>';
                const task = await this.tuiManager.getTask(id);
                if (!task) return '⚠️ 任务 `' + id + '` 不存在。';
                return '📌 **任务详情**\n\n```json\n' + JSON.stringify(task, null, 2).slice(0, 2000) + '\n```';
            }
            // 未匹配的命令 → 发给 TUI
            default:
                return null;
        }
    }

    /** 取消当前工具执行（通过 interrupt turn，等效于全局 Stop） */
    private async cancelCurrentTool(_callId: string): Promise<void> {
        // TUI 引擎在工具执行期间不处理 steer 消息，
        // 因此唯一能中断 in-flight 工具的方式是 POST /interrupt。
        await this.tuiManager.cancel();
        this.stopTaskPolling();
        this.postMessage({ type: 'tuiText', text: '> ⚠️ 此轮对话被中断', sessionId: 'http-sse' });
        this.postMessage({ type: 'promptEnded' });
    }

    private async showDiff(filePath: string, oldContent?: string, newContent?: string): Promise<void> {
        try {
            const tmpDir = path.join(this.context.globalStorageUri.fsPath, 'diffs');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const baseName = path.basename(filePath);
            const oldFile = path.join(tmpDir, `${baseName}.old`);
            const newFile = path.join(tmpDir, `${baseName}.new`);
            fs.writeFileSync(oldFile, oldContent ?? '', 'utf-8');
            fs.writeFileSync(newFile, newContent ?? '', 'utf-8');
            const oldUri = vscode.Uri.file(oldFile);
            const newUri = vscode.Uri.file(newFile);
            const label = oldContent === undefined && newContent !== undefined
                ? `${baseName} (New File)`
                : `${baseName} (Changes)`;
            await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, label);
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
                        results.push({ path: relPath, name: entry.name, relativePath: fullPath, absolutePath: fullPath });
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
            this._lastTasks = Array.isArray(tasks) ? tasks : [];
            this.postMessage({ type: 'tasksList', tasks });
        } catch (err: any) {
            logger.warn('[Tasks] pushTasks error:', err.message);
        }
    }

    /** 解析 prompt 中的 @[path] 引用，文本文件内容前置，图片提示 AI 读取 */
    private enrichPromptWithFiles(prompt: string, wsRoot: string): string {
        const re = /@\[([^\]]+)\]/g;
        let match;
        const fileContexts: string[] = [];
        const seen = new Set<string>();
        while ((match = re.exec(prompt)) !== null) {
            const filePath = match[1].trim();
            if (seen.has(filePath)) continue;
            seen.add(filePath);
            let fullPath = path.resolve(wsRoot, filePath);
            // 如果路径不存在且只有文件名（无目录分隔符），在工作区内搜索
            if (!fs.existsSync(fullPath) && !filePath.includes('\\') && !filePath.includes('/')) {
                const found = this.findFileByName(wsRoot, filePath);
                if (found) fullPath = found;
            }
            if (!fs.existsSync(fullPath)) continue;
            const ext = filePath.split('.').pop()?.toLowerCase() || '';
            const imageExts = ['png','jpg','jpeg','gif','bmp','svg','ico','webp'];
            if (imageExts.includes(ext)) {
                fileContexts.push(`[图片文件: ${fullPath}]`);
            } else {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const preview = content.slice(0, 3000);
                    fileContexts.push(`[文件: ${fullPath}]\n\`\`\`\n${preview}${content.length > 3000 ? '\n...(truncated)' : ''}\n\`\`\``);
                } catch {
                    fileContexts.push(`[文件: ${fullPath} (binary)]`);
                }
            }
        }
        if (fileContexts.length === 0) return prompt;
        return fileContexts.join('\n\n') + '\n\n---\n用户消息:\n' + prompt;
    }

    /** 在工作区内按文件名搜索（浅层遍历，最大深度 3） */
    private findFileByName(root: string, name: string): string | null {
        logger.info(`[FindFile] searching "${name}" in root: ${root}`);
        const walk = (dir: string, depth: number): string | null => {
            if (depth > 3) return null;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e: any) {
                logger.warn(`[FindFile] readdir failed for ${dir}: ${e.message}`);
                return null;
            }
            for (const e of entries) {
                if (e.name.startsWith('.') && e.name !== '.env') continue;
                if (e.name === 'node_modules' || e.name === '__pycache__') continue;
                const fp = path.join(dir, e.name);
                if (e.isFile() && e.name === name) {
                    logger.info(`[FindFile] found at ${fp}`);
                    return fp;
                }
                if (e.isDirectory()) {
                    const r = walk(fp, depth + 1);
                    if (r) return r;
                }
            }
            return null;
        };
        return walk(root, 0);
    }

    private hasActiveTasks(): boolean {
        return this._lastTasks.some((t: any) =>
            t.status === 'pending' || t.status === 'running'
        );
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
