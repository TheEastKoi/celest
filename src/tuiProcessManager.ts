import * as vscode from 'vscode';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import { JsonRpcClient } from './jsonRpcClient';
import type { AcpInitializeResult, AcpSessionNewResult, AcpSessionUpdateParams } from './protocol';
import { logger } from './logger';

export class TuiProcessManager {
    private process?: cp.ChildProcess;
    private rpc?: JsonRpcClient;
    private _sessionId?: string;
    private _started = false;
    private _retryCount = 0;
    private _maxRetries = 3;
    private _retryDelay = 2000; // 毫秒
    private _disposed = false;
    private _onEvent = new vscode.EventEmitter<any>();
    readonly onEvent = this._onEvent.event;
    private _onStatusChange = new vscode.EventEmitter<{ status: string }>();
    readonly onStatusChange = this._onStatusChange.event;

    constructor(private context: vscode.ExtensionContext) {}

    get sessionId(): string | undefined { return this._sessionId; }
    get connected(): boolean { return this._started && this.process?.exitCode === null; }

    async start(): Promise<void> {
        this._disposed = false;
        this._retryCount = 0;
        await this.startInternal();
    }

    async sendPrompt(text: string): Promise<{ stopReason: string; raw: Record<string, unknown> }> {
        if (!this._started || !this.rpc || !this._sessionId) {
            throw new Error(this._started ? 'TUI process exited' : 'TUI not yet connected');
        }
        const result = await this.rpc.call('session/prompt', {
            sessionId: this._sessionId,
            prompt: [{ type: 'text', text }],
        }) as Record<string, unknown>;
        // 🔍 完整响应日志（排查文本位置）
        logger.info('[DEBUG] sendPrompt raw response:', JSON.stringify(result).slice(0, 800));
        return {
            stopReason: (result.stopReason as string) || 'unknown',
            raw: result,
        };
    }

    async cancel(): Promise<void> {
        if (!this.rpc || !this._sessionId) return;
        // 10 秒短超时：cancel 不需要等太久，TUI 不响应也强制返回
        await Promise.race([
            this.rpc.call('session/cancel', { sessionId: this._sessionId }),
            new Promise<void>(resolve => setTimeout(() => resolve(), 10_000)),
        ]);
    }

    dispose(): void {
        this._disposed = true;
        this.rpc?.close();
        this.process?.kill();
        this._started = false;
        this._sessionId = undefined;
    }

    /** 内部启动逻辑（含重试） */
    private async startInternal(): Promise<void> {
        const binPath = this.findBinary();
        if (!fs.existsSync(binPath)) {
            throw new Error(`deepseek-tui binary not found: ${binPath}`);
        }
        logger.info('Starting deepseek-tui:', binPath);
        logger.info('cwd:', vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());

        this.process = cp.spawn(binPath, ['serve', '--acp'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
        });

        let stderrLog = '';
        this.process.stderr?.on('data', (d: Buffer) => {
            const text = d.toString();
            stderrLog += text;
            if (text.trim()) {
                logger.info('TUI stderr:', text.trim());
            }
        });

        this.process.on('error', (err) => {
            logger.error('TUI spawn error:', err.message);
        });

        this.process.on('exit', (code, signal) => {
            logger.info('TUI process exited:', code, signal);
            const wasConnected = this._started;
            this._started = false;
            if (stderrLog.trim()) {
                logger.info('TUI stderr log:', stderrLog);
            }
            this._sessionId = undefined;

            // 非主动关闭 → 尝试自动重启
            if (!this._disposed && wasConnected && code !== 0) {
                this.attemptRestart(code, signal);
            }
        });

        this.rpc = new JsonRpcClient(this.process.stdin!, this.process.stdout!);

        // 注册通知
        this.rpc.onNotification((method, params) => {
            // 🔍 记录所有通知
            const paramsPreview = JSON.stringify(params).slice(0, 300);
            logger.info(`[DEBUG] notification: method=${method}, params=${paramsPreview}`);
            if (method === 'session/update') {
                const update = params as AcpSessionUpdateParams;
                const keys = Object.keys(update.content || {});
                logger.info(`[DEBUG] session/update content keys=[${keys.join(',')}]`);
                this._onEvent.fire({ type: 'sessionUpdate', ...update });
            }
        });

        // 握手
        try {
            const initResult = await Promise.race([
                this.rpc.call('initialize', { protocolVersion: 1 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('ACP handshake timeout')), 10000)),
            ]) as AcpInitializeResult;
            logger.info('ACP initialized:', initResult.agentInfo?.name, initResult.agentInfo?.version);
        } catch (err: any) {
            const msg = stderrLog || err.message;
            throw new Error(`Failed to connect to deepseek-tui: ${msg}`);
        }

        // 创建会话
        try {
            const sessionResult = await this.rpc.call('session/new', {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            }) as AcpSessionNewResult;
            this._sessionId = sessionResult.sessionId;
            this._started = true;
            logger.info('Session created:', this._sessionId);
        } catch (err: any) {
            throw new Error(`Failed to create session: ${err.message}`);
        }
    }

    /** 自动重启逻辑（指数退避） */
    private async attemptRestart(exitCode: number | null, signal: NodeJS.Signals | null): Promise<void> {
        if (this._retryCount >= this._maxRetries) {
            logger.error('TUI max retries reached, giving up');
            this._onEvent.fire({ type: 'tuiCrashed', message: 'TUI process crashed and max retries reached' });
            return;
        }

        this._retryCount++;
        const delay = this._retryDelay * Math.pow(2, this._retryCount - 1);
        logger.info(`TUI restart attempt ${this._retryCount}/${this._maxRetries} in ${delay}ms...`);
        this._onStatusChange.fire({ status: 'restarting' });

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await this.startInternal();
            // 重连成功 → 重置计数 + 通知
            this._retryCount = 0;
            logger.info('TUI restarted successfully');
            this._onEvent.fire({ type: 'tuiReconnected', sessionId: this._sessionId });
            this._onStatusChange.fire({ status: 'connected' });
        } catch (err: any) {
            logger.error('TUI restart failed:', err.message);
            // 继续重试（如果还有次数）
            this.attemptRestart(exitCode, signal);
        }
    }

    /** 查找 deepseek-tui 二进制（多路径回退） */
    private findBinary(): string {
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath && fs.existsSync(configPath)) return configPath;

        if (process.platform !== 'win32') return 'deepseek-tui';

        const candidates = [
            path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'release', 'deepseek-tui.exe'),
            path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'debug', 'deepseek-tui.exe'),
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) return c;
        }

        throw new Error(
            'deepseek-tui binary not found. Please set celest.binaryPath in VS Code settings,\n' +
            'or compile DeepSeek-TUI-new with: cd E:\\git_code\\DeepSeek-TUI-new && cargo build --release'
        );
    }
}
