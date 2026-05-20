<template>
    <div class="input-box">
        <textarea
            ref="inputRef"
            v-model="inputText"
            class="prompt-input"
            placeholder="Ask anything... (@ to reference files, / for commands)"
            rows="3"
            :disabled="disabled"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact.prevent="handleNewline"
            @input="handleInput"
        ></textarea>
        <div class="input-actions">
            <span class="input-hint">Enter to send, Shift+Enter for newline</span>
            <div class="input-buttons">
                <button
                    v-if="showStop"
                    class="stop-btn"
                    @click="handleStop"
                    title="Stop generation"
                >
                    ⏹ Stop
                </button>
                <button class="send-btn" @click="handleSend" :disabled="!inputText.trim() || disabled">
                    Send
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = defineProps<{
    disabled?: boolean;
    showStop?: boolean;
}>();

const emit = defineEmits<{
    send: [prompt: string];
    stop: [];
}>();

const inputText = ref('');
const inputRef = ref<HTMLTextAreaElement>();

function handleSend() {
    const text = inputText.value.trim();
    if (!text || props.disabled) return;
    emit('send', text);
    inputText.value = '';
    // 发送后重置 textarea 高度
    nextTick(() => resetHeight());
}

function handleStop() {
    emit('stop');
}

function handleNewline() {
    const el = inputRef.value;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    inputText.value = inputText.value.slice(0, start) + '\n' + inputText.value.slice(end);
    // 恢复光标位置
    nextTick(() => {
        el.selectionStart = el.selectionEnd = start + 1;
    });
}

function resetHeight() {
    const el = inputRef.value;
    if (el) {
        el.style.height = 'auto';
    }
}

function handleInput() {
    // 自动调整高度
    const el = inputRef.value;
    if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
    // Phase 3: 检测 @ 和 / 触发下拉菜单
    const cursor = el?.selectionStart || 0;
    const before = inputText.value.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    const slashMatch = before.match(/\/(\w*)$/);
    if (atMatch) {
        console.log('[Celest] @ mention:', atMatch[1]); // eslint-disable-line
    }
    if (slashMatch) {
        console.log('[Celest] / command:', slashMatch[1]); // eslint-disable-line
    }
}
</script>

<style scoped>
.input-box {
    padding: 10px 12px 8px;
}
.prompt-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
    box-sizing: border-box;
    min-height: 80px;
    max-height: 200px;
}
.prompt-input:focus {
    border-color: var(--vscode-focusBorder);
}
.prompt-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
}
.input-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    user-select: none;
}
.input-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
}
.stop-btn {
    background: #f85149;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
}
.stop-btn:hover {
    background: #ff6b5e;
}
.send-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 6px;
    padding: 6px 18px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
}
.send-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.send-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
