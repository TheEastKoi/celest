<template>
    <div class="chat-view" ref="scrollContainer">
        <div v-if="messages.length === 0" class="empty-state">
            <div class="empty-icon">🌙</div>
            <p>Start a conversation with Celest</p>
            <p class="empty-hint">Type a message or use <kbd>@</kbd> to reference files</p>
        </div>

        <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message"
            :class="'msg-' + msg.role"
        >
            <div v-if="msg.role === 'user'" class="user-msg">{{ msg.content }}</div>

            <div v-else-if="msg.role === 'assistant'" class="assistant-msg">
                <template v-for="(part, pIdx) in msg.parts" :key="pIdx">
                    <ThinkingBlock
                        v-if="part.type === 'thinking'"
                        :content="part.content || ''"
                        :done="part.done"
                    />
                    <MarkdownRenderer
                        v-else-if="part.type === 'text'"
                        :content="part.content || ''"
                    />
                    <div v-else-if="part.type === 'tool_call'" class="tool-call-card">
                        <div class="tool-call-header">
                            <span class="tool-icon">🔧</span>
                            <span class="tool-name">{{ part.toolName }}</span>
                            <span v-if="part.status" class="tool-status" :class="'status-' + part.status">
                                {{ part.status }}
                            </span>
                        </div>
                        <div v-if="part.arguments" class="tool-call-args">
                            <pre>{{ formatArgs(part.arguments) }}</pre>
                        </div>
                        <div v-if="part.result" class="tool-call-result">
                            <div class="result-label">Result:</div>
                            <pre>{{ formatResult(part.result) }}</pre>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- typing 指示器 -->
        <div v-if="typing" class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-text">Celest is thinking...</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';
import MarkdownRenderer from './MarkdownRenderer.vue';
import ThinkingBlock from './ThinkingBlock.vue';

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'celest_messages';

// ── Types ─────────────────────────────────────────────────────

export interface Message {
    role: 'user' | 'assistant';
    content?: string;
    parts?: ChatPart[];
}

export interface ChatPart {
    type: 'text' | 'thinking' | 'tool_call';
    content?: string;
    done?: boolean;
    toolName?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    status?: 'pending' | 'success' | 'error';
    callId?: string;
}

// ── State ─────────────────────────────────────────────────────

const messages = ref<Message[]>([]);
const scrollContainer = ref<HTMLElement>();

// ── Public API (exposed to parent) ────────────────────────────

function addUserMessage(content: string) {
    messages.value.push({ role: 'user', content });
    scrollToBottom();
}

/** 获取当前正在构建的 assistant 消息（最后一条） */
function currentAssistant(): Message | null {
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant') return last;
    return null;
}

/** 确保最后一条是 assistant 消息，如果不是则新建 */
function ensureAssistant(): Message {
    const existing = currentAssistant();
    if (existing) return existing;
    const msg: Message = { role: 'assistant', parts: [] };
    messages.value.push(msg);
    return msg;
}

/** 追加或创建文本 part（打字机增量） */
function appendText(text: string) {
    const msg = ensureAssistant();
    const parts = msg.parts!;
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.type === 'text') {
        // 原地追加（打字机效果）
        lastPart.content = (lastPart.content || '') + text;
    } else {
        parts.push({ type: 'text', content: text });
    }
    scrollToBottom();
}

/** 追加或创建 reasoning part（thinking 块） */
function appendReasoning(text: string) {
    const msg = ensureAssistant();
    const parts = msg.parts!;
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.type === 'thinking') {
        lastPart.content = (lastPart.content || '') + text;
        lastPart.done = false; // still streaming
    } else {
        parts.push({ type: 'thinking', content: text, done: false });
    }
    scrollToBottom();
}

/** 标记最后一个 thinking 块为已完成 */
function markReasoningDone() {
    const msg = currentAssistant();
    if (!msg?.parts) return;
    for (let i = msg.parts.length - 1; i >= 0; i--) {
        if (msg.parts[i].type === 'thinking') {
            msg.parts[i].done = true;
            scrollToBottom();
            return;
        }
    }
}

/** 新增工具调用卡片 */
function addToolCall(toolName: string, args?: Record<string, unknown>, callId?: string) {
    const msg = ensureAssistant();
    msg.parts!.push({
        type: 'tool_call',
        toolName,
        arguments: args,
        callId,
        status: 'pending',
    });
    scrollToBottom();
}

/** 更新工具调用的结果 */
function updateToolResult(callId: string, result: unknown, status: 'success' | 'error') {
    const msg = currentAssistant();
    if (!msg?.parts) return;
    // 倒序查找匹配的 tool_call
    for (let i = msg.parts.length - 1; i >= 0; i--) {
        const part = msg.parts[i];
        if (part.type === 'tool_call' && part.callId === callId) {
            part.result = result;
            part.status = status;
            scrollToBottom();
            return;
        }
    }
}

const typing = ref(false);

function showTyping() {
    typing.value = true;
    scrollToBottom();
}

function hideTyping() {
    typing.value = false;
}

function clearMessages() {
    messages.value = [];
    saveToStorage();
}

// ── LocalStorage Persistence (Phase 2) ─────────────────────────

/** 从 localStorage 恢复消息 */
function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                messages.value = parsed;
            }
        }
    } catch {
        // 损坏的数据 → 忽略
    }
}

/** 保存消息到 localStorage（防抖 500ms） */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveToStorage() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            const toSave = messages.value;
            if (toSave.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // 存储满 → 静默失败
        }
    }, 500);
}

// 监听消息变化并自动保存
watch(messages, () => saveToStorage(), { deep: true });

// 组件挂载时恢复消息
onMounted(() => loadFromStorage());

// ── Helpers ───────────────────────────────────────────────────

function formatArgs(args: Record<string, unknown>): string {
    return JSON.stringify(args, null, 2);
}

function formatResult(result: unknown): string {
    if (typeof result === 'string') return result;
    return JSON.stringify(result, null, 2);
}

// ── Scroll ────────────────────────────────────────────────────

function scrollToBottom() {
    nextTick(() => {
        if (scrollContainer.value) {
            scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
        }
    });
}

// ── Exports ───────────────────────────────────────────────────

defineExpose({
    addUserMessage,
    appendText,
    appendReasoning,
    markReasoningDone,
    addToolCall,
    updateToolResult,
    clearMessages,
    showTyping,
    hideTyping,
});
</script>

<style scoped>
.chat-view {
    padding: 12px;
    height: 100%;
    overflow-y: auto;
}
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--vscode-descriptionForeground);
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-hint { font-size: 12px; margin-top: 8px; }
.empty-hint kbd {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 5px;
    border-radius: 3px;
}
.message { margin-bottom: 12px; }
.user-msg {
    background: var(--vscode-textBlockQuote-background);
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 90%;
    margin-left: auto;
}
.assistant-msg { max-width: 100%; }

/* ── 工具调用卡片 (Phase 2) ─────────────────────────────── */
.tool-call-card {
    margin: 4px 0;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    overflow: hidden;
    font-size: 12px;
}
.tool-call-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-textBlockQuote-background);
}
.tool-icon { font-size: 14px; }
.tool-name { font-weight: 600; }
.tool-status {
    font-size: 11px;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: auto;
}
.status-pending {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.status-success {
    background: #2ea04344;
    color: #2ea043;
}
.status-error {
    background: #f8514944;
    color: #f85149;
}
.tool-call-args {
    padding: 4px 10px;
    background: var(--vscode-textCodeBlock-background);
}
.tool-call-args pre {
    margin: 0;
    font-size: 11px;
    overflow-x: auto;
}
.tool-call-result {
    padding: 4px 10px;
    border-top: 1px solid var(--vscode-panel-border);
}
.result-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 2px;
}
.tool-call-result pre {
    margin: 0;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 120px;
    overflow-y: auto;
}

/* ── Typing 指示器 (Phase 2) ─────────────────────────────── */
.typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
}
.typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--vscode-descriptionForeground);
    animation: typing-bounce 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce {
    0%, 100% { opacity: 0.3; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(-3px); }
}
.typing-text {
    margin-left: 8px;
    font-size: 12px;
    opacity: 0.7;
}
</style>
