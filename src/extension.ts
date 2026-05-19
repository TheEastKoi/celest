import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { SessionsTreeProvider } from './sessionsTreeProvider';
import { TuiProcessManager } from './tuiProcessManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Celest] activate() called');

    // ── TUI 进程管理器 ──
    const tuiManager = new TuiProcessManager(context);

    // ── WebView 聊天面板 ──
    const chatProvider = new ChatViewProvider(context, tuiManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('celest.chatPanel', chatProvider)
    );

    // ── 会话列表 TreeView ──
    const sessionsProvider = new SessionsTreeProvider(tuiManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('celest.sessionsList', sessionsProvider)
    );

    // ── 注册命令 ──
    context.subscriptions.push(
        vscode.commands.registerCommand('celest.newSession', () => {
            chatProvider.newSession();
        }),
        vscode.commands.registerCommand('celest.viewHistory', () => {
            chatProvider.postMessage({ type: 'showHistory' });
        }),
        vscode.commands.registerCommand('celest.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'celest');
        }),
        vscode.commands.registerCommand('celest.focusInput', () => {
            chatProvider.postMessage({ type: 'focusInput' });
        }),
        vscode.commands.registerCommand('celest.addToChat', () => {
            chatProvider.addSelectionToChat();
        }),
        vscode.commands.registerCommand('celest.clearChat', () => {
            chatProvider.clearChat();
        }),
        vscode.commands.registerCommand('celest.applyCode', () => {
            chatProvider.postMessage({ type: 'applyCode' });
        }),
        vscode.commands.registerCommand('celest.acceptDiff', () => {
            chatProvider.postMessage({ type: 'acceptDiff' });
        }),
        vscode.commands.registerCommand('celest.rejectDiff', () => {
            chatProvider.postMessage({ type: 'rejectDiff' });
        }),
        vscode.commands.registerCommand('celest.shareSession', () => {
            chatProvider.postMessage({ type: 'shareSession' });
        }),
        vscode.commands.registerCommand('celest.openInNewWindow', () => {
            vscode.commands.executeCommand('workbench.action.newWindow');
        })
    );

    // ── 启动时连接 TUI ──
    tuiManager.start().catch(err => {
        vscode.window.showErrorMessage(`Celest: Failed to start TUI engine. ${err.message}`);
    });
}

export function deactivate() {
    console.log('[Celest] deactivate() called');
}
