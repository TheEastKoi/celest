/**
 * Celest 协议类型定义
 * Phase 3: HTTP/SSE 运行时 API（deepseek serve --http）
 */

// ── SSE 事件类型（POST /v1/stream 兼容端点） ───────────────────

/** SSE 事件名 */
export type SseEventName =
    | 'turn.started'
    | 'message.delta'
    | 'tool.started'
    | 'tool.progress'
    | 'tool.completed'
    | 'turn.completed'
    | 'done'
    | 'error'
    | 'status'
    | 'approval.required';

/** SSE 事件帧 */
export interface SseEventFrame {
    event: SseEventName;
    data: string;
}

/** turn.started 负载 */
export interface SseTurnStarted {
    thread_id: string;
    turn_id: string;
    model: string;
    mode: string;
    workspace: string;
}

/** message.delta 负载 */
export interface SseMessageDelta {
    content: string;
}

/** tool.started 负载 */
export interface SseToolStarted {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

/** tool.progress 负载 */
export interface SseToolProgress {
    output?: string;
    id?: string;
}

/** tool.completed 负载 */
export interface SseToolCompleted {
    id: string;
    success: boolean;
    output: unknown;
}

/** turn.completed 负载 */
export interface SseTurnCompleted {
    usage: unknown;
}

// ── HTTP 请求类型 ──────────────────────────────────────────────

/** POST /v1/stream 请求体 */
export interface StreamTurnRequest {
    prompt: string;
    model?: string;
    mode?: string;
    workspace?: string;
    allow_shell?: boolean;
    trust_mode?: boolean;
    auto_approve?: boolean;
}

// ── 旧版 ACP 协议（保留兼容） ─────────────────────────────────

export interface AcpInitializeResult {
    protocolVersion: number;
    capabilities?: { loadSession: boolean };
    agentCapabilities?: unknown;
    agentInfo?: { name: string; title?: string; version: string };
    agent?: { name: string; version: string };
    authMethods?: unknown[];
}

export interface AcpSessionNewResult {
    sessionId: string;
}

export interface AcpSessionUpdateParams {
    sessionId: string;
    update: { sessionUpdate?: string; content: Record<string, unknown> };
}

export interface AcpPromptStopResult {
    stopReason: 'end_turn' | 'cancelled' | 'max_tokens';
}

// ── Content Union Types（WebView 消息兼容） ────────────────────

export interface AcpTextContent {
    type: 'text';
    text: string;
}

export interface AcpReasoningContent {
    type: 'reasoning';
    reasoning: string;
}

export interface AcpToolCallContent {
    type: 'tool_use';
    toolCall?: {
        name: string;
        arguments?: Record<string, unknown>;
        callId?: string;
    };
}

export interface AcpToolResultContent {
    type: 'tool_result';
    toolResult?: {
        callId?: string;
        output?: unknown;
        error?: string;
        status?: 'success' | 'error' | 'pending' | 'running';
    };
}

export type AcpContentUnion =
    | AcpTextContent
    | AcpReasoningContent
    | AcpToolCallContent
    | AcpToolResultContent;

// ── App-Server 协议（保留） ─────────────────────────────────────

export interface EventFrame {
    event: string;
    response_id?: string;
    delta?: string;
    channel?: 'text' | 'reasoning';
    tool_name?: string;
    arguments?: unknown;
    output?: unknown;
    command?: string;
    cwd?: string;
    exit_code?: number;
    turn_id?: string;
    message?: string;
    path?: string;
    ok?: boolean;
    reason?: string;
    request?: ExecApprovalEvent;
}

export interface ExecApprovalEvent {
    call_id: string;
    approval_id: string;
    turn_id: string;
    command: string;
    cwd: string;
    reason: string;
    available_decisions: string[];
}

export interface ThreadInfo {
    id: string;
    preview: string;
    ephemeral: boolean;
    model_provider: string;
    created_at: number;
    updated_at: number;
    status: 'running' | 'idle' | 'completed' | 'failed' | 'paused' | 'archived';
    cwd: string;
    cli_version: string;
    source: string;
    name?: string;
}
