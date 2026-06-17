<template>
    <div class="context-bar">
        <select class="model-select" :value="modelId" @change="$emit('switchModel', ($event.target as HTMLSelectElement).value)" title="Switch model">
            <option v-for="m in availableModels" :key="m.id" :value="m.id" :disabled="isModelDisabled(m.id)">{{ m.name }}{{ isModelDisabled(m.id) ? ' 🔒' : '' }}</option>
        </select>
        <span class="context-sep">|</span>
        <!-- Bug 4: 彩色模式徽标 -->
        <span class="mode-badge" :class="'mode-' + mode" @click="$emit('cycleMode')" :title="modeTitle">{{ modeIcon }} {{ modeName }}</span>
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
    providerApiKeys: Record<string, boolean>;
    mode: string;
    turnCount: number;
    sessionId?: string;
    gitBranch?: string;
    gitDirty?: boolean;
}>();
defineEmits<{ cycleMode: []; switchModel: [modelId: string]; openSettings: [] }>();

const modeLabels: Record<string, string> = { agent: 'Agent', plan: 'Plan', yolo: 'YOLO' };
const modeIcons: Record<string, string> = { agent: '🟢', plan: '🔵', yolo: '🔴' };
const modeDescs: Record<string, string> = {
    agent: 'Agent 模式 — AI 可使用工具读写文件和执行命令',
    plan: 'Plan 模式 — 只读探索和设计，不可执行 shell',
    yolo: 'YOLO 模式 — 自动批准所有工具调用，跳过审批',
};
const modeName = computed(() => modeLabels[props.mode] || props.mode);
const modeIcon = computed(() => modeIcons[props.mode] || '⚙');
const modeTitle = computed(() => modeDescs[props.mode] || '点击切换模式');

/** 无需 API Key 的本地 Provider */
const NO_KEY_PROVIDERS = new Set(['ollama']);

function isModelDisabled(_modelId: string): boolean {
    // Bug 7: 安全检查 — 使用可选链防止空数组/缺少 provider 字段崩溃
    if (props.availableModels.length === 0) return false;
    const provider = (props.availableModels[0] as any)?.provider;
    if (!provider || NO_KEY_PROVIDERS.has(provider)) return false;
    return !props.providerApiKeys[provider];
}
</script>

<style scoped>
.context-bar { display: flex; align-items: center; gap: 4px; padding: 4px 12px; font-size: 11px; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-sideBarSectionHeader-border); flex-shrink: 0; user-select: none; }
.context-sep { color: var(--vscode-textSeparator-foreground); }
.context-item { white-space: nowrap; }
.mode-switch { cursor: pointer; color: var(--vscode-textLink-foreground); }
.mode-switch:hover { text-decoration: underline; }
.mode-badge { cursor: pointer; white-space: nowrap; font-weight: 600; padding: 1px 6px; border-radius: 4px; font-size: 11px; letter-spacing: 0.3px; }
.mode-badge.mode-agent { color: #2ea043; background: rgba(46,160,67,0.12); }
.mode-badge.mode-plan { color: #58a6ff; background: rgba(88,166,255,0.12); }
.mode-badge.mode-yolo { color: #f85149; background: rgba(248,81,73,0.12); }
.mode-badge:hover { filter: brightness(1.2); }
.model-select { padding: 1px 3px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; font-size: 11px; cursor: pointer; max-width: 110px; }
.model-select:focus { outline: none; border-color: var(--vscode-focusBorder); }
</style>
