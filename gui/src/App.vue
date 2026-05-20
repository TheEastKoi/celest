<template>
    <div class="celest-app">
        <header class="app-header">
            <span class="app-title">🌙 Celest</span>
            <div class="header-actions">
                <button class="header-btn" @click="handleClearChat" title="Clear chat">🗑</button>
                <button class="header-btn" @click="handleNewWindow" title="Open in new window">↗</button>
            </div>
        </header>

        <main class="chat-area">
            <ChatView ref="chatRef" />
        </main>

        <footer class="input-area">
            <div v-if="!tuiReady" class="connecting-banner">
                Connecting to DeepSeek TUI...
            </div>
            <InputBox
                @send="handleSend"
                @stop="handleStop"
                :disabled="!tuiReady"
                :showStop="promptRunning"
            />
        </footer>

        <ContextBar
            :modelName="modelName"
            :turnCount="turnCount"
            :sessionId="sessionId"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ChatView from './components/ChatView.vue';
import InputBox from './components/InputBox.vue';
import ContextBar from './components/ContextBar.vue';

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi?.();

const chatRef = ref<InstanceType<typeof ChatView>>();
const promptRunning = ref(false);
const tuiReady = ref(false);
const modelName = ref('deepseek-v4-flash');
const turnCount = ref(0);
const sessionId = ref<string>('connecting');

// ── 模拟打字机效果（fallback：当 TUI 一次性返回完整文本时） ──
let typewriterTimer: ReturnType<typeof setInterval> | null = null;
let typewriterQueue: string[] = [];
const TYPEWRITER_SPEED = 15; // ms per chunk (约 3-4 字符)

function startTypewriter(text: string) {
    stopTypewriter();
    // 按字符分块（每次约 2-4 字符，模拟人类打字速度）
    let i = 0;
    typewriterQueue = [];
    while (i < text.length) {
        const chunkSize = 2 + Math.floor(Math.random() * 3); // 2-4 chars
        typewriterQueue.push(text.slice(i, i + chunkSize));
        i += chunkSize;
    }
    typewriterTimer = setInterval(() => {
        if (typewriterQueue.length === 0) {
            stopTypewriter();
            return;
        }
        const chunk = typewriterQueue.shift()!;
        chatRef.value?.appendText(chunk);
    }, TYPEWRITER_SPEED);
}

function stopTypewriter() {
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
    }
    typewriterQueue = [];
}

// ── promptRunning 兜底超时（3 分钟无响应自动恢复） ──
let promptWatchdog: ReturnType<typeof setTimeout> | null = null;

function resetPromptWatchdog() {
    if (promptWatchdog) clearTimeout(promptWatchdog);
    if (promptRunning.value) {
        promptWatchdog = setTimeout(() => {
            if (promptRunning.value) {
                console.warn('[Celest] promptRunning stuck > 3 min, auto-resetting');
                promptRunning.value = false;
                stopTypewriter();
            }
        }, 180_000); // 3 分钟
    }
}

// ── 消息发送 ──

function handleSend(prompt: string) {
    chatRef.value?.addUserMessage(prompt);
    chatRef.value?.showTyping();
    promptRunning.value = true;
    resetPromptWatchdog();
    vscode?.postMessage({ type: 'sendPrompt', prompt });
}

function handleStop() {
    stopTypewriter();
    chatRef.value?.hideTyping();
    vscode?.postMessage({ type: 'cancelPrompt' });
}

function handleClearChat() {
    chatRef.value?.clearMessages();
}

function handleNewWindow() {
    vscode?.postMessage({ type: 'openNewWindow' });
}

// ── WebView 消息路由 ──────────────────────────────────────────

onMounted(() => {
    window.addEventListener('message', (e) => {
        const msg = e.data;
        switch (msg.type) {
            // ── 连接状态 ──
            case 'tuiConnected':
                tuiReady.value = true;
                sessionId.value = msg.sessionId || 'connected';
                break;

            // ── 文本增量 (打字机) ──
            case 'tuiText':
                chatRef.value?.hideTyping();
                // 首次文本到达 → 启动打字机效果
                if (!typewriterTimer) {
                    stopTypewriter();
                    startTypewriter(msg.text);
                }
                break;

            // ── 一次性完整文本（fallback 流式） ──
            case 'tuiTextFull':
                chatRef.value?.hideTyping();
                stopTypewriter();
                startTypewriter(msg.text);
                break;

            // ── Reasoning 增量 ──
            case 'tuiReasoning':
                chatRef.value?.hideTyping();
                chatRef.value?.appendReasoning(msg.reasoning);
                break;

            // ── 工具调用 ──
            case 'tuiToolCall':
                chatRef.value?.addToolCall(
                    msg.toolCall?.name || 'unknown',
                    msg.toolCall?.arguments,
                    msg.toolCall?.callId,
                );
                break;

            // ── 工具结果 ──
            case 'tuiToolResult':
                chatRef.value?.updateToolResult(
                    msg.toolResult?.callId || '',
                    msg.toolResult?.output ?? msg.toolResult?.error,
                    msg.toolResult?.status === 'error' ? 'error' : 'success',
                );
                break;

            // ── 回合控制 ──
            case 'promptStarted':
                promptRunning.value = true;
                resetPromptWatchdog();
                turnCount.value++;
                break;
            case 'promptEnded':
                promptRunning.value = false;
                if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; }
                // 等待模拟打字机完成（如有）
                if (typewriterTimer) {
                    // 让打字机继续跑完，typing 由打字机结束时的 stopTypewriter 隐藏
                } else {
                    chatRef.value?.hideTyping();
                }
                break;
            case 'promptError':
                promptRunning.value = false;
                if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; }
                stopTypewriter();
                chatRef.value?.hideTyping();
                chatRef.value?.appendText(`\n\n⚠️ **Error:** ${msg.error}`);
                break;

            // ── 旧版回退 ──
            case 'tuiEvent':
                if (msg.event === 'sessionUpdate' && msg.update?.content?.text) {
                    chatRef.value?.hideTyping();
                    // 一次性文本 → 模拟打字机
                    stopTypewriter();
                    startTypewriter(msg.update.content.text);
                }
                break;

            // ── 会话控制 ──
            case 'clearChat':
                chatRef.value?.clearMessages();
                break;
            case 'newSession':
                turnCount.value = 0;
                break;

            // ── TUI 状态 ──
            case 'tuiStatus':
                if (msg.status === 'restarting') {
                    tuiReady.value = false;
                } else if (msg.status === 'connected') {
                    tuiReady.value = true;
                }
                break;
            case 'tuiCrashed':
                tuiReady.value = false;
                promptRunning.value = false;
                if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; }
                stopTypewriter();
                chatRef.value?.appendText(`\n\n⚠️ **TUI crashed:** ${msg.message || 'Unknown error'}`);
                break;
        }
    });

    vscode?.postMessage({ type: 'ready' });
});
</script>

<style scoped>
.celest-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}
.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}
.header-actions {
    display: flex;
    gap: 2px;
}
.header-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 4px;
    line-height: 1;
}
.header-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-foreground);
}
.chat-area {
    flex: 1;
    overflow-y: auto;
}
.input-area {
    flex-shrink: 0;
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
}
.connecting-banner {
    padding: 8px 12px;
    font-size: 12px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-textBlockQuote-background);
}
</style>
