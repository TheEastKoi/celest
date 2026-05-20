import * as vscode from 'vscode';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { logger } from './logger';

/** 原生运行时事件（从 /v1/threads/{id}/events SSE） */
export interface RuntimeEvent {
    event: string;           // "item.delta" | "item.started" | "item.completed" | ...
    kind?: string;           // item kind: "agent_reasoning" | "agent_message" | "tool_call" | ...
    toolName?: string;       // 工具真实名称（如 "web_search", "exec_shell"）
    delta?: string;          // 增量文本
    itemId?: string;
    threadId?: string;
    turnId?: string;
}

/**
 * TUI 进程管理器 — HTTP/SSE Threads 版本
 *
 * 启动 deepseek-tui serve --http，通过 Threads API 发送 prompt，
 * 监听 GET /v1/threads/{id}/events 获取完整事件（含 reasoning）。
 */
export class TuiProcessManager {
    private process?: cp.ChildProcess;
    private _port = 0;
    private _started = false;
    private _retryCount = 0;
    private _maxRetries = 3;
    private _retryDelay = 2000;
    private _disposed = false;
    private _currentAbort?: AbortController;

    private _onEvent = new vscode.EventEmitter<RuntimeEvent>();
    readonly onEvent = this._onEvent.event;
    private _onStatusChange = new vscode.EventEmitter<{ status: string }>();
    readonly onStatusChange = this._onStatusChange.event;

    constructor(private context: vscode.ExtensionContext) {}

    get port(): number { return this._port; }
    get connected(): boolean { return this._started && this.process?.exitCode === null; }

    async start(): Promise<void> {
        this._disposed = false;
        this._retryCount = 0;
        await this.startInternal();
    }

    /** 发送 prompt，通过 Threads API 获取完整事件流 */
    async sendPrompt(text: string): Promise<void> {
        if (!this._started) throw new Error('TUI not yet connected');

        const controller = new AbortController();
        this._currentAbort = controller;
        const base = `http://127.0.0.1:${this._port}/v1`;

        try {
            // 1. 创建 thread
            const tResp = await fetch(`${base}/threads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'deepseek-v4-flash',
                    mode: 'agent',
                    workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.',
                    allow_shell: true,
                    trust_mode: true,
                    auto_approve: true,
                }),
                signal: controller.signal,
            });
            const thread = await tResp.json() as any;
            const threadId: string = thread.id;
            logger.info(`[Thread] created: ${threadId}`);

            // 2. 发送 prompt（不阻塞，立即返回）
            const turnPromise = fetch(`${base}/threads/${threadId}/turns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text }),
                signal: controller.signal,
            }).then(r => r.json() as any);

            // 3. 监听事件流（并行）
            const eventsPromise = this.streamEvents(threadId, controller.signal);

            const [turn] = await Promise.all([turnPromise, eventsPromise]);
            logger.info(`[Thread] turn: ${turn?.id} status=${turn?.status}`);

        } catch (err: any) {
            if (err.name === 'AbortError') {
                logger.info('[Thread] aborted by user');
                return;
            }
            throw err;
        } finally {
            if (this._currentAbort === controller) {
                this._currentAbort = undefined;
            }
        }
    }

    cancel(): void {
        logger.info('[Thread] cancelling');
        this._currentAbort?.abort();
    }

    dispose(): void {
        this._disposed = true;
        this._currentAbort?.abort();
        this.process?.kill();
        this._started = false;
    }

    // ── 内部实现 ────────────────────────────────────────────

    /** 监听 /v1/threads/{id}/events SSE 流，解析原始事件 */
    private async streamEvents(threadId: string, signal: AbortSignal): Promise<void> {
        const url = `http://127.0.0.1:${this._port}/v1/threads/${threadId}/events?since_seq=0`;
        logger.info(`[SSE] connecting to ${url}`);

        const resp = await fetch(url, { signal });
        if (!resp.ok) throw new Error(`SSE connect failed: HTTP ${resp.status}`);
        if (!resp.body) throw new Error('SSE no body');

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        try {
            while (!signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (currentEvent) {
                            this.dispatchRawEvent(currentEvent, data);
                        }
                        currentEvent = '';
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /** 将单个原生事件转换为 RuntimeEvent 并发射 */
    private dispatchRawEvent(eventName: string, data: string): void {
        let payload: any = {};
        try { payload = JSON.parse(data); } catch { return; }

        const p = payload.payload || {};
        const item = p.item || {};
        const kind: string = p.kind || item.kind || '';

        // DEBUG
        const delta = (p.delta || '').slice(0, 40);
        if (delta || kind) {
            logger.info(`[SSE] event=${eventName} kind=${kind} delta="${delta}"`);
        }

        switch (eventName) {
            case 'item.started': {
                if (kind === 'agent_reasoning') {
                    this._onEvent.fire({ event: 'reasoningStarted', kind });
                } else if (kind === 'tool_call' || kind === 'command_execution' || kind === 'file_change') {
                    const tool = p.tool || {};
                    // 从 tool.name 或 tool.detail 获取真实工具名
                    const toolName = tool.name || tool.detail || item.detail || kind;
                    this._onEvent.fire({
                        event: 'toolStarted',
                        kind,
                        toolName: String(toolName),
                        itemId: item.id,
                        delta: JSON.stringify(tool.input || tool.arguments || {}),
                        threadId: payload.thread_id,
                        turnId: payload.turn_id,
                    });
                }
                break;
            }
            case 'item.delta': {
                const d = p.delta || '';
                if (kind === 'agent_reasoning') {
                    // 真正的 reasoning 流式！
                    this._onEvent.fire({ event: 'reasoningDelta', delta: d, kind });
                } else if (kind === 'agent_message') {
                    this._onEvent.fire({ event: 'messageDelta', delta: d, kind });
                } else if (kind === 'tool_call') {
                    this._onEvent.fire({ event: 'toolProgress', delta: d, kind });
                }
                break;
            }
            case 'item.completed':
            case 'item.failed': {
                if (kind === 'agent_reasoning') {
                    this._onEvent.fire({ event: 'reasoningDone', kind });
                } else if (kind === 'agent_message') {
                    // 消息完成（不需要额外操作）
                } else if (kind === 'tool_call' || kind === 'command_execution' || kind === 'file_change') {
                    // item.failed → error, item.completed → success
                    const isSuccess = eventName === 'item.completed';
                    const detail = typeof item.detail === 'string' ? item.detail
                        : (typeof item.summary === 'string' ? item.summary : JSON.stringify(item.detail || item.summary || ''));
                    this._onEvent.fire({
                        event: isSuccess ? 'toolCompleted' : 'toolFailed',
                        kind,
                        itemId: item.id,
                        delta: detail,
                    });
                }
                break;
            }
            case 'turn.completed': {
                this._onEvent.fire({ event: 'turnCompleted' });
                break;
            }
            default:
                break;
        }
    }

    private async startInternal(): Promise<void> {
        const binPath = this.findBinary();
        if (!fs.existsSync(binPath)) {
            throw new Error(`deepseek-tui binary not found: ${binPath}`);
        }

        this._port = await findAvailablePort(7878);
        logger.info(`Starting deepseek-tui HTTP on port ${this._port}:`, binPath);

        this.process = cp.spawn(binPath, [
            'serve', '--http',
            '--port', String(this._port),
            '--host', '127.0.0.1',
            '--insecure',
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
        });

        let stderrLog = '';
        this.process.stderr?.on('data', (d: Buffer) => {
            const text = d.toString();
            stderrLog += text;
            if (text.trim()) logger.info('TUI stderr:', text.trim());
        });
        this.process.stdout?.on('data', (d: Buffer) => {
            logger.info('TUI stdout:', d.toString().trim());
        });

        this.process.on('error', (err) => logger.error('TUI spawn error:', err.message));

        this.process.on('exit', (code, signal) => {
            logger.info('TUI process exited:', code, signal);
            const wasConnected = this._started;
            this._started = false;
            if (stderrLog.trim()) logger.info('TUI stderr log:', stderrLog);
            if (!this._disposed && wasConnected && code !== 0) {
                this.attemptRestart(code, signal);
            }
        });

        await this.waitForReady();
        this._started = true;
        logger.info('TUI HTTP server ready, port:', this._port);
    }

    private async waitForReady(): Promise<void> {
        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
            if (this.process?.exitCode !== null) {
                throw new Error(`TUI process exited with code ${this.process?.exitCode}`);
            }
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 500);
                const resp = await fetch(`http://127.0.0.1:${this._port}/health`, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (resp.ok) return;
            } catch { /* not ready yet */ }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error(`TUI HTTP server did not start within 30s on port ${this._port}`);
    }

    private async attemptRestart(exitCode: number | null, signal: NodeJS.Signals | null): Promise<void> {
        if (this._retryCount >= this._maxRetries) {
            logger.error('TUI max retries reached');
            this._onEvent.fire({ event: 'tuiCrashed' });
            return;
        }
        this._retryCount++;
        const delay = this._retryDelay * Math.pow(2, this._retryCount - 1);
        logger.info(`TUI restart attempt ${this._retryCount}/${this._maxRetries} in ${delay}ms...`);
        this._onStatusChange.fire({ status: 'restarting' });
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
            await this.startInternal();
            this._retryCount = 0;
            logger.info('TUI restarted');
            this._onStatusChange.fire({ status: 'connected' });
        } catch (err: any) {
            logger.error('TUI restart failed:', err.message);
            this.attemptRestart(exitCode, signal);
        }
    }

    private findBinary(): string {
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath && fs.existsSync(configPath)) return configPath;
        if (process.platform !== 'win32') return 'deepseek-tui';
        const candidates = [
            path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'release', 'deepseek-tui.exe'),
            path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'debug', 'deepseek-tui.exe'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error('deepseek-tui binary not found.');
    }
}

async function findAvailablePort(preferred: number): Promise<number> {
    const tryPort = (port: number): Promise<boolean> =>
        new Promise(resolve => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
        });
    for (let port = preferred; port < preferred + 100; port++) {
        if (await tryPort(port)) return port;
    }
    throw new Error('No available port in range 7878-7978');
}
