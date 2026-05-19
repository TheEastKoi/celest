<template>
    <div class="celest-app">
        <header class="app-header">
            <span class="app-title">🌙 Celest</span>
        </header>

        <main class="chat-area">
            <ChatView ref="chatRef" />
        </main>

        <footer class="input-area">
            <InputBox @send="handleSend" />
        </footer>

        <ContextBar />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ChatView from './components/ChatView.vue';
import InputBox from './components/InputBox.vue';
import ContextBar from './components/ContextBar.vue';

const chatRef = ref<InstanceType<typeof ChatView>>();

function handleSend(prompt: string) {
    chatRef.value?.addUserMessage(prompt);
    // Phase 2: 通过 vscode.postMessage 转发给 TUI 后端
    window.vscode?.postMessage({ type: 'sendPrompt', prompt });
}
</script>

<style scoped>
.celest-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}
.app-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}
.chat-area {
    flex: 1;
    overflow-y: auto;
}
.input-area {
    flex-shrink: 0;
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
}
</style>
