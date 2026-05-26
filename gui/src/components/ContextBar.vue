<template>
    <div class="context-bar">
        <span class="context-item">{{ modelName }}</span>
        <span class="context-sep">|</span>
        <span class="context-item mode-switch" @click="$emit('cycleMode')" title="Click to switch mode">⚙ {{ modeName }}</span>
        <span class="context-sep">|</span>
        <span class="context-item">Turn {{ turnCount }}</span>
        <span class="context-sep">|</span>
        <span class="context-item" v-if="gitBranch" :title="gitBranch">⎇ {{ gitBranch }}{{ gitDirty ? '*' : '' }}</span>
        <span class="context-sep" v-if="gitBranch">|</span>
        <span class="context-item">{{ sessionId?.slice(0, 8) || 'new' }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{
    modelName: string;
    mode: string;
    turnCount: number;
    sessionId?: string;
    gitBranch?: string;
    gitDirty?: boolean;
}>();
defineEmits<{ cycleMode: [] }>();
const modeLabels: Record<string, string> = { agent: 'Agent', plan: 'Plan', yolo: 'YOLO' };
const modeName = computed(() => modeLabels[props.mode] || props.mode);
</script>

<style scoped>
.context-bar { display: flex; align-items: center; gap: 6px; padding: 4px 12px; font-size: 11px; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-sideBarSectionHeader-border); flex-shrink: 0; user-select: none; }
.context-sep { color: var(--vscode-textSeparator-foreground); }
.context-item { white-space: nowrap; }
.mode-switch { cursor: pointer; color: var(--vscode-textLink-foreground); }
.mode-switch:hover { text-decoration: underline; }
</style>
