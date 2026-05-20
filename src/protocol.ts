/**
 * Celest 协议类型定义
 * 对应 deepseek-tui 的 crates/protocol + ACP 协议
 */

// ── JSON-RPC 2.0 ──────────────────────────────────────────────

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number;
    method: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}

// ── ACP 协议 (ACP 1.0) ────────────────────────────────────────

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
    update: AcpContentUpdate;
}

// ── Content Union Types (Phase 2 — 适配实际 TUI 输出) ──────────

/** content.type 判别字段 */
export type AcpContentType = 'text' | 'reasoning' | 'tool_use' | 'tool_result';

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
        status?: 'success' | 'error' | 'pending';
    };
}

export type AcpContentUnion =
    | AcpTextContent
    | AcpReasoningContent
    | AcpToolCallContent
    | AcpToolResultContent;

export interface AcpContentUpdate {
    /** TUI 内部事件名：agent_message_chunk / agent_thought_chunk / tool_use / tool_result */
    sessionUpdate?: string;
    content: AcpContentUnion;
}

export interface AcpPromptStopResult {
    stopReason: 'end_turn' | 'cancelled' | 'max_tokens';
}

// ── App-Server 协议 (完整版, Phase 3+) ─────────────────────────

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
