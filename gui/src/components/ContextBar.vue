<template>
    <div class="context-bar">
        <select class="model-select" :value="modelId" @change="$emit('switchModel', ($event.target as HTMLSelectElement).value)" title="Switch model">
            <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
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

interface ModelOption { id: string; name: string; }

const props = defineProps<{
    modelId: string;
    availableModels: ModelOption[];
    mode: string;
    turnCount: number;
    sessionId?: string;
    gitBranch?: string;
    gitDirty?: boolean;
}>();
defineEmits<{ cycleMode: []; switchModel: [modelId: string] }>();

const modeLabels: Record<string, string> = { agent: 'Agent', plan: 'Plan', yolo: 'YOLO' };
const modeName = computed(() => modeLabels[props.mode] || props.mode);
</script>

<style scoped>
.context-bar { display: flex; align-items: center; gap: 6px; padding: 4px 12px; font-size: 11px; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-sideBarSectionHeader-border); flex-shrink: 0; user-select: none; }
.context-sep { color: var(--vscode-textSeparator-foreground); }
.context-item { white-space: nowrap; }
.mode-switch { cursor: pointer; color: var(--vscode-textLink-foreground); }
.mode-switch:hover { text-decoration: underline; }
.model-select { padding: 1px 3px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; font-size: 11px; cursor: pointer; max-width: 110px; }
.model-select:focus { outline: none; border-color: var(--vscode-focusBorder); }
</style>
