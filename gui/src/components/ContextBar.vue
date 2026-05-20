<template>
    <div class="context-bar">
        <span class="context-item">{{ modelName }}</span>
        <span class="context-sep">|</span>
        <span class="context-item">Turn {{ turnCount }}</span>
        <span class="context-sep">|</span>
        <span class="context-item">{{ sessionId?.slice(0, 8) || 'new' }}</span>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    modelName: string;
    turnCount: number;
    sessionId?: string;
}>();
</script>

<style scoped>
.context-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
    flex-shrink: 0;
    user-select: none;
}
.context-sep {
    color: var(--vscode-textSeparator-foreground);
}
.context-item {
    white-space: nowrap;
}
</style>
