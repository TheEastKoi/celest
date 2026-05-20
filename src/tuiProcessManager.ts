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
    private _onEvent = new vscode.EventEmitter<any>();
    readonly onEvent = this._onEvent.event;

    constructor(private context: vscode.ExtensionContext) {}

    get sessionId(): string | undefined { return this._sessionId; }

    async start(): Promise<void> {
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

        // 收集 stderr 用于调试
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

        this.process.on('exit', (code) => {
            logger.info('TUI process exited:', code);
            if (stderrLog.trim()) {
                logger.info('TUI stderr log:', stderrLog);
            }
            this._sessionId = undefined;
        });

        this.rpc = new JsonRpcClient(this.process.stdin!, this.process.stdout!);

        // 注册通知
        this.rpc.onNotification((method, params) => {
            if (method === 'session/update') {
                const update = params as AcpSessionUpdateParams;
                this._onEvent.fire({ type: 'sessionUpdate', ...update });
            }
        });

        // 握手超时 10 秒
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
            logger.info('Session created:', this._sessionId);
        } catch (err: any) {
            throw new Error(`Failed to create session: ${err.message}`);
        }
    }

    async sendPrompt(text: string): Promise<string> {
        if (!this.rpc || !this._sessionId) throw new Error('TUI not connected');
        const result = await this.rpc.call('session/prompt', {
            sessionId: this._sessionId,
            prompt: [{ type: 'text', text }],
        }) as { stopReason: string };
        return result.stopReason;
    }

    async cancel(): Promise<void> {
        if (!this.rpc || !this._sessionId) return;
        await this.rpc.call('session/cancel', { sessionId: this._sessionId });
    }

    dispose(): void {
        this.rpc?.close();
        this.process?.kill();
        this._sessionId = undefined;
    }

    /** 查找 deepseek-tui 二进制（多路径回退） */
    private findBinary(): string {
        // 1. 用户配置的路径
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath && fs.existsSync(configPath)) return configPath;

        // 2. PATH 环境变量
        if (process.platform !== 'win32') return 'deepseek-tui';

        // 3. 已知的编译输出路径
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
