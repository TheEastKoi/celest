import * as vscode from 'vscode';
import { TuiProcessManager } from './tuiProcessManager';

/**
 * WebView 聊天面板 Provider。
 * 管理 WebView 生命周期，加载 gui/dist 的 Vue 应用。
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        const guiDir = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'gui');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [guiDir],
        };

        webviewView.webview.html = this.getGuiHtml(webviewView.webview, guiDir);

        webviewView.webview.onDidReceiveMessage(msg => {
            this.handleWebviewMessage(msg);
        });
    }

    /** 向 WebView 发送消息 */
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

    private handleWebviewMessage(msg: any): void {
        switch (msg.type) {
            case 'sendPrompt':
                // Phase 2: 转发到 TUI process
                console.log('[Celest] sendPrompt:', msg.prompt?.slice(0, 50));
                break;
            case 'approvalDecision':
                // Phase 4: 转发审批决定
                break;
            case 'ready':
                console.log('[Celest] GUI ready');
                break;
            default:
                console.warn('[Celest] Unknown WebView message:', msg.type);
        }
    }

    /** 加载 Vue 3 构建产物的 HTML */
    private getGuiHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        // Vite 构建输出: gui/dist/index.html + assets/
        // 构建脚本将其复制到 out/gui/
        const indexPath = vscode.Uri.joinPath(guiDir, 'index.html');
        const scriptUri = vscode.Uri.joinPath(guiDir, 'assets', 'index.js');
        const cssUri = vscode.Uri.joinPath(guiDir, 'assets', 'index.css');

        const scriptWebviewUri = webview.asWebviewUri(scriptUri);
        const cssWebviewUri = webview.asWebviewUri(cssUri);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
    <link rel="stylesheet" href="${cssWebviewUri}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family, -apple-system, sans-serif);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            overflow: hidden;
        }
        #app { height: 100vh; }
    </style>
</head>
<body>
    <div id="app">
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--vscode-descriptionForeground)">
            Loading Celest...
        </div>
    </div>
    <script src="${scriptWebviewUri}"></script>
</body>
</html>`;
    }
}
