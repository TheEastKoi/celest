import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { TuiProcessManager, type RuntimeEvent } from './tuiProcessManager';
import { logger } from './logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0;

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {
        // ── 原生运行时事件 → WebView 消息路由 ──
        this.tuiManager.onEvent((event: RuntimeEvent) => {
            switch (event.event) {
                // ── Reasoning / Thinking ──
                case 'reasoningStarted':
                    logger.info('[SSE→GUI] reasoningStarted');
                    // Thinking 块开始（不发送单独消息，前端在首次 reasoningDelta 时创建）
                    break;

                case 'reasoningDelta':
                    // 真正的 reasoning 流式！逐字推送
                    if (event.delta) {
                        logger.info(`[SSE→GUI] reasoningDelta (${event.delta.length} chars)`);
                        this.postMessage({ type: 'tuiReasoning', reasoning: event.delta });
                    }
                    break;

                case 'reasoningDone':
                    logger.info('[SSE→GUI] reasoningDone');
                    this.postMessage({ type: 'tuiReasoningDone' });
                    break;

                // ── 文本消息 ──
                case 'messageDelta':
                    // agent_message 文本流式输出
                    if (event.delta) {
                        logger.info(`[SSE→GUI] messageDelta (${event.delta.length} chars)`);
                        this.postMessage({ type: 'tuiText', text: event.delta, sessionId: 'http-sse' });
                    }
                    break;

                // ── 工具调用 ──
                case 'toolStarted': {
                    let input: Record<string, unknown> = {};
                    try { input = JSON.parse(event.delta || '{}'); } catch { /* keep empty */ }
                    const toolCall = {
                        name: event.toolName || event.kind || 'tool',
                        arguments: input,
                        callId: event.itemId || String(Date.now()),
                    };
                    logger.info(`[SSE→GUI] toolStarted name=${toolCall.name} id=${toolCall.callId}`);
                    this.postMessage({ type: 'tuiToolCall', toolCall });
                    break;
                }

                case 'toolProgress':
                    // Shell 输出实时流
                    if (event.delta) {
                        this.postMessage({
                            type: 'tuiToolProgress',
                            toolResult: {
                                callId: event.itemId || '',
                                output: event.delta,
                                status: 'running' as const,
                            },
                        });
                    }
                    break;

                case 'toolCompleted':
                case 'toolFailed': {
                    const output = event.delta || '';
                    const toolResult = {
                        callId: event.itemId || '',
                        output,
                        status: (event.event === 'toolFailed' ? 'error' : 'success'),
                    };
                    logger.info(`[SSE→GUI] ${event.event} id=${toolResult.callId} status=${toolResult.status}`);
                    this.postMessage({ type: 'tuiToolResult', toolResult });
                    break;
                }

                // ── 回合控制 ──
                case 'turnCompleted':
                    logger.info('[SSE→GUI] turnCompleted → promptEnded');
                    this.postMessage({ type: 'promptEnded' });
                    break;

                // 崩溃
                case 'tuiCrashed':
                    this.postMessage({ type: 'tuiCrashed', message: 'TUI process crashed' });
                    break;
            }
        });

        // ── 状态变化转发 ──
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

    addSelectionToChat(): void {
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
                    logger.info(`[Thread] sendPrompt start (seq=${mySeq})`);
                    await this.tuiManager.sendPrompt(msg.prompt);
                    if (mySeq !== this._promptSeq) {
                        logger.info(`[Thread] seq=${mySeq} discarded`);
                        return;
                    }
                    logger.info(`[Thread] sendPrompt done (seq=${mySeq})`);
                } catch (err: any) {
                    if (mySeq !== this._promptSeq) return;
                    logger.error(`[Thread] sendPrompt error:`, err.message);
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
            case 'ready':
                logger.info('GUI ready');
                this.postMessage({ type: 'tuiConnected', sessionId: `http://127.0.0.1:${this.tuiManager.port}` });
                break;
        }
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

    private fallbackHtml(): string {
        return `<!DOCTYPE html><html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:var(--vscode-descriptionForeground)">No GUI build found. Run build.mjs first.</div></body></html>`;
    }
}
