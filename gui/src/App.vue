<template>
    <div class="celest-app">
        <header class="app-header">
            <span class="app-title">🌙 Celest</span>
        </header>

        <main class="chat-area">
            <ChatView ref="chatRef" />
        </main>

        <footer class="input-area">
            <InputBox @send="handleSend" :disabled="promptRunning" />
        </footer>

        <ContextBar />
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

function handleSend(prompt: string) {
    chatRef.value?.addUserMessage(prompt);
    promptRunning.value = true;
    vscode?.postMessage({ type: 'sendPrompt', prompt });
}

// 监听来自扩展主机的消息
onMounted(() => {
    window.addEventListener('message', (e) => {
        const msg = e.data;
        switch (msg.type) {
            case 'tuiEvent':
                if (msg.event === 'sessionUpdate' && msg.update?.content?.text) {
                    chatRef.value?.addAssistantPart({
                        type: 'text',
                        content: msg.update.content.text,
                    });
                }
                break;
            case 'promptStarted':
                promptRunning.value = true;
                break;
            case 'promptEnded':
                promptRunning.value = false;
                break;
            case 'promptError':
                promptRunning.value = false;
                chatRef.value?.addAssistantPart({
                    type: 'text',
                    content: `⚠️ Error: ${msg.error}`,
                });
                break;
            case 'clearChat':
                // ChatView exposed methods handle clear
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
