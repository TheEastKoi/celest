import * as vscode from 'vscode';

/**
 * 管理 deepseek-tui 子进程的生命周期和 JSON-RPC 通信。
 * Phase 1 实现实际通信，Phase 0 只搭建骨架。
 */
export class TuiProcessManager {
    constructor(private context: vscode.ExtensionContext) {}

    async start(): Promise<void> {
        console.log('[Celest] TuiProcessManager.start() — stub, will spawn deepseek-tui in Phase 1');
        // Phase 1: 检测二进制 → 自动下载 → spawn --stdio → 建立 JSON-RPC
    }

    /** 发送 JSON-RPC 请求（Phase 1 实现） */
    async send(method: string, params?: unknown): Promise<unknown> {
        throw new Error('TUI process not connected. Phase 1 not yet implemented.');
    }

    /** 注册事件监听器（Phase 1 实现） */
    onEvent(handler: (event: unknown) => void): vscode.Disposable {
        return { dispose: () => {} };
    }

    dispose(): void {
        // Phase 1: kill TUI process
    }
}
