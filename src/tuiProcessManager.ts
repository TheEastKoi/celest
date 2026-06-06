import * as vscode from 'vscode';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { logger } from './logger';
import { PROVIDER_ENV_MAP, type ProviderCredentials, getSecretStore } from './secretStorage';

/** Phase 5: 会话配置 */
export interface SessionConfig {
    model: string;
    mode?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    reasoningEffort?: string;
    pathSuffix?: string;
}

/** Phase 5: Runtime info 响应 */
export interface RuntimeInfo {
    bind_host: string;
    port: number;
    auth_required: boolean;
    version: string;
}

/** Phase 4: 审批请求事件 */
export interface ApprovalRequiredEvent {
    id: string;
    tool_name: string;
    description: string;
    threadId: string;
    turnId: string;
}

/** 原生运行时事件（从 /v1/threads/{id}/events SSE） */
export interface RuntimeEvent {
    event: string;
    kind?: string;
    toolName?: string;
    delta?: string;
    itemId?: string;
    threadId?: string;
    turnId?: string;
}

/** listThreads 返回类型 — 匹配 TUI 0.8.40 ThreadRecord */
export interface ThreadSummary {
    id: string;
    title?: string;
    created_at: string;
    updated_at: string;
    model?: string;
    mode?: string;
    workspace?: string;
    latest_turn_id?: string;
    archived?: boolean;
}

// ── Phase 6.1 新增接口 ──

/** Skill 条目 (GET /v1/skills) */
export interface SkillEntry {
    name: string;
    description: string;
    path: string;
    enabled: boolean;
}

/** Skills 列表响应 */
export interface SkillsListResponse {
    directory: string;
    warnings: string[];
    skills: SkillEntry[];
}

/** 工作区状态 (GET /v1/workspace/status) */
export interface WorkspaceStatus {
    workspace: string;
    git_repo: boolean;
    branch: string | null;
    staged: number;
    unstaged: number;
    untracked: number;
    ahead: number | null;
    behind: number | null;
}

/** 用量统计 (GET /v1/usage) */
export interface UsageBucket {
    key: string;
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    reasoning_tokens: number;
    cost_usd: number;
    turns: number;
}

export interface UsageData {
    since: string | null;
    until: string | null;
    group_by: string;
    totals: UsageBucket;
    buckets: UsageBucket[];
}

export interface UsageQuery {
    since?: string;
    until?: string;
    group_by?: 'day' | 'model' | 'provider' | 'thread';
}

// ── Phase 6.2 新增接口 ──

/** 会话元数据 (GET /v1/sessions) */
export interface SessionMetadata {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    total_tokens: number;
    model: string;
    workspace: string;
    mode?: string;
}

export interface SessionsListResponse {
    sessions: SessionMetadata[];
}

/** 会话详情 (GET /v1/sessions/{id}) */
export interface SessionDetail {
    metadata: SessionMetadata;
    messages: unknown[];
    system_prompt: string | null;
}

/** 恢复会话响应 (POST /v1/sessions/{id}/resume-thread) */
export interface ResumeSessionResult {
    thread_id: string;
    session_id: string;
    message_count: number;
    summary: string;
}

/** 线程详情 (GET /v1/threads/{id}) */
export interface ThreadDetail {
    thread: ThreadSummary;
    turns: unknown[];
    items: unknown[];
    latest_seq: number;
}

/** 创建任务请求 (POST /v1/tasks) */
export interface NewTaskRequest {
    prompt: string;
    model?: string;
    workspace?: string;
    mode?: string;
    allow_shell?: boolean;
    trust_mode?: boolean;
    auto_approve?: boolean;
}

// ── Phase 6.3+: Automations ──

export interface AutomationRecord {
    id: string;
    name: string;
    prompt: string;
    rrule: string;
    status: string;
    created_at: string;
    updated_at: string;
    next_run_at?: string;
    last_run_at?: string;
}

export interface AutomationRunRecord {
    id: string;
    automation_id: string;
    scheduled_for: string;
    status: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    error_summary?: string;
}

export interface CreateAutomationRequest {
    name: string;
    prompt: string;
    rrule: string;
    cwds?: string[];
    status?: string;
}

export interface UpdateAutomationRequest {
    name?: string;
    prompt?: string;
    rrule?: string;
    cwds?: string[];
    status?: string;
}

/**
 * TUI 进程管理器 — HTTP/SSE Threads 版本 (CodeWhale 0.8.44+)
 *
 * 启动 codewhale-tui serve --http，通过 Threads API 发送 prompt，
 * 监听 GET /v1/threads/{id}/events 获取完整事件（含 reasoning）。
 * Phase 4: 支持审批流程（approval.required → decideApproval → approval.decided）
 * Phase 5: 支持模型切换（per-thread model + PATCH update）
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
    private _currentThreadId?: string;
    private _currentTurnId?: string;
    private _lastEventSeq: number = 0;
    private _generation = 0; // 每次 resetThread 递增，用于丢弃旧 SSE 事件

    private _onEvent = new vscode.EventEmitter<RuntimeEvent>();
    readonly onEvent = this._onEvent.event;
    private _onStatusChange = new vscode.EventEmitter<{ status: string }>();
    readonly onStatusChange = this._onStatusChange.event;
    private _onApprovalRequired = new vscode.EventEmitter<ApprovalRequiredEvent>();
    readonly onApprovalRequired = this._onApprovalRequired.event;
    private _autoApprove = false;

    /** Phase 5: 当前会话配置 */
    private _config: SessionConfig = {
        model: 'deepseek-v4-flash',
    };

    constructor(private context: vscode.ExtensionContext) {}

    get port(): number { return this._port; }
    get connected(): boolean { return this._started && this.process?.exitCode === null; }
    get generation(): number { return this._generation; }
    set autoApprove(v: boolean) { this._autoApprove = v; }
    get autoApprove(): boolean { return this._autoApprove; }

    /** 重置 thread 状态（用于新建会话）— 递增 generation 以丢弃旧事件 */
    resetThread(): void {
        this._currentThreadId = undefined;
        this._lastEventSeq = 0;
        this._currentTurnId = undefined;
        this._currentAbort?.abort();
        this._currentAbort = undefined;
        this._generation++;
        logger.info(`[Thread] resetThread — generation=${this._generation}`);
    }

    /** Phase 5: 设置会话配置 */
    setConfig(config: Partial<SessionConfig>): void {
        this._config = { ...this._config, ...config };
        logger.info('[Config] updated:', JSON.stringify(this._config));
    }

    /** Phase 5: 获取当前配置 */
    getConfig(): SessionConfig {
        return { ...this._config };
    }

    async start(): Promise<void> {
        this._disposed = false;
        this._retryCount = 0;
        await this.startWithPortRetry();
    }

    /** 带端口重试的启动（处理 TOCTOU 竞态） */
    private async startWithPortRetry(): Promise<void> {
        const MAX_PORT_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_PORT_RETRIES; attempt++) {
            try {
                await this.startInternal();
                return; // 成功
            } catch (err: any) {
                // 检测端口冲突特征（stderr 中 EADDRINUSE 或 health check 超时但进程在运行）
                const isPortConflict = err.message?.includes('EADDRINUSE') ||
                    err.message?.includes('address already in use') ||
                    (err.message?.includes('did not start within') && this.process?.exitCode !== null && this.process?.exitCode !== 0);
                if (isPortConflict && attempt < MAX_PORT_RETRIES - 1) {
                    logger.warn(`[Start] port conflict detected, retrying (${attempt + 1}/${MAX_PORT_RETRIES})...`);
                    this.process?.kill();
                    this.process = undefined;
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }
                throw err;
            }
        }
    }

    /** 发送 prompt，通过 Threads API 获取完整事件流 */
    async sendPrompt(text: string): Promise<void> {
        if (!this._started) throw new Error('TUI not yet connected');

        const controller = new AbortController();
        this._currentAbort = controller;
        this._currentTurnId = undefined;
        const base = `http://127.0.0.1:${this._port}/v1`;
        const myGeneration = this._generation; // 捕获当前 generation

        try {
            // Phase 5: 使用配置中的 model
            const model = this._config.model || 'deepseek-v4-flash';
            const mode = this._config.mode || 'agent';

            let threadId: string;
            if (this._currentThreadId) {
                // 复用已恢复的 thread — 先同步 latest_seq，避免重放历史
                threadId = this._currentThreadId;
                logger.info(`[Thread] reusing: ${threadId}`);
                try {
                    const detail = await this.getThreadDetail(threadId);
                    if (detail && typeof detail.latest_seq === 'number') {
                        this._lastEventSeq = detail.latest_seq;
                        logger.info(`[Thread] synced _lastEventSeq to ${this._lastEventSeq}`);
                    }
                } catch { /* ignore — use existing seq */ }
            } else {
                // 创建新 thread
                const tResp = await fetch(`${base}/threads`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        mode,
                        workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.',
                        allow_shell: true,
                        trust_mode: false,
                        auto_approve: this._autoApprove,
                    }),
                    signal: controller.signal,
                });
                const thread = await tResp.json() as any;
                threadId = thread.id;
                this._currentThreadId = threadId;
                logger.info(`[Thread] created: ${threadId}`);
                // TUI 的 CreateThreadRequest 不支持 title 字段，通过 PATCH 设置
                const titleOk = await this.updateThreadConfig(threadId, { title: text.slice(0, 60) });
                if (!titleOk) logger.warn(`[Thread] PATCH title failed for ${threadId}`);
            }

            const turnPromise = fetch(`${base}/threads/${threadId}/turns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    model,
                    auto_approve: this._autoApprove,
                }),
                signal: controller.signal,
            }).then(r => r.json() as any);

            const eventsPromise = this.streamEvents(threadId, controller.signal, myGeneration);
            const [turn] = await Promise.all([turnPromise, eventsPromise]);
            this._currentTurnId = turn?.id;
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

    /** Phase 5: 更新 thread 配置（PATCH /v1/threads/{id}） */
    async updateThreadConfig(threadId: string, fields: Record<string, any>): Promise<boolean> {
        if (!this._started) return false;
        try {
            const base = `http://127.0.0.1:${this._port}/v1`;
            const resp = await fetch(`${base}/threads/${threadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            if (resp.ok) {
                logger.info(`[Thread] config updated for ${threadId}: ${JSON.stringify(fields)}`);
                return true;
            }
            logger.warn(`[Thread] config update failed: HTTP ${resp.status}`);
            return false;
        } catch (err: any) {
            logger.error(`[Thread] model update error: ${err.message}`);
            return false;
        }
    }

    /** Phase 5: 获取运行时信息 (GET /v1/runtime/info) */
    async getRuntimeInfo(): Promise<RuntimeInfo | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/runtime/info`);
            if (!resp.ok) return null;
            return await resp.json() as RuntimeInfo;
        } catch (err: any) {
            logger.warn('[RuntimeInfo] fetch failed:', err.message);
            return null;
        }
    }

    /** 列出已知 thread（会话列表）— 匹配 TUI 0.8.40 GET /v1/threads */
    async listThreads(): Promise<ThreadSummary[]> {
        if (!this._started) { logger.info('[Threads] TUI not started yet'); return []; }
        try {
            const base = `http://127.0.0.1:${this._port}/v1`;
            const resp = await fetch(`${base}/threads?include_archived=true&limit=100`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!resp.ok) { logger.warn(`[Threads] HTTP ${resp.status}`); return []; }
            const threads: any[] = await resp.json();
            if (!Array.isArray(threads)) { logger.warn('[Threads] response is not an array'); return []; }
            logger.info(`[Threads] listThreads → ${threads.length} threads`);
            return threads.map(t => ({
                id: t.id || '',
                title: t.title || undefined,
                created_at: t.created_at || '',
                updated_at: t.updated_at || '',
                model: t.model,
                mode: t.mode,
                workspace: t.workspace || undefined,
                latest_turn_id: t.latest_turn_id,
                archived: t.archived,
            }));
        } catch (err: any) {
            logger.warn(`[Threads] listThreads error: ${err.message}`);
            return [];
        }
    }

    /** 列出后台任务 (GET /v1/tasks) */
    async listTasks(): Promise<any[]> {
        if (!this._started) { logger.info('[Tasks] TUI not started yet, returning empty'); return []; }
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/tasks?limit=50`);
            if (!resp.ok) { logger.warn(`[Tasks] HTTP ${resp.status}`); return []; }
            const data = await resp.json() as any;
            const list = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data) ? data : []);
            logger.info(`[Tasks] listTasks → ${list.length} tasks: ${list.map((t:any) => `${t.id}=${t.status}`).join(', ')}`);
            return list;
        } catch (err: any) { logger.warn(`[Tasks] listTasks error: ${err.message}`); return []; }
    }

    /** 取消当前生成 */
    async cancel(): Promise<void> {
        const threadId = this._currentThreadId;
        const turnId = this._currentTurnId;
        logger.info(`[Thread] cancelling... thread=${threadId} turn=${turnId}`);
        if (threadId && turnId) {
            const url = `http://127.0.0.1:${this._port}/v1/threads/${threadId}/turns/${turnId}/interrupt`;
            try {
                const ctrl = new AbortController();
                const timeout = setTimeout(() => ctrl.abort(), 5000);
                const resp = await fetch(url, { method: 'POST', signal: ctrl.signal });
                clearTimeout(timeout);
                if (resp.ok) {
                    logger.info(`[Thread] interrupt OK for ${turnId}`);
                } else {
                    logger.warn(`[Thread] interrupt HTTP ${resp.status} for ${turnId}`);
                }
            } catch (e: any) {
                logger.warn(`[Thread] interrupt request failed: ${e.message}`);
            }
        } else {
            logger.warn(`[Thread] cannot interrupt: threadId=${threadId} turnId=${turnId}`);
        }
        this._currentAbort?.abort();
    }

    /** Phase 4: 发送审批决策到 TUI */
    async decideApproval(approvalId: string, decision: 'allow' | 'deny', remember: boolean = false): Promise<boolean> {
        logger.info(`[Approval] decideApproval ENTRY id="${approvalId}" decision=${decision} remember=${remember}`);
        if (!this._started) {
            logger.warn('[Approval] TUI not connected, cannot decide');
            return false;
        }
        // 仅在 HTTP 调用成功后设置 autoApprove，避免网络失败时状态不一致
        const url = `http://127.0.0.1:${this._port}/v1/approvals/${approvalId}`;
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision, remember }),
            });
            if (resp.status === 404) {
                logger.warn(`[Approval] ${approvalId} already resolved (timeout or duplicate)`);
                return false;
            }
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                logger.warn(`[Approval] decision HTTP ${resp.status}: ${text.slice(0, 200)}`);
                return false;
            }
            let result: any;
            try {
                result = await resp.json();
            } catch {
                logger.warn('[Approval] decision response was not JSON');
                return false;
            }
            if (result.ok) {
                if (remember && decision === 'allow') {
                    this._autoApprove = true;
                    logger.info('[Approval] session trusted (autoApprove=true after successful HTTP)');
                }
                logger.info(`[Approval] decided: ${decision} remember=${remember} for ${approvalId}`);
                return true;
            }
            logger.warn(`[Approval] decision rejected by TUI: ${JSON.stringify(result)}`);
            return false;
        } catch (err: any) {
            logger.error(`[Approval] decision request failed: ${err.message}`);
            return false;
        }
    }

    // ── Phase 6.1 新增方法 ──

    /** 列出可用 Skills (GET /v1/skills) */
    async listSkills(): Promise<SkillsListResponse | null> {
        if (!this._started) { logger.info('[Skills] TUI not started'); return null; }
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/skills`);
            if (!resp.ok) { logger.warn(`[Skills] HTTP ${resp.status}`); return null; }
            const data = await resp.json() as SkillsListResponse;
            logger.info(`[Skills] got ${Array.isArray(data.skills) ? data.skills.length : 0} skills from ${data.directory}`);
            return data;
        } catch (err: any) {
            logger.warn(`[Skills] fetch failed: ${err.message}`);
            return null;
        }
    }

    /** 设置 Skill 启用/禁用 (POST /v1/skills/{name}) */
    async setSkillEnabled(name: string, enabled: boolean): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/skills/${encodeURIComponent(name)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            if (!resp.ok) {
                logger.warn(`[Skills] setSkillEnabled ${name}=${enabled} HTTP ${resp.status}`);
                return false;
            }
            logger.info(`[Skills] ${name} enabled=${enabled}`);
            return true;
        } catch (err: any) {
            logger.warn(`[Skills] setSkillEnabled failed: ${err.message}`);
            return false;
        }
    }

    /** 获取工作区状态 (GET /v1/workspace/status) */
    async getWorkspaceStatus(): Promise<WorkspaceStatus | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/workspace/status`);
            if (!resp.ok) { logger.warn(`[Workspace] HTTP ${resp.status}`); return null; }
            return await resp.json() as WorkspaceStatus;
        } catch (err: any) {
            logger.warn(`[Workspace] fetch failed: ${err.message}`);
            return null;
        }
    }

    /** 获取用量统计 (GET /v1/usage) */
    async getUsage(query?: UsageQuery): Promise<UsageData | null> {
        if (!this._started) return null;
        try {
            const params = new URLSearchParams();
            if (query?.since) params.set('since', query.since);
            if (query?.until) params.set('until', query.until);
            if (query?.group_by) params.set('group_by', query.group_by);
            const qs = params.toString();
            const url = `http://127.0.0.1:${this._port}/v1/usage${qs ? '?' + qs : ''}`;
            const resp = await fetch(url);
            if (!resp.ok) { logger.warn(`[Usage] HTTP ${resp.status}`); return null; }
            return await resp.json() as UsageData;
        } catch (err: any) {
            logger.warn(`[Usage] fetch failed: ${err.message}`);
            return null;
        }
    }

    /** 压缩对话上下文 (POST /v1/threads/{id}/compact) */
    async compactThread(threadId: string, reason?: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const body: Record<string, string> = {};
            if (reason) body.reason = reason;
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${threadId}/compact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (resp.ok) {
                logger.info(`[Compact] thread ${threadId} compacted`);
                return true;
            }
            logger.warn(`[Compact] HTTP ${resp.status}`);
            return false;
        } catch (err: any) {
            logger.warn(`[Compact] failed: ${err.message}`);
            return false;
        }
    }

    // ── Phase 6.2: Sessions ──

    /** 列出会话 (GET /v1/sessions) */
    async listSessions(limit?: number, search?: string): Promise<SessionMetadata[]> {
        if (!this._started) return [];
        try {
            const params = new URLSearchParams();
            if (limit) params.set('limit', String(limit));
            if (search) params.set('search', search);
            const qs = params.toString();
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/sessions${qs ? '?' + qs : ''}`);
            if (!resp.ok) { logger.warn(`[Sessions] HTTP ${resp.status}`); return []; }
            const data = await resp.json() as SessionsListResponse;
            return data.sessions || [];
        } catch (err: any) { logger.warn(`[Sessions] fetch failed: ${err.message}`); return []; }
    }

    /** 获取会话详情 (GET /v1/sessions/{id}) */
    async getSession(id: string): Promise<SessionDetail | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/sessions/${encodeURIComponent(id)}`);
            if (!resp.ok) { logger.warn(`[Sessions] HTTP ${resp.status}`); return null; }
            return await resp.json() as SessionDetail;
        } catch (err: any) { logger.warn(`[Sessions] fetch failed: ${err.message}`); return null; }
    }

    /** 删除会话 (DELETE /v1/sessions/{id}) */
    async deleteSession(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (resp.ok) { logger.info(`[Sessions] deleted ${id}`); return true; }
            logger.warn(`[Sessions] delete HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Sessions] delete failed: ${err.message}`); return false; }
    }

    /** 从会话恢复线程 (POST /v1/sessions/{id}/resume-thread) */
    async resumeSessionThread(id: string, model?: string, mode?: string): Promise<ResumeSessionResult | null> {
        if (!this._started) return null;
        try {
            const body: Record<string, string> = {};
            if (model) body.model = model;
            if (mode) body.mode = mode;
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/sessions/${encodeURIComponent(id)}/resume-thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) { logger.warn(`[Sessions] resume-thread HTTP ${resp.status}`); return null; }
            return await resp.json() as ResumeSessionResult;
        } catch (err: any) { logger.warn(`[Sessions] resume failed: ${err.message}`); return null; }
    }

    // ── Phase 6.2: Threads 增强 ──

    /** 获取线程详情 (GET /v1/threads/{id}) */
    async getThread(id: string): Promise<ThreadDetail | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${encodeURIComponent(id)}`);
            if (!resp.ok) { logger.warn(`[Thread] get HTTP ${resp.status}`); return null; }
            return await resp.json() as ThreadDetail;
        } catch (err: any) { logger.warn(`[Thread] get failed: ${err.message}`); return null; }
    }

    /** 获取线程摘要 (GET /v1/threads/summary) — 比 listThreads 更快 */
    async getThreadSummary(limit?: number, search?: string): Promise<ThreadSummary[]> {
        if (!this._started) return [];
        try {
            const params = new URLSearchParams();
            if (limit) params.set('limit', String(limit));
            if (search) params.set('search', search);
            const qs = params.toString();
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/summary${qs ? '?' + qs : ''}`);
            if (!resp.ok) { logger.warn(`[Thread] summary HTTP ${resp.status}`); return []; }
            return await resp.json() as ThreadSummary[];
        } catch (err: any) { logger.warn(`[Thread] summary failed: ${err.message}`); return []; }
    }

    /** 恢复线程 (POST /v1/threads/{id}/resume) */
    async resumeThread(id: string, model?: string, mode?: string): Promise<ThreadSummary | null> {
        if (!this._started) return null;
        try {
            const body: Record<string, string> = {};
            if (model) body.model = model;
            if (mode) body.mode = mode;
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${encodeURIComponent(id)}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) { logger.warn(`[Thread] resume HTTP ${resp.status}`); return null; }
            const result = await resp.json() as ThreadSummary;
            // 标记为活跃 thread，后续 prompt 复用此 thread
            this._currentThreadId = id;
            logger.info(`[Thread] resumed ${id} — future prompts will reuse this thread`);
            return result;
        } catch (err: any) { logger.warn(`[Thread] resume failed: ${err.message}`); return null; }
    }

    /** 获取线程详情 — GET /v1/threads/{id} */
    async getThreadDetail(id: string): Promise<ThreadDetail | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${encodeURIComponent(id)}`);
            if (!resp.ok) { logger.warn(`[Thread] getThreadDetail HTTP ${resp.status}`); return null; }
            return await resp.json() as ThreadDetail;
        } catch (err: any) { logger.warn(`[Thread] getThreadDetail failed: ${err.message}`); return null; }
    }

    // ── Phase 6.2: Tasks CRUD ──

    /** 创建后台任务 (POST /v1/tasks) */
    async createTask(req: NewTaskRequest): Promise<Record<string, unknown> | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });
            if (!resp.ok) { logger.warn(`[Tasks] create HTTP ${resp.status}`); return null; }
            return await resp.json() as Record<string, unknown>;
        } catch (err: any) { logger.warn(`[Tasks] create failed: ${err.message}`); return null; }
    }

    /** 获取任务详情 (GET /v1/tasks/{id}) */
    async getTask(id: string): Promise<Record<string, unknown> | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/tasks/${encodeURIComponent(id)}`);
            if (!resp.ok) { logger.warn(`[Tasks] get HTTP ${resp.status}`); return null; }
            return await resp.json() as Record<string, unknown>;
        } catch (err: any) { logger.warn(`[Tasks] get failed: ${err.message}`); return null; }
    }

    /** 取消任务 (POST /v1/tasks/{id}/cancel) */
    async cancelTask(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
            if (resp.ok) { logger.info(`[Tasks] cancelled ${id}`); return true; }
            logger.warn(`[Tasks] cancel HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Tasks] cancel failed: ${err.message}`); return false; }
    }

    // ── Phase 6.3+: Automations ──

    /** 列出自动化任务 (GET /v1/automations) */
    async listAutomations(): Promise<AutomationRecord[]> {
        if (!this._started) return [];
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations`);
            if (!resp.ok) { logger.warn(`[Automations] HTTP ${resp.status}`); return []; }
            return await resp.json() as AutomationRecord[];
        } catch (err: any) { logger.warn(`[Automations] fetch failed: ${err.message}`); return []; }
    }

    /** 获取自动化任务详情 (GET /v1/automations/{id}) */
    async getAutomation(id: string): Promise<AutomationRecord | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}`);
            if (!resp.ok) { logger.warn(`[Automations] get HTTP ${resp.status}`); return null; }
            return await resp.json() as AutomationRecord;
        } catch (err: any) { logger.warn(`[Automations] get failed: ${err.message}`); return null; }
    }

    /** 列出自动化运行记录 (GET /v1/automations/{id}/runs) */
    async listAutomationRuns(id: string, limit?: number): Promise<AutomationRunRecord[]> {
        if (!this._started) return [];
        try {
            const qs = limit ? `?limit=${limit}` : '';
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}/runs${qs}`);
            if (!resp.ok) { logger.warn(`[Automations] runs HTTP ${resp.status}`); return []; }
            return await resp.json() as AutomationRunRecord[];
        } catch (err: any) { logger.warn(`[Automations] runs failed: ${err.message}`); return []; }
    }

    /** 创建自动化 (POST /v1/automations) */
    async createAutomation(req: CreateAutomationRequest): Promise<AutomationRecord | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });
            if (!resp.ok) { logger.warn(`[Automations] create HTTP ${resp.status}`); return null; }
            return await resp.json() as AutomationRecord;
        } catch (err: any) { logger.warn(`[Automations] create failed: ${err.message}`); return null; }
    }

    /** 更新自动化 (PATCH /v1/automations/{id}) */
    async updateAutomation(id: string, req: UpdateAutomationRequest): Promise<AutomationRecord | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });
            if (!resp.ok) { logger.warn(`[Automations] update HTTP ${resp.status}`); return null; }
            return await resp.json() as AutomationRecord;
        } catch (err: any) { logger.warn(`[Automations] update failed: ${err.message}`); return null; }
    }

    /** 删除自动化 (DELETE /v1/automations/{id}) */
    async deleteAutomation(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (resp.ok) { logger.info(`[Automations] deleted ${id}`); return true; }
            logger.warn(`[Automations] delete HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Automations] delete failed: ${err.message}`); return false; }
    }

    /** 运行自动化 (POST /v1/automations/{id}/run) */
    async runAutomation(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}/run`, { method: 'POST' });
            if (resp.ok) { logger.info(`[Automations] run triggered ${id}`); return true; }
            logger.warn(`[Automations] run HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Automations] run failed: ${err.message}`); return false; }
    }

    /** 暂停自动化 (POST /v1/automations/{id}/pause) */
    async pauseAutomation(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}/pause`, { method: 'POST' });
            if (resp.ok) { logger.info(`[Automations] paused ${id}`); return true; }
            logger.warn(`[Automations] pause HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Automations] pause failed: ${err.message}`); return false; }
    }

    /** 恢复自动化 (POST /v1/automations/{id}/resume) */
    async resumeAutomation(id: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/automations/${encodeURIComponent(id)}/resume`, { method: 'POST' });
            if (resp.ok) { logger.info(`[Automations] resumed ${id}`); return true; }
            logger.warn(`[Automations] resume HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Automations] resume failed: ${err.message}`); return false; }
    }

    // ── Phase 6.3: Fork ──

    /** Fork 线程 (POST /v1/threads/{id}/fork) */
    async forkThread(id: string): Promise<ThreadSummary | null> {
        if (!this._started) return null;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${encodeURIComponent(id)}/fork`, { method: 'POST' });
            if (!resp.ok) { logger.warn(`[Thread] fork HTTP ${resp.status}`); return null; }
            return await resp.json() as ThreadSummary;
        } catch (err: any) { logger.warn(`[Thread] fork failed: ${err.message}`); return null; }
    }

    // ── Phase 6.3: MCP ──

    /** 列出 MCP 服务器 (GET /v1/apps/mcp/servers) */
    async listMcpServers(): Promise<Record<string, unknown>[]> {
        if (!this._started) return [];
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/apps/mcp/servers`);
            if (!resp.ok) { logger.warn(`[MCP] servers HTTP ${resp.status}`); return []; }
            const data = await resp.json() as any;
            return Array.isArray(data?.servers) ? data.servers : [];
        } catch (err: any) { logger.warn(`[MCP] servers fetch failed: ${err.message}`); return []; }
    }

    /** 列出 MCP 工具 (GET /v1/apps/mcp/tools) */
    async listMcpTools(server?: string): Promise<Record<string, unknown>[]> {
        if (!this._started) return [];
        try {
            const qs = server ? `?server=${encodeURIComponent(server)}` : '';
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/apps/mcp/tools${qs}`);
            if (!resp.ok) { logger.warn(`[MCP] tools HTTP ${resp.status}`); return []; }
            const data = await resp.json() as any;
            return Array.isArray(data?.tools) ? data.tools : [];
        } catch (err: any) { logger.warn(`[MCP] tools fetch failed: ${err.message}`); return []; }
    }

    // ── Phase 6.2: Steer ──

    /** Steer turn (POST /v1/threads/{id}/turns/{turn_id}/steer) */
    async steerTurn(threadId: string, turnId: string, prompt: string): Promise<boolean> {
        if (!this._started) return false;
        try {
            const resp = await fetch(`http://127.0.0.1:${this._port}/v1/threads/${threadId}/turns/${turnId}/steer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            if (resp.ok) { logger.info(`[Steer] sent to ${turnId}`); return true; }
            logger.warn(`[Steer] HTTP ${resp.status}`);
            return false;
        } catch (err: any) { logger.warn(`[Steer] failed: ${err.message}`); return false; }
    }

    dispose(): void {
        this._disposed = true;
        this._currentAbort?.abort();
        this.process?.kill();
        this._started = false;
    }

    // ── 内部实现 ────────────────────────────────────────────

    private async streamEvents(threadId: string, signal: AbortSignal, generation: number): Promise<void> {
        const sinceSeq = this._lastEventSeq > 0 ? this._lastEventSeq + 1 : 0;
        const url = `http://127.0.0.1:${this._port}/v1/threads/${threadId}/events?since_seq=${sinceSeq}`;
        logger.info(`[SSE] connecting to ${url} (since_seq=${sinceSeq}, gen=${generation})`);

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

                // 检查 generation 是否已变（说明会话已重置）
                if (generation !== this._generation) {
                    logger.info(`[SSE] generation mismatch (${generation} vs ${this._generation}), discarding stale events`);
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (currentEvent) {
                            this.dispatchRawEvent(currentEvent, data, generation);
                        }
                        currentEvent = '';
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private dispatchRawEvent(eventName: string, data: string, generation: number): void {
        // 如果 generation 不匹配，丢弃此事件（属于旧会话）
        if (generation !== this._generation) {
            logger.info(`[SSE] discarding stale event ${eventName} (gen=${generation} vs current=${this._generation})`);
            return;
        }

        let payload: any = {};
        try { payload = JSON.parse(data); } catch { return; }

        // 跟踪事件 seq，避免复用 thread 时重放历史
        if (typeof payload.seq === 'number' && payload.seq > this._lastEventSeq) {
            this._lastEventSeq = payload.seq;
        }

        // Phase 4: 审批事件优先处理
        if (eventName === 'approval.required') {
            const inner = (payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload))
                ? payload.payload : payload;
            logger.info(`[SSE] approval.required tool=${inner.tool_name} desc="${String(inner.description || '').slice(0, 60)}"`);
            const approvalEvent: ApprovalRequiredEvent = {
                id: inner.id || inner.approval_id || '',
                tool_name: inner.tool_name || '',
                description: inner.description || '',
                threadId: payload.thread_id || this._currentThreadId || '',
                turnId: payload.turn_id || this._currentTurnId || '',
            };
            logger.info(`[SSE] approval.required tool=${approvalEvent.tool_name} desc="${approvalEvent.description}"`);
            this._onApprovalRequired.fire(approvalEvent);
            return;
        }

        if (eventName === 'approval.decided') {
            const inner = (payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload))
                ? payload.payload : payload;
            logger.info(`[SSE] approval.decided id=${inner.approval_id} decision=${inner.decision} remember=${inner.remember}`);
            this._onEvent.fire({
                event: 'approvalDecided',
                itemId: inner.approval_id,
                delta: inner.decision,
            });
            return;
        }

        if (eventName === 'approval.timeout') {
            const inner = (payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload))
                ? payload.payload : payload;
            logger.warn(`[SSE] approval.timeout id=${inner.approval_id}`);
            this._onEvent.fire({
                event: 'approvalTimeout',
                itemId: inner.approval_id,
            });
            return;
        }

        const p = payload.payload || {};
        const item = p.item || {};
        const kind: string = p.kind || item.kind || '';

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
                    this._onEvent.fire({ event: 'reasoningDelta', delta: d, kind });
                } else if (kind === 'agent_message') {
                    this._onEvent.fire({ event: 'messageDelta', delta: d, kind });
                } else if (kind === 'tool_call') {
                    this._onEvent.fire({ event: 'toolProgress', delta: d, kind, itemId: item.id });
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
            // Phase 6.3: Sub-agent events
            case 'agent.spawned': {
                const agentId = p.id || p.agent_id || payload.agent_id || payload.id || '';
                const prompt = p.prompt || p.objective || p.message || '';
                this._onEvent.fire({ event: 'agentSpawned', itemId: agentId, delta: prompt });
                break;
            }
            case 'agent.progress': {
                const agentId = p.id || p.agent_id || payload.agent_id || payload.id || '';
                const status = p.status || p.delta || payload.status || '';
                this._onEvent.fire({ event: 'agentProgress', itemId: agentId, delta: status });
                break;
            }
            case 'agent.completed': {
                const agentId = p.id || p.agent_id || payload.agent_id || payload.id || '';
                const result = p.result || p.summary || payload.result || '';
                this._onEvent.fire({ event: 'agentCompleted', itemId: agentId, delta: result });
                break;
            }
            case 'turn.interrupt_requested': {
                this._onEvent.fire({ event: 'turnInterrupted' });
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
        const config = vscode.workspace.getConfiguration('celest');
        const binPath = config.get<string>('binaryPath') || this.findBinaryFallback();

        if (!binPath || !fs.existsSync(binPath)) {
            const autoDownload = config.get<boolean>('autoDownloadBinary') ?? true;
            if (autoDownload) {
                throw new Error('codewhale-tui binary not found. Set celest.binaryPath in VS Code settings.');
            }
            throw new Error(`codewhale binary not found: ${binPath}`);
        }

        this._port = await findAvailablePort(8787);
        logger.info(`Starting codewhale-tui serve on port ${this._port}:`, binPath);

        // Phase 5+: 传递多 Provider 环境变量
        const env: Record<string, string> = { ...process.env as Record<string, string> };

        // 从 SecretStorage 读取所有已配置 Provider 的 API Key
        let providerCredentials: Record<string, ProviderCredentials> = {};
        try {
            const store = getSecretStore();
            providerCredentials = await store.getAllProviderCredentials();
        } catch (err: any) {
            logger.warn('[Config] failed to load provider credentials:', err.message);
        }

        // 注入所有 Provider 的环境变量（API Key + Base URL + Model）
        let injectedCount = 0;
        for (const [providerId, mapping] of Object.entries(PROVIDER_ENV_MAP)) {
            const creds = providerCredentials[providerId] || {};
            const config = vscode.workspace.getConfiguration('celest');

            // API Key: 优先 SecretStorage，其次 session config（deepseek 兼容）
            const apiKey = creds.apiKey || (providerId === 'deepseek' ? this._config.apiKey : undefined);
            if (apiKey && mapping.apiKeyEnv) {
                env[mapping.apiKeyEnv] = apiKey;
                injectedCount++;
            }

            // Base URL: 优先 VS Code 配置，其次 PROVIDER_ENV_MAP 默认值，最后 session config
            const configBaseUrl = config.get<string>(`providers.${providerId}.baseUrl`);
            const baseUrl = configBaseUrl || mapping.defaultBaseUrl || (providerId === 'deepseek' ? this._config.baseUrl : undefined);
            if (baseUrl && mapping.baseUrlEnv) {
                env[mapping.baseUrlEnv] = baseUrl;
            }

            // Model: 优先 VS Code 配置，其次 PROVIDER_ENV_MAP 默认值
            const configModel = config.get<string>(`providers.${providerId}.model`);
            const model = configModel || mapping.defaultModel;
            if (model && mapping.modelEnv) {
                env[mapping.modelEnv] = model;
            }
        }
        logger.info(`[Config] injected env vars for ${injectedCount} provider(s)`);

        // 兼容旧版 session config（pathSuffix 等）
        if (this._config.pathSuffix) {
            env.CODEWHALE_PATH_SUFFIX = this._config.pathSuffix;
        }

        this.process = cp.spawn(binPath, [
            'serve', '--http',
            '--port', String(this._port),
            '--host', '127.0.0.1',
            '--insecure',
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            env,
        });

        let stderrLog = '';
        this.process.stderr?.on('data', (d: Buffer) => {
            const text = d.toString();
            stderrLog += text;
            if (text.trim()) logger.info('TUI stderr:', text.trim());
        });
        this.process.stdout?.on('data', (d: Buffer) => {
            const text = d.toString().trim();
            if (text && !text.startsWith('\x1b]0;') && !text.startsWith(']0;')) {
                logger.info('TUI stdout:', text);
            }
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
        this._onStatusChange.fire({ status: 'connected' });
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

    private findBinaryFallback(): string | null {
        // 依赖系统 PATH 或 VS Code 配置，不硬编码开发者路径
        if (process.platform !== 'win32') return 'codewhale-tui';
        return 'codewhale-tui.exe'; // 依赖 PATH 环境变量
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
    throw new Error('No available port found');
}
