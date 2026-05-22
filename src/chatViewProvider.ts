import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { TuiProcessManager, type RuntimeEvent } from './tuiProcessManager';
import { logger } from './logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0;
    private _toolNameMap = new Map<string, string>();

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
                    this._toolNameMap.set(callId, String(toolName));
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
                    const toolName = this._toolNameMap.get(callId) || '';
                    const output = event.delta || '';
                    const toolResult = { callId, output, status: (event.event === 'toolFailed' ? 'error' : 'success') as string, toolName };
                    this.postMessage({ type: 'tuiToolResult', toolResult });
                    if (callId) this._toolNameMap.delete(callId);
                    break;
                }
                case 'turnCompleted':
                    this.postMessage({ type: 'promptEnded' });
                    break;
                case 'tuiCrashed':
                    this.postMessage({ type: 'tuiCrashed', message: 'TUI process crashed' });
                    break;
            }
        });

        this.tuiManager.onStatusChange(({ status }) => {
            this.postMessage({ type: 'tuiStatus', status });
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
        }
    }

    /** 保存粘贴的图片到临时目录，返回路径 */
    private async savePastedImage(fileName: string, base64Data: string): Promise<string> {
        const tmpDir = path.join(os.tmpdir(), 'celest-images');
        fs.mkdirSync(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, fileName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        // 返回相对工作区的路径（如果可能），否则返回绝对路径
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
