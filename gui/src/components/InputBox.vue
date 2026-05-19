<template>
    <div class="input-box">
        <textarea
            ref="inputRef"
            v-model="inputText"
            class="prompt-input"
            placeholder="Ask anything... (@ to reference files, / for commands)"
            rows="2"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="inputText += '\n'"
            @input="handleInput"
        ></textarea>
        <button class="send-btn" @click="handleSend" :disabled="!inputText.trim()">
            Send
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
    send: [prompt: string];
}>();

const inputText = ref('');
const inputRef = ref<HTMLTextAreaElement>();

function handleSend() {
    const text = inputText.value.trim();
    if (!text) return;
    emit('send', text);
    inputText.value = '';
}

function handleInput() {
    // Phase 3: 检测 @ 和 / 触发下拉菜单
    const cursor = inputRef.value?.selectionStart || 0;
    const before = inputText.value.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    const slashMatch = before.match(/\/(\w*)$/);
    if (atMatch) {
        console.log('[Celest] @ mention:', atMatch[1]);
    }
    if (slashMatch) {
        console.log('[Celest] / command:', slashMatch[1]);
    }
}
</script>

<style scoped>
.input-box {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
}
.prompt-input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    resize: none;
    outline: none;
}
.prompt-input:focus {
    border-color: var(--vscode-focusBorder);
}
.send-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
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
