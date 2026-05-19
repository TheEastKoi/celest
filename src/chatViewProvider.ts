import * as vscode from 'vscode';
import { TuiProcessManager } from './tuiProcessManager';

/**
 * WebView 聊天面板 Provider。
 * 管理 WebView 生命周期，在 Extension Host 和 GUI 之间双向通信。
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'gui', 'dist'),
            ],
        };

        // Phase 0: 显示占位 HTML。Phase 3 替换为 Vite 构建的 React 应用。
        webviewView.webview.html = this.getPlaceholderHtml(webviewView.webview);

        // 接收 WebView 发来的消息
        webviewView.webview.onDidReceiveMessage(msg => {
            this.handleWebviewMessage(msg);
        });
    }

    /** 向 WebView 发送消息 */
    postMessage(message: unknown): void {
        this._view?.webview.postMessage(message);
    }

    /** 新建会话 */
    newSession(): void {
        this.postMessage({ type: 'newSession' });
    }

    /** 把选中代码加入聊天 */
    addSelectionToChat(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            const text = editor.document.getText(editor.selection);
            this.postMessage({ type: 'addContext', text });
        }
    }

    /** 清空聊天 */
    clearChat(): void {
        this.postMessage({ type: 'clearChat' });
    }

    private handleWebviewMessage(msg: any): void {
        console.log('[Celest] WebView → Extension:', msg);
        switch (msg.type) {
            case 'sendPrompt':
                // Phase 2: 转发到 TUI process
                break;
            case 'approvalDecision':
                // Phase 4: 转发审批决定
                break;
            default:
                console.warn('[Celest] Unknown WebView message type:', msg.type);
        }
    }

    /** Phase 0 占位 HTML。Phase 3 替换为 Vite 构建产物。 */
    private getPlaceholderHtml(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0; padding: 20px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 100vh; box-sizing: border-box;
        }
        .logo { font-size: 48px; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
        p { font-size: 13px; color: var(--vscode-descriptionForeground); margin: 0; }
        .shortcut { margin-top: 24px; font-size: 12px; color: var(--vscode-textPreformat-foreground); }
        .shortcut kbd {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px; border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="logo">🌙</div>
    <h1>Celest</h1>
    <p>DeepSeek V4 AI Coding Agent</p>
    <div class="shortcut">
        Start a conversation: <kbd>Ctrl+L</kbd>
    </div>
</body>
</html>`;
    }
}
