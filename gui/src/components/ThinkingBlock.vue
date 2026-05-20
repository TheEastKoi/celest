<template>
    <div class="thinking-block">
        <div class="thinking-summary" @click="expanded = !expanded">
            <span class="thinking-label">🧠 Thinking</span>
            <span v-if="!expanded" class="thinking-preview">{{ preview }}</span>
            <span v-else class="thinking-hint">click to collapse</span>
        </div>
        <div v-show="expanded" class="thinking-content">
            <MarkdownRenderer :content="content" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import MarkdownRenderer from './MarkdownRenderer.vue';

const props = defineProps<{ content: string }>();
const expanded = ref(false);
const preview = computed(() => props.content.slice(0, 80).replace(/\n/g, ' ') + '...');
</script>

<style scoped>
.thinking-block {
    margin: 6px 0;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    overflow: hidden;
}
.thinking-summary {
    padding: 6px 10px;
    background: var(--vscode-textBlockQuote-background);
    cursor: pointer;
    font-size: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    user-select: none;
}
.thinking-label { font-weight: 600; white-space: nowrap; }
.thinking-preview {
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}
.thinking-hint {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    opacity: 0.6;
    margin-left: auto;
}
.thinking-content {
    padding: 10px;
    font-size: 12px;
    opacity: 0.85;
}
</style>
