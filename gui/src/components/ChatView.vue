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
                        :content="part.content"
                    />
                    <MarkdownRenderer
                        v-else-if="part.type === 'text'"
                        :content="part.content"
                    />
                    <div v-else-if="part.type === 'tool_call'" class="tool-call">
                        <span class="tool-icon">🔧</span>
                        <span class="tool-name">{{ part.toolName }}</span>
                        <span class="tool-status">{{ part.status }}</span>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import MarkdownRenderer from './MarkdownRenderer.vue';
import ThinkingBlock from './ThinkingBlock.vue';

export interface Message {
    role: 'user' | 'assistant';
    content?: string;
    parts?: ChatPart[];
}

export interface ChatPart {
    type: 'text' | 'thinking' | 'tool_call';
    content?: string;
    toolName?: string;
    status?: string;
}

const messages = ref<Message[]>([]);
const scrollContainer = ref<HTMLElement>();

function addUserMessage(content: string) {
    messages.value.push({ role: 'user', content });
    scrollToBottom();
}

function addAssistantPart(part: ChatPart) {
    const last = messages.value[messages.value.length - 1];
    if (!last || last.role !== 'assistant') {
        messages.value.push({ role: 'assistant', parts: [part] });
    } else {
        last.parts = last.parts || [];
        last.parts.push(part);
    }
    scrollToBottom();
}

function scrollToBottom() {
    nextTick(() => {
        if (scrollContainer.value) {
            scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
        }
    });
}

defineExpose({ addUserMessage, addAssistantPart });
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
.tool-call {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-badge-background);
    border-radius: 6px;
    margin: 4px 0;
    font-size: 12px;
}
.tool-icon { font-size: 14px; }
.tool-name { font-weight: 600; }
.tool-status { color: var(--vscode-descriptionForeground); }
</style>
