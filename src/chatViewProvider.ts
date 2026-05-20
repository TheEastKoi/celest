import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0; // 递增序号，防止并发 prompt 干扰

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {
        // ── session/update 内容分发 ──
        this.tuiManager.onEvent(event => {
            if (event.type === 'sessionUpdate') {
                const update = event.update;
                const content = update.content || {};
                const cType = (content as any).type || '';
                const evtType = update.sessionUpdate || '';

                // 🔍 DEBUG: 完整的 content JSON (前 300 字符)
                logger.info(`[DEBUG] update: type="${cType}" sessionUpdate="${evtType}" content=${JSON.stringify(content).slice(0, 300)}`);

                // ── 路由策略：content.type → sessionUpdate 关键词 → 字段探测 ──

                // 1. 精确 content.type 匹配
                if (cType === 'text' || cType === 'message') {
                    const txt = (content as any).text || (content as any).content || '';
                    logger.info(`[DEBUG] → tuiText (${txt.length} chars)`);
                    this.postMessage({ type: 'tuiText', text: txt, sessionId: update.sessionId });
                } else if (cType === 'reasoning' || cType === 'thinking') {
                    const rsn = (content as any).reasoning || (content as any).thinking || (content as any).text || '';
                    logger.info(`[DEBUG] → tuiReasoning (${rsn.length} chars)`);
                    this.postMessage({ type: 'tuiReasoning', reasoning: rsn, sessionId: update.sessionId });
                } else if (cType === 'tool_use' || cType === 'tool_call') {
                    const tc = (content as any).toolCall || (content as any).tool_use || content;
                    logger.info(`[DEBUG] → tuiToolCall name=${(tc as any)?.name || '?'}`);
                    this.postMessage({ type: 'tuiToolCall', toolCall: tc, sessionId: update.sessionId });
                } else if (cType === 'tool_result') {
                    logger.info(`[DEBUG] → tuiToolResult`);
                    this.postMessage({ type: 'tuiToolResult', toolResult: (content as any).toolResult || content, sessionId: update.sessionId });
                }
                // 2. sessionUpdate 关键词路由（content.type 为空时）
                else if (evtType.includes('thought')) {
                    const rsn = (content as any).reasoning || (content as any).thinking || (content as any).text || '';
                    logger.info(`[DEBUG] → tuiReasoning via sessionUpdate (${rsn.length} chars)`);
                    this.postMessage({ type: 'tuiReasoning', reasoning: rsn, sessionId: update.sessionId });
                } else if (evtType.includes('message') || evtType.includes('chunk')) {
                    const txt = (content as any).text || (content as any).content || '';
                    logger.info(`[DEBUG] → tuiText via sessionUpdate (${txt.length} chars)`);
                    this.postMessage({ type: 'tuiText', text: txt, sessionId: update.sessionId });
                } else if (evtType.includes('tool')) {
                    logger.info(`[DEBUG] → tuiToolCall via sessionUpdate`);
                    this.postMessage({ type: 'tuiToolCall', toolCall: content, sessionId: update.sessionId });
                }
                // 3. 字段探测回退
                else if ((content as any).text !== undefined) {
                    logger.info(`[DEBUG] → tuiText via .text field`);
                    this.postMessage({ type: 'tuiText', text: (content as any).text, sessionId: update.sessionId });
                } else if ((content as any).reasoning !== undefined) {
                    logger.info(`[DEBUG] → tuiReasoning via .reasoning field`);
                    this.postMessage({ type: 'tuiReasoning', reasoning: (content as any).reasoning, sessionId: update.sessionId });
                } else if ((content as any).thinking !== undefined) {
                    logger.info(`[DEBUG] → tuiReasoning via .thinking field`);
                    this.postMessage({ type: 'tuiReasoning', reasoning: (content as any).thinking, sessionId: update.sessionId });
                }
                // 4. 完全未知
                else {
                    logger.info(`[DEBUG] → Unknown, forwarding as tuiEvent`);
                    this.postMessage({ type: 'tuiEvent', event: 'sessionUpdate', update: update });
                }
            } else if (event.type === 'tuiReconnected') {
                this.postMessage({ type: 'tuiConnected', sessionId: event.sessionId });
                logger.info('TUI reconnected, notified GUI');
            } else if (event.type === 'tuiCrashed') {
                this.postMessage({ type: 'tuiCrashed', message: event.message });
                logger.error('TUI crashed, notified GUI');
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

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [guiDir],
        };

        webviewView.webview.html = this.buildHtml(webviewView.webview, guiDir);
        webviewView.webview.onDidReceiveMessage(msg => this.handleWebviewMessage(msg));
    }

    postMessage(message: unknown): void {
        this._view?.webview.postMessage(message);
    }

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
            case 'sendPrompt':
                if (!this.tuiManager.connected) {
                    this.postMessage({ type: 'promptError', error: 'TUI not connected yet. Please wait...' });
                    return;
                }
                // 递增序号，标记当前请求
                const mySeq = ++this._promptSeq;
                // 新请求到达时，先取消前一个（如果还在进行）
                if (mySeq > 1) {
                    this.tuiManager.cancel().catch(() => {});
                }
                try {
                    this.postMessage({ type: 'promptStarted' });
                    logger.info(`[DEBUG] sendPrompt start (seq=${mySeq})`);
                    // 5 分钟超时保护，防止 RPC 永远卡住
                    const result = await Promise.race([
                        this.tuiManager.sendPrompt(msg.prompt),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('sendPrompt timeout (5 min)')), 300_000)
                        ),
                    ]);
                    // 只有最新请求的结果才发送
                    if (mySeq !== this._promptSeq) {
                        logger.info(`[DEBUG] sendPrompt (seq=${mySeq}) discarded, newer request exists`);
                        return;
                    }
                    logger.info(`[DEBUG] sendPrompt end (seq=${mySeq}), stopReason=${result.stopReason}`);
                    // 🔍 检查响应体是否直接包含文本内容
                    const raw = result.raw;
                    if (raw.content) {
                        logger.info(`[DEBUG] sendPrompt has embedded content, forwarding...`);
                        const content = raw.content as Record<string, unknown>;
                        if (typeof content.text === 'string') {
                            this.postMessage({ type: 'tuiTextFull', text: content.text });
                        }
                    }
                    this.postMessage({ type: 'promptEnded' });
                } catch (err: any) {
                    // 只有最新请求的错误才发送
                    if (mySeq !== this._promptSeq) return;
                    logger.error(`[DEBUG] sendPrompt error (seq=${mySeq}):`, err.message);
                    this.postMessage({ type: 'promptEnded' });
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            case 'cancelPrompt':
                // 立即恢复前端状态（不等 TUI 响应，避免死锁）
                this.postMessage({ type: 'promptEnded' });
                // 异步发送 cancel，静默处理失败
                this.tuiManager.cancel().catch(err =>
                    logger.error('cancel failed:', err.message)
                );
                break;
            case 'openNewWindow':
                vscode.commands.executeCommand('workbench.action.newWindow');
                break;
            case 'ready':
                logger.info('GUI ready');
                this.postMessage({ type: 'tuiConnected', sessionId: this.tuiManager.sessionId || 'connecting' });
                break;
        }
    }

    /** 读取 Vite 生成的 index.html，替换路径为 webview URI */
    private buildHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        const indexPath = guiDir.fsPath + '\\index.html';
        if (!fs.existsSync(indexPath)) {
            return this.fallbackHtml();
        }
        let html = fs.readFileSync(indexPath, 'utf-8');

        // 替换相对路径 ./assets/* 为 webview URI
        const assetsDir = vscode.Uri.joinPath(guiDir, 'assets');
        html = html.replace(
            /(src|href)="\.\/assets\/([^"]+)"/g,
            (_match, attr, filename) => {
                const uri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, filename));
                return `${attr}="${uri}"`;
            }
        );

        // 注入 CSP（放在现有 meta 之后）
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; font-src ${webview.cspSource};">`;
        html = html.replace('<head>', '<head>\n' + csp);

        return html;
    }

    private fallbackHtml(): string {
        return `<!DOCTYPE html><html><body>
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:var(--vscode-descriptionForeground)">
                No GUI build found. Run build.mjs first.
            </div>
        </body></html>`;
    }
}
