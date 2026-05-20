import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { TuiProcessManager } from './tuiProcessManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {
        this.tuiManager.onEvent(event => {
            if (event.type === 'sessionUpdate') {
                this.postMessage({ type: 'tuiEvent', event: 'sessionUpdate', update: event.update });
            }
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
                try {
                    this.postMessage({ type: 'promptStarted' });
                    await this.tuiManager.sendPrompt(msg.prompt);
                    this.postMessage({ type: 'promptEnded' });
                } catch (err: any) {
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            case 'cancelPrompt':
                await this.tuiManager.cancel();
                break;
            case 'ready':
                console.log('[Celest] GUI ready');
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
