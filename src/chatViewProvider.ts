import * as vscode from 'vscode';
import { TuiProcessManager } from './tuiProcessManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {
        // 监听 TUI 事件，转发到 WebView
        this.tuiManager.onEvent(event => {
            if (event.type === 'sessionUpdate') {
                this.postMessage({
                    type: 'tuiEvent',
                    event: 'sessionUpdate',
                    update: event.update,
                });
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

        webviewView.webview.html = this.getGuiHtml(webviewView.webview, guiDir);

        webviewView.webview.onDidReceiveMessage(msg => this.handleWebviewMessage(msg));
    }

    postMessage(message: unknown): void {
        this._view?.webview.postMessage(message);
    }

    newSession(): void {
        this.postMessage({ type: 'newSession' });
    }

    addSelectionToChat(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            const text = editor.document.getText(editor.selection);
            this.postMessage({ type: 'addContext', text });
        }
    }

    clearChat(): void {
        this.postMessage({ type: 'clearChat' });
    }

    private async handleWebviewMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'sendPrompt':
                try {
                    this.postMessage({ type: 'promptStarted' });
                    await this.tuiManager.sendPrompt(msg.prompt);
                    this.postMessage({ type: 'promptEnded', stopReason: 'end_turn' });
                } catch (err: any) {
                    this.postMessage({ type: 'promptError', error: err.message });
                }
                break;
            case 'cancelPrompt':
                await this.tuiManager.cancel();
                break;
            case 'approvalDecision':
                break;
            case 'ready':
                console.log('[Celest] GUI ready');
                this.postMessage({
                    type: 'tuiConnected',
                    sessionId: this.tuiManager.sessionId || 'connecting',
                });
                break;
        }
    }

    private getGuiHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        const scriptUri = vscode.Uri.joinPath(guiDir, 'assets', 'index.js');
        const cssUri = vscode.Uri.joinPath(guiDir, 'assets', 'index.css');
        const scriptWebviewUri = webview.asWebviewUri(scriptUri);
        const cssWebviewUri = webview.asWebviewUri(cssUri);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
    <link rel="stylesheet" href="${cssWebviewUri}">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);overflow:hidden}
        #app{height:100vh}
    </style>
</head>
<body>
    <div id="app"><div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--vscode-descriptionForeground)">Loading Celest...</div></div>
    <script src="${scriptWebviewUri}"></script>
</body>
</html>`;
    }
}
