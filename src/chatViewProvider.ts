import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import { TuiProcessManager, type RuntimeEvent } from './tuiProcessManager';
import { logger } from './logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0;
    private _toolCache = new Map<string, { toolName: string; args: Record<string, unknown> }>();

    /** Phase 4: 工具元数据映射（类型/影响），TUI SSE 不传这些字段 */
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
                    // task 工具完成后自动刷新 Tasks 面板
                    if (toolName && (toolName.includes("task") || toolName === "checklist_write" || toolName === "update_plan")) {
                        this.pushTasks();
                    }
                    break;
                }
                case 'turnCompleted':
                    this.postMessage({ type: 'promptEnded' });
                this.pushTasks();
                    break;
                case 'tuiCrashed':
                    this.postMessage({ type: 'tuiCrashed', message: 'TUI process crashed' });
                    break;
                // Phase 4: 审批决定后通知前端
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

        // Phase 4: 监听审批请求 → 转发到前端（含缓存的工具参数）
        this.tuiManager.onApprovalRequired((approval) => {
            // 已信任会话 → 不弹窗（TUI 会发 approval.required 但瞬间自动通过）
            if (this.tuiManager.autoApprove) {
                logger.info(`[Approval] skipped popup (autoApprove=true) for ${approval.tool_name}`);
                return;
            }
            // TUI 中 tool_call 的 TurnItem id (item_xxx) ≠ engine call id (call_xxx)
            // 通过工具名匹配缓存的参数（同一 turn 内只有一个待审批工具）
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
                const mySeq = ++this._promptSeq;
                if (mySeq > 1) this.tuiManager.cancel();
                try {
                    await this.tuiManager.sendPrompt(msg.prompt);
                    if (mySeq !== this._promptSeq) return;
                } catch (err: any) {
                    if (mySeq !== this._promptSeq) return;
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            }
            case 'cancelPrompt':
                this.tuiManager.cancel();
                this.postMessage({ type: 'promptEnded' });
                break;
            case 'openNewWindow':
                vscode.commands.executeCommand('workbench.action.newWindow');
                break;
            case 'getFiles': {
                const files = await this.getWorkspaceFiles();
                this.postMessage({ type: 'fileList', files });
                break;
            }
            case 'pasteImage': {
                const filePath = await this.savePastedImage(msg.fileName, msg.data);
                this.postMessage({ type: 'pasteImageResult', fileName: msg.fileName, filePath });
                break;
            }
            case 'ready':
                this.postMessage({ type: 'tuiConnected', sessionId: `http://127.0.0.1:${this.tuiManager.port}` });
                break;
            // Phase 4: 审批决策 → 发送到 TUI
            case 'approvalDecision': {
                const { approvalId, decision, remember } = msg;
                logger.info(`[Approval] user decision: ${decision} remember=${remember} for ${approvalId}`);
                await this.tuiManager.decideApproval(approvalId, decision, remember);
                // 不报错：审批可能已被 TUI 自动处理（超时），用户已关闭弹窗无需二次提示
                break;
            }
            // Phase 4: Diff 预览 — 打开 VS Code diff editor
            case 'viewDiff': {
                await this.openDiffEditor(msg.filePath, msg.oldContent, msg.newContent);
                break;
            }
            case 'getTasks': {
                const tasks = await this.tuiManager.listTasks();
                this.postMessage({ type: 'tasksList', tasks });
                break;
            }
        }
    }

    /** Phase 4: 打开 VS Code diff editor 展示文件变更 */
    private async openDiffEditor(filePath: string, oldContent?: string, newContent?: string): Promise<void> {
        try {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const absPath = path.resolve(wsRoot, filePath);

            // 新内容：读当前文件（或传入的 newContent）
            let newUri: vscode.Uri;
            const currentContent = fs.existsSync(absPath)
                ? fs.readFileSync(absPath, 'utf-8')
                : (newContent || '');
            const tmpDir = path.join(os.tmpdir(), 'celest-diffs');
            fs.mkdirSync(tmpDir, { recursive: true });
            const newTmpPath = path.join(tmpDir, `${path.basename(filePath)}.new`);
            fs.writeFileSync(newTmpPath, (newContent !== undefined ? newContent : currentContent), 'utf-8');
            newUri = vscode.Uri.file(newTmpPath);

            // 旧内容
            let oldUri: vscode.Uri;
            if (oldContent !== undefined) {
                const oldTmpPath = path.join(tmpDir, `${path.basename(filePath)}.old`);
                fs.writeFileSync(oldTmpPath, oldContent, 'utf-8');
                oldUri = vscode.Uri.file(oldTmpPath);
            } else {
                // 尝试 git show HEAD
                const safePath = filePath.replace(/\\/g, '/');
                let gitOld: string | null = null;
                try {
                    gitOld = cp.execFileSync(
                        'git', ['show', `HEAD:${safePath}`],
                        { cwd: wsRoot, encoding: 'utf-8', timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
                    ).toString();
                } catch {
                    // git show 失败 → 检查是否 git 仓库中有此文件
                    try {
                        const gitDiff = cp.execFileSync(
                            'git', ['diff', 'HEAD', '--', safePath],
                            { cwd: wsRoot, encoding: 'utf-8', timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
                        ).toString();
                        if (gitDiff.trim()) {
                            // 文件在 HEAD 中不存在（新文件）→ 旧侧显示空
                            logger.info(`[Diff] ${filePath} not in HEAD, showing as new file`);
                        }
                    } catch {
                        logger.warn(`[Diff] git not available for ${filePath}`);
                    }
                    // 任何 git 失败 → 旧侧显示空（至少用户能看到差异）
                    const emptyTmpPath = path.join(tmpDir, `${path.basename(filePath)}.empty`);
                    fs.writeFileSync(emptyTmpPath, '', 'utf-8');
                    oldUri = vscode.Uri.file(emptyTmpPath);
                }
                if (gitOld !== null) {
                    const oldTmpPath = path.join(tmpDir, `${path.basename(filePath)}.old`);
                    fs.writeFileSync(oldTmpPath, gitOld, 'utf-8');
                    oldUri = vscode.Uri.file(oldTmpPath);
                }
            }

            const title = `${path.basename(filePath)} (Old ↔ New)`;
            await vscode.commands.executeCommand('vscode.diff', oldUri!, newUri, title);
        } catch (err: any) {
            logger.error('[Diff] failed to open diff editor:', err.message);
        }
    }

    /** 自动推送后台任务列表到前端 */
    private pushTasks(): void {
        this.tuiManager.listTasks().then(tasks => {
            if (this._view) this.postMessage({ type: 'tasksList', tasks });
        }).catch(() => {});
    }
    /** 保存粘贴的图片到临时目录，返回路径 */
    private async savePastedImage(fileName: string, base64Data: string): Promise<string> {
        const tmpDir = path.join(os.tmpdir(), 'celest-images');
        fs.mkdirSync(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, fileName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        return wsRoot ? path.relative(wsRoot, filePath) : filePath;
    }

    private buildHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        const indexPath = guiDir.fsPath + '\\index.html';
        if (!fs.existsSync(indexPath)) return this.fallbackHtml();
        let html = fs.readFileSync(indexPath, 'utf-8');
        const assetsDir = vscode.Uri.joinPath(guiDir, 'assets');
        html = html.replace(/(src|href)="\.\/assets\/([^"]+)"/g, (_match, attr, filename) => {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, filename));
            return `${attr}="${uri}"`;
        });
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; font-src ${webview.cspSource};">`;
        html = html.replace('<head>', '<head>\n' + csp);
        return html;
    }

    private async getWorkspaceFiles(): Promise<Array<{name:string; relativePath:string; path:string; isDir:boolean}>> {
        const uris = await vscode.workspace.findFiles(
            '**/*',
            '{**/node_modules/**,**/.git/**,**/target/**,**/dist/**,**/out/**,**/__pycache__/**,**/*.exe,**/*.dll,**/*.so}',
            2000,
        );
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        return uris.map(u => {
            const abs = u.fsPath;
            const rel = wsRoot ? path.relative(wsRoot, abs) : abs;
            return { name: path.basename(abs), relativePath: rel, path: abs, isDir: false };
        });
    }

    private fallbackHtml(): string {
        return `<!DOCTYPE html><html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:var(--vscode-descriptionForeground)">No GUI build found. Run build.mjs first.</div></body></html>`;
    }
}
