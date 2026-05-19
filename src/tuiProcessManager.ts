import * as vscode from 'vscode';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import { JsonRpcClient } from './jsonRpcClient';
import type { AcpInitializeResult, AcpSessionNewResult, AcpSessionUpdateParams } from './protocol';

/**
 * 管理 deepseek-tui 子进程的生命周期和 ACP 协议通信。
 */
export class TuiProcessManager {
    private process?: cp.ChildProcess;
    private rpc?: JsonRpcClient;
    private _sessionId?: string;
    private _onEvent = new vscode.EventEmitter<any>();
    readonly onEvent = this._onEvent.event;

    constructor(private context: vscode.ExtensionContext) {}

    get sessionId(): string | undefined { return this._sessionId; }

    /** 启动 TUI 进程并握手 */
    async start(): Promise<void> {
        const binPath = await this.findBinary();
        console.log('[Celest] Starting deepseek-tui:', binPath);

        this.process = cp.spawn(binPath, ['serve', '--acp'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
        });

        this.process.stderr?.on('data', (d: Buffer) => {
            console.log('[Celest] TUI stderr:', d.toString().trim());
        });

        this.process.on('exit', (code) => {
            console.log('[Celest] TUI process exited:', code);
            this._sessionId = undefined;
        });

        this.rpc = new JsonRpcClient(this.process.stdin!, this.process.stdout!);

        // 注册通知处理
        this.rpc.onNotification((method, params) => {
            if (method === 'session/update') {
                const update = params as AcpSessionUpdateParams;
                this._onEvent.fire({ type: 'sessionUpdate', ...update });
            }
        });

        // 握手
        const initResult = await this.rpc.call('initialize', { protocolVersion: 1 }) as AcpInitializeResult;
        console.log('[Celest] ACP initialized:', initResult.agent.name, initResult.agent.version);

        // 创建会话
        const sessionResult = await this.rpc.call('session/new', {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        }) as AcpSessionNewResult;
        this._sessionId = sessionResult.sessionId;
        console.log('[Celest] Session created:', this._sessionId);
    }

    /** 发送 prompt，返回最终 stopReason */
    async sendPrompt(text: string): Promise<string> {
        if (!this.rpc || !this._sessionId) throw new Error('TUI not connected');
        const result = await this.rpc.call('session/prompt', {
            sessionId: this._sessionId,
            prompt: [{ type: 'text', text }],
        }) as { stopReason: string };
        return result.stopReason;
    }

    /** 发送 cancel */
    async cancel(): Promise<void> {
        if (!this.rpc || !this._sessionId) return;
        await this.rpc.call('session/cancel', { sessionId: this._sessionId });
    }

    /** 关闭连接并终止进程 */
    dispose(): void {
        this.rpc?.close();
        this.process?.kill();
        this._sessionId = undefined;
    }

    /** 查找 deepseek-tui 二进制 */
    private async findBinary(): Promise<string> {
        // 优先使用用户配置的路径
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath) return configPath;

        // 开发环境：使用已编译的二进制
        const devBin = path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'release', 'deepseek-tui.exe');
        if (process.platform === 'win32') {
            return devBin; // Phase 5: 自动下载 + 多平台
        }
        return 'deepseek-tui'; // Unix: 期望在 PATH 中
    }
}
