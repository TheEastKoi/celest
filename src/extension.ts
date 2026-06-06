import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { SessionsTreeProvider } from './sessionsTreeProvider';
import { TuiProcessManager } from './tuiProcessManager';
import { BinaryDownloader } from './binaryDownloader';
import { initSecretStore, getSecretStore } from './secretStorage';
import { logger } from './logger';

// 模块级引用（供 deactivate 使用）
let tuiManager: TuiProcessManager | null = null;

export function activate(context: vscode.ExtensionContext) {
    logger.info('activate() called');

    // ── Phase 5: 初始化 SecretStore ──
    const secretStore = initSecretStore(context);

    // ── TUI 进程管理器 ──
    tuiManager = new TuiProcessManager(context);

    // ── Phase 5: 读取初始配置并设置 ──
    const config = vscode.workspace.getConfiguration('celest');
    const defaultModel = config.get<string>('defaultModel') || 'deepseek-v4-flash';
    const pathSuffix = config.get<string>('pathSuffix') || '';
    tuiManager.setConfig({ model: defaultModel, pathSuffix });

    // 异步加载 API Key
    secretStore.getApiKey().then(apiKey => {
        if (apiKey) {
            tuiManager.setConfig({ apiKey });
            logger.info('[Config] loaded API key from SecretStore');
        }
    }).catch(() => {
        // SecretStore 可能尚未可用
    });

    // ── 会话列表 TreeView ──
    const sessionsProvider = new SessionsTreeProvider(tuiManager);
    const sessionsTree = vscode.window.createTreeView('celest.sessionsList', {
        treeDataProvider: sessionsProvider,
    });
    context.subscriptions.push(sessionsTree);
    // 展开时自动刷新
    sessionsTree.onDidChangeVisibility((e) => {
        if (e.visible) sessionsProvider.refresh();
    });

    // ── WebView 聊天面板 ──
    const chatProvider = new ChatViewProvider(context, tuiManager, () => sessionsProvider.refresh());
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('celest.chatPanel', chatProvider)
    );

    // ── Phase 5: 二进制下载器 ──
    const binaryDownloader = new BinaryDownloader(context);

    // ── 注册命令 ──
    context.subscriptions.push(
        vscode.commands.registerCommand('celest.newSession', () => chatProvider.newSession()),
        vscode.commands.registerCommand('celest.viewHistory', () => chatProvider.postMessage({ type: 'showHistory' })),
        vscode.commands.registerCommand('celest.openSettings', () => {
            // Phase 5: 打开设置面板
            chatProvider.postMessage({ type: 'openSettings' });
        }),
        vscode.commands.registerCommand('celest.focusInput', () => chatProvider.postMessage({ type: 'focusInput' })),
        vscode.commands.registerCommand('celest.resumeSession', (threadId?: string) => {
            if (threadId) chatProvider.resumeSession(threadId);
        }),
        vscode.commands.registerCommand('celest.deleteSession', (item?: vscode.TreeItem) => {
            const id = (item as any)?.id;
            if (id) sessionsProvider.deleteSession(id);
        }),
        vscode.commands.registerCommand('celest.addToChat', (uri?: vscode.Uri) => chatProvider.addToChat(uri)),
        vscode.commands.registerCommand('celest.clearChat', () => chatProvider.clearChat()),
        vscode.commands.registerCommand('celest.applyCode', () => chatProvider.postMessage({ type: 'applyCode' })),
        vscode.commands.registerCommand('celest.acceptDiff', () => chatProvider.postMessage({ type: 'acceptDiff' })),
        vscode.commands.registerCommand('celest.rejectDiff', () => chatProvider.postMessage({ type: 'rejectDiff' })),
        vscode.commands.registerCommand('celest.shareSession', () => chatProvider.postMessage({ type: 'shareSession' })),
        vscode.commands.registerCommand('celest.openInNewWindow', () => vscode.commands.executeCommand('workbench.action.newWindow')),
        // Phase 5: 下载二进制命令
        vscode.commands.registerCommand('celest.downloadBinary', async () => {
            try {
                await binaryDownloader.download();
                vscode.window.showInformationMessage('Celest: Binary downloaded successfully');
            } catch (err: any) {
                vscode.window.showErrorMessage(`Celest: Download failed — ${err.message}`);
            }
        }),
    );

    // ── Phase 5: 监听配置变化 ──
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('celest.defaultModel')) {
                const newModel = vscode.workspace.getConfiguration('celest').get<string>('defaultModel') || 'deepseek-v4-flash';
                tuiManager.setConfig({ model: newModel });
                logger.info('[Config] model changed to:', newModel);
            }
            if (e.affectsConfiguration('celest.locale')) {
                const locale = vscode.workspace.getConfiguration('celest').get<string>('locale') || 'zh-CN';
                chatProvider.postMessage({ type: 'localeChanged', locale });
                logger.info('[Config] locale changed to:', locale);
            }
        }),
    );

    // ── 启动时连接 TUI ──
    // Phase 5: 先检查二进制是否存在，如果不存在且 autoDownload 启用，提示下载
    const autoDownload = config.get<boolean>('autoDownloadBinary') ?? true;
    const binaryPath = config.get<string>('binaryPath') || '';

    const startTui = () => {
        tuiManager.start().catch(async err => {
            logger.error('Failed to start TUI engine:', err.message);
            if (err.message.includes('not found') && autoDownload) {
                const choice = await vscode.window.showInformationMessage(
                    'codewhale-tui binary not found. Download automatically?',
                    'Download Now',
                    'Locate Manually',
                    'Cancel',
                );
                if (choice === 'Download Now') {
                    try {
                        await binaryDownloader.download();
                        await tuiManager.start();
                    } catch (downloadErr: any) {
                        vscode.window.showErrorMessage(`Celest: ${downloadErr.message}`);
                    }
                } else if (choice === 'Locate Manually') {
                    const result = await vscode.window.showOpenDialog({
                        title: 'Select codewhale-tui binary',
                        filters: process.platform === 'win32' ? { 'Executables': ['exe'] } : { 'All files': ['*'] },
                        canSelectFiles: true,
                        canSelectMany: false,
                    });
                    if (result && result[0]) {
                        await config.update('binaryPath', result[0].fsPath, true);
                        try {
                            await tuiManager.start();
                        } catch (retryErr: any) {
                            vscode.window.showErrorMessage(`Celest: ${retryErr.message}`);
                        }
                    }
                }
            } else {
                vscode.window.showErrorMessage(`Celest: Failed to start TUI engine. ${err.message}`);
            }
        });
    };

    startTui();
}

export function deactivate() {
    logger.info('deactivate() called');
    // 清理 TUI 进程（避免留下孤儿进程）
    if (tuiManager) {
        tuiManager.dispose();
        tuiManager = null;
    }
}
