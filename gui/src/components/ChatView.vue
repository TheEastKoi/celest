<template>
    <div class="chat-view" ref="scrollContainer" @scroll="onScroll">
        <div v-if="messages.length === 0" class="empty-state">
            <div class="empty-icon"><img :src="iconPng" class="empty-icon-img" /></div>
            <p>Start a conversation with Celest</p>
            <p class="empty-hint">Type a message or use <kbd>@</kbd> to reference files</p>
        </div>

        <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message"
            :class="'msg-' + msg.role"
        >
            <div v-if="msg.role === 'user'" class="user-msg" v-html="renderFileChips(msg.content || '')" @click="handleChipClick"></div>

            <div v-else-if="msg.role === 'assistant'" class="assistant-msg" @click="handleChipClick">
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
                        <div class="tool-call-header" @click="toggleToolCard(pIdx, part)">
                            <span class="tool-collapse-icon">{{ part._collapsed === false ? '▼' : '▶' }}</span>
                            <span class="tool-icon">🔧</span>
                            <span class="tool-name">{{ part.toolName }}</span>
                            <span v-if="part.status" class="tool-status" :class="'status-' + part.status">
                                {{ part.status }}
                            </span>
                            <button v-if="part.status === 'pending'" class="tool-stop-btn" @click.stop="emit('stopTool', part.callId || '')" title="停止此命令">⏹</button>
                            <span v-if="part.result && part._collapsed !== false" class="tool-result-preview">
                                {{ toolResultPreview(part.result) }}
                            </span>
                        </div>
                        <div v-if="part._collapsed === false" class="tool-call-body">
                            <div v-if="part.arguments" class="tool-call-args">
                                <pre>{{ formatArgs(part.arguments) }}</pre>
                            </div>
                            <div v-if="part.result" class="tool-call-result">
                                <div class="result-label">Result:</div>
                                <pre>{{ formatResult(part.result) }}</pre>
                            </div>
                            <div v-if="isFileModifyTool(part.toolName) && part.status === 'success'" class="tool-call-actions">
                                <button class="view-diff-btn" @click.stop="viewDiff(part)">📄 View Diff</button>
                            </div>
                        </div>
                    </div>
                </template>
                <div class="copy-row">
                    <button
                        class="copy-btn"
                        :class="{ copied: msg._copied }"
                        :title="msg._copied ? 'Copied' : 'Copy answer'"
                        @click.stop="copyMessage(msg)"
                    >{{ msg._copied ? '✓ Copied' : '📋 Copy' }}</button>
                </div>
            </div>
        </div>

        <!-- typing 指示器 — 图标 + 脉冲动画 -->
        <div v-if="typing" class="typing-indicator">
            <img :src="iconPng" class="typing-icon" alt="Celest Working" />
            <span class="typing-text">Celest is Working...</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';
import MarkdownRenderer from './MarkdownRenderer.vue';
import ThinkingBlock from './ThinkingBlock.vue';
import iconPng from '../assets/icon.png';

// Phase 4: viewDiff 通过 emit 传给父组件（App.vue），避免重复 acquireVsCodeApi
const emit = defineEmits<{
    viewDiff: [filePath: string, oldContent?: string, newContent?: string];
    openFile: [filePath: string];
    stopTool: [callId: string];
}>();

declare function acquireVsCodeApi(): any;
let vscodeApi: any = null;
try { vscodeApi = acquireVsCodeApi?.(); } catch { /* not in VS Code env */ }

/** HTML 属性转义 — 防止 XSS 注入 */
function escapeHtmlAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** HTML 文本转义 */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** 文件类型 → 图标文字 */
function fileIcon(ext: string): string {
    const map: Record<string, string> = {
        md: 'MD', ts: 'TS', tsx: 'TS', js: 'JS', jsx: 'JS',
        py: 'PY', rs: 'RS', go: 'GO', java: 'JV', c: ' C', cpp: 'C+',
        json: '{}', yaml: 'Y', yml: 'Y', toml: 'T', xml: '<>',
        html: '<>', css: '#', scss: '#', less: '#',
        svg: 'SV', png: 'PN', jpg: 'JP', gif: 'GI', ico: 'IC',
        vue: 'VU', svelte: 'SV', sh: 'SH', bat: 'BT', ps1: 'PS',
        txt: 'TX', pdf: 'PD', zip: 'ZP', lock: '🔒',
    };
    return map[ext] || ext.slice(0, 3).toUpperCase();
}

/** 从路径提取图标颜色 */
function fileColor(ext: string): string {
    if (['md','txt'].includes(ext)) return '#60a5fa';
    if (['ts','tsx','js','jsx','vue','svelte'].includes(ext)) return '#34d399';
    if (['py','rs','go','java','c','cpp','sh','bat','ps1'].includes(ext)) return '#fbbf24';
    if (['json','yaml','yml','toml','xml'].includes(ext)) return '#f472b6';
    if (['html','css','scss','less'].includes(ext)) return '#a78bfa';
    if (['png','jpg','gif','svg','ico'].includes(ext)) return '#fb923c';
    return '#6b7280';
}

/** 将文本中的 @path 替换为文件标签 HTML（已转义防 XSS） */
function renderFileChips(text: string): string {
    if (!text) return '';
    // 匹配 @ 后跟非空白字符序列（支持 / . - _ 等）
    const re = /@(\[([^\]]+)\]|([^\s]+))/g;
    return text.replace(re, (_m, _g1, bracketed: string | undefined, plain: string | undefined) => {
        const rawPath = (bracketed || plain || '').replace(/^['"]|['"]$/g, '');
        if (!rawPath) return _m;
        // 转义路径用于 HTML 属性和文本内容
        const safePath = escapeHtmlAttr(rawPath);
        const parts = rawPath.split(/[/\\]/);
        const name = parts.pop() || rawPath;
        const safeName = escapeHtml(name);
        const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
        const isDir = !ext && !name.includes('.');
        const icon = isDir ? '📁' : (ext.slice(0, 3).toUpperCase() || '?');
        return `<span class="file-chip" data-path="${safePath}" title="${safePath}"><span class="chip-icon chip-${isDir ? 'dir' : ext}">${icon}</span><span class="chip-name">${safeName}</span></span>`;
    });
}

/** 点击文件标签 → 打开文件 */
function handleChipClick(e: MouseEvent) {
    const chip = (e.target as HTMLElement).closest('.file-chip') as HTMLElement;
    if (!chip) return;
    const path = chip.dataset.path;
    if (path && vscodeApi) {
        vscodeApi.postMessage({ type: 'openFile', path });
    }
}

/** 复制 assistant 消息的文字回答 */
async function copyMessage(msg: Message) {
    const parts = msg.parts || [];
    const text = parts
        .filter(p => p.type === 'text')
        .map(p => p.content || '')
        .join('\n');
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        msg._copied = true;
        setTimeout(() => { msg._copied = false; }, 2000);
    } catch {
        // fallback for older WebView
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        msg._copied = true;
        setTimeout(() => { msg._copied = false; }, 2000);
    }
}

// ── Constants ──────────────────────────────────────────────────

let STORAGE_KEY = 'celest_messages';
let _wsSet = false;
function setStorageWorkspace(ws: string) {
    const suffix = ws ? '_' + ws.replace(/[\\/:*?"<>|]/g, '_').slice(-40) : '';
    const newKey = 'celest_messages' + suffix;
    if (STORAGE_KEY === newKey && _wsSet) return;
    STORAGE_KEY = newKey;
    _wsSet = true;
    // 工作区变更：清空并重新加载
    messages.value = [];
    loadFromStorage();
    nextTick(() => requestAnimationFrame(() => scrollToBottom(true)));
}

// ── Types ─────────────────────────────────────────────────────

export interface Message {
    role: 'user' | 'assistant';
    content?: string;
    parts?: ChatPart[];
    _copied?: boolean;
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

/** 强制创建新 assistant 消息（用于历史加载，避免合并） */
function addAssistantMessage(content: string) {
    const msg: Message = { role: 'assistant', parts: [{ type: 'text', content }] };
    messages.value.push(msg);
    scrollToBottom();
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

/** 打字机逐字追加（供 App.vue typewriter 定时器调用） */
function appendTypingChar(ch: string) { appendText(ch); }

/** 追加系统提示消息（inline 通知，不可折叠） */
function appendSystemMessage(text: string) {
    const parts = messages.value[messages.value.length - 1]?.parts;
    if (parts) {
        parts.push({ type: 'text', content: text });
    } else {
        messages.value.push({ role: 'assistant', parts: [{ type: 'text', content: text }] });
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

/** Phase 4: 更新工具调用结果，pending 状态追加而非覆盖（Shell 实时输出流） */
function updateToolResult(callId: string, result: unknown, status: 'pending' | 'success' | 'error') {
    const msg = currentAssistant();
    if (!msg?.parts) return;
    // 倒序查找匹配的 tool_call
    for (let i = msg.parts.length - 1; i >= 0; i--) {
        const part = msg.parts[i];
        if (part.type === 'tool_call' && part.callId === callId) {
            if (status === 'pending' && typeof result === 'string' && part.result) {
                // 流式追加 Shell 输出
                part.result = String(part.result) + result;
            } else {
                part.result = result;
            }
            part.status = status as 'pending' | 'success' | 'error';
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

const MAX_MESSAGES = 100;              // 最多保留 100 条消息
const MAX_MESSAGE_SIZE = 10 * 1024;    // 单条消息最大 10KB
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 总存储上限 4MB（保守值，避免接近 5MB 限制）

/** 序列化消息时裁剪大字段 */
function serializeMessages(msgs: Message[]): Message[] {
    return msgs.map(msg => {
        if (!msg.parts) return msg;
        const trimmedParts = msg.parts.map(part => {
            if (part.type === 'tool_call') {
                // 工具调用：裁剪 arguments 和 result
                const trimmed: ChatPart = { ...part };
                if (part.arguments) {
                    const argsStr = JSON.stringify(part.arguments);
                    if (argsStr.length > MAX_MESSAGE_SIZE) {
                        trimmed.arguments = { _truncated: true, preview: argsStr.slice(0, 200) + '...' };
                    }
                }
                if (part.result) {
                    const resultStr = typeof part.result === 'string' ? part.result : JSON.stringify(part.result);
                    if (resultStr.length > MAX_MESSAGE_SIZE) {
                        trimmed.result = resultStr.slice(0, MAX_MESSAGE_SIZE) + '\n... [truncated]';
                    }
                }
                return trimmed;
            }
            if (part.type === 'text' && part.content && part.content.length > MAX_MESSAGE_SIZE) {
                return { ...part, content: part.content.slice(0, MAX_MESSAGE_SIZE) + '\n... [truncated]' };
            }
            return part;
        });
        return { ...msg, parts: trimmedParts };
    });
}

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

/** 保存消息到 localStorage（防抖 500ms，含大小限制） */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveToStorage() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            let toSave = messages.value;

            // 1. 裁剪大字段
            toSave = serializeMessages(toSave);

            // 2. 限制消息数量（保留最新）
            if (toSave.length > MAX_MESSAGES) {
                toSave = toSave.slice(-MAX_MESSAGES);
            }

            // 3. 检查总大小
            const serialized = JSON.stringify(toSave);
            if (serialized.length > MAX_STORAGE_SIZE) {
                // 超限时逐条减少旧消息
                while (toSave.length > 10 && JSON.stringify(toSave).length > MAX_STORAGE_SIZE * 0.8) {
                    toSave = toSave.slice(1);
                }
            }

            if (toSave.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            // 存储满 → 尝试清理旧消息后重试
            console.warn('[ChatView] localStorage save failed, clearing old messages', e);
            try {
                const minimal = messages.value.slice(-20); // 只保留最新 20 条
                localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeMessages(minimal)));
            } catch {
                // 仍然失败 → 放弃持久化，避免阻塞 UI
                console.error('[ChatView] localStorage completely full, persistence disabled');
            }
        }
    }, 500);
}

// 监听消息变化并自动保存
watch(messages, () => saveToStorage(), { deep: true });

// 组件挂载时设置超时恢复（防止 workspaceStatus 不返回导致消息永远不加载）
onMounted(() => {
    if (!_wsSet) {
        // 3 秒后如果仍未收到 workspace，使用默认 key 加载
        setTimeout(() => {
            if (!_wsSet && messages.value.length === 0) {
                console.warn('[ChatView] workspace not received in 3s, loading from default storage');
                loadFromStorage();
                nextTick(() => requestAnimationFrame(() => scrollToBottom(true)));
            }
        }, 3000);
    }
});

// ── Helpers ───────────────────────────────────────────────────

function formatArgs(args: Record<string, unknown>): string {
    return JSON.stringify(args, null, 2);
}

function formatResult(result: unknown): string {
    if (typeof result === 'string') return result;
    return JSON.stringify(result, null, 2);
}

/** 切换工具卡片折叠状态 */
function toggleToolCard(_pIdx: number, part: any) {
    if (part._collapsed === false) {
        part._collapsed = true;  // 折叠回默认
    } else {
        part._collapsed = false; // 展开
    }
}

/** 工具结果折叠时的预览文本（最多 60 字符） */
function toolResultPreview(result: unknown): string {
    const s = typeof result === 'string' ? result : JSON.stringify(result);
    const oneLine = s.replace(/\n/g, ' ').trim();
    return oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine;
}

/** Phase 4: 文件修改类工具判断 */
function isFileModifyTool(toolName?: string): boolean {
    if (!toolName) return false;
    const modifyTools = ['write_file', 'edit_file', 'apply_patch', 'write_to_file', 'replace_in_file'];
    return modifyTools.includes(toolName);
}

/** Phase 4: 提取工具参数中的文件路径 */
function extractFilePath(args?: Record<string, unknown>): string {
    if (!args) return '';
    return String(args.path || args.filePath || args.target || args.file || '');
}

/** Phase 4: 请求打开 VS Code diff editor */
function viewDiff(part: any) {
    const filePath = extractFilePath(part.arguments);
    if (!filePath) return;
    // write_file: content = 新文件内容
    // edit_file: search + replace
    let oldContent: string | undefined;
    let newContent: string | undefined;
    const args = part.arguments || {};
    if (typeof args.content === 'string') {
        // write_file → 旧侧留空（由后端 git show 处理），新侧 = content
        newContent = args.content;
    } else if (typeof args.search === 'string' && typeof args.replace === 'string') {
        // edit_file → 展示 search → replace 的差异
        oldContent = args.search;
        newContent = args.replace;
    }
    emit('viewDiff', filePath, oldContent, newContent);
}

// ── Scroll ────────────────────────────────────────────────────

const userScrolledUp = ref(false);
const SCROLL_THRESHOLD = 50;

function onScroll() {
    const el = scrollContainer.value;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.value = dist > SCROLL_THRESHOLD;
}

function scrollToBottom(force = false) {
    if (!force && userScrolledUp.value) return;
    const doScroll = () => {
        const el = scrollContainer.value;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };
    nextTick(() => {
        doScroll();
        requestAnimationFrame(() => doScroll());
    });
}

function resetScrollState() {
    userScrolledUp.value = false;
    scrollToBottom(true);
}

// ── Exports ───────────────────────────────────────────────────

/** 将所有 pending 工具标记为 cancelled */
function cancelPendingTools() {
    for (const msg of messages.value) {
        if (!msg.parts) continue;
        for (const part of msg.parts) {
            if (part.type === 'tool_call' && part.status === 'pending') {
                part.status = 'error';
                if (!part.result) part.result = 'Cancelled by user';
            }
        }
    }
}

defineExpose({
    addUserMessage,
    addAssistantMessage,
    appendText,
    appendReasoning,
    markReasoningDone,
    addToolCall,
    updateToolResult,
    clearMessages,
    showTyping,
    hideTyping,
    appendTypingChar,
    cancelPendingTools,
    resetScrollState,
    setStorageWorkspace,
    appendSystemMessage,
});
</script>

<style scoped>
.chat-view {
    padding: 20px;
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
.empty-icon { margin-bottom: 12px; }
.empty-icon-img { width: 48px; height: 48px; }
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
.copy-row {
    display: flex;
    justify-content: flex-start;
    margin-top: 6px;
    opacity: 0;
    transition: opacity 0.15s;
}
.assistant-msg:hover .copy-row { opacity: 1; }
.copy-btn {
    background: var(--vscode-toolbar-hoverBackground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 8px;
}
.copy-btn:hover {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.copy-btn.copied {
    background: #2ea04344;
    color: #2ea043;
    border-color: #2ea04366;
}

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
    cursor: pointer;
    user-select: none;
}
.tool-collapse-icon { font-size: 10px; flex-shrink: 0; width: 12px; }
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
.tool-stop-btn {
    background: none;
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-errorForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 0 5px;
    border-radius: 3px;
    margin-left: 4px;
    line-height: 1.4;
}
.tool-stop-btn:hover {
    background: var(--vscode-inputValidation-errorBackground);
    border-color: var(--vscode-inputValidation-errorBorder);
}
.tool-result-preview {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-left: 8px;
    opacity: 0.7;
}
.tool-call-body {
    border-top: 1px solid var(--vscode-panel-border);
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
.tool-call-actions {
    padding: 6px 10px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 6px;
}
.view-diff-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
}
.view-diff-btn:hover {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

/* ── Typing 指示器 — 图标脉冲动画 ─────────────────────────── */
.typing-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    margin-bottom: 12px;
}
.typing-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    animation: typing-pulse 1.8s ease-in-out infinite;
}
@keyframes typing-pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    40% { transform: scale(1.15); opacity: 1; }
    70% { transform: scale(1.05); opacity: 0.85; }
}
.typing-text {
    font-size: 12px;
    opacity: 0.7;
    color: var(--vscode-descriptionForeground);
}

/* ── 文件标签 (File Chips) ─────────────────────────────── */
:deep(.file-chip) {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 0 4px; margin: 0 1px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px; background: var(--vscode-editor-background);
    cursor: pointer; vertical-align: middle;
    font-size: 11px; line-height: 1.6;
}
:deep(.file-chip:hover) {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-hoverBackground);
}
:deep(.chip-icon) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 2px;
    font-size: 8px; font-weight: 700; color: #fff;
    flex-shrink: 0;
}
:deep(.chip-name) {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 160px; color: var(--vscode-textLink-foreground);
}
</style>