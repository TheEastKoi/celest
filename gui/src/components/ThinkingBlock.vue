<template>
    <details class="thinking-block" :open="expanded">
        <summary class="thinking-summary" @click.prevent="expanded = !expanded">
            <span class="thinking-label">🧠 Thinking</span>
            <span class="thinking-preview">{{ preview }}</span>
        </summary>
        <div class="thinking-content">
            <MarkdownRenderer :content="content" />
        </div>
    </details>
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
}
.thinking-content {
    padding: 10px;
    font-size: 12px;
    opacity: 0.85;
}
</style>
