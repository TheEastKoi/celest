<template>
    <div v-if="visible" class="slash-popup" ref="popupRef">
        <div class="popup-title">Commands ({{ filteredCmds.length }} of {{ commands.length }})</div>
        <div class="popup-list" ref="listRef">
            <div v-for="(cmd, i) in filteredCmds" :key="cmd.name"
                class="cmd-row" :class="{ selected: i === selectedIdx }"
                @click="emitSelect(cmd)">
                <span class="cmd-name">/{{ cmd.name }}</span>
                <span class="cmd-zh" v-if="cmd.zhName">{{ cmd.zhName }}</span>
                <span class="cmd-desc">{{ cmd.description }}</span>
                <span class="cmd-cat">{{ categoryLabel(cmd.category) }}</span>
            </div>
            <div v-if="filteredCmds.length === 0" class="no-match">No matching commands</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { SLASH_COMMANDS, type SlashCommand } from '../helpData';

const props = defineProps<{ visible: boolean; filterText: string }>();
const emit = defineEmits<{ select: [cmd: SlashCommand]; close: [] }>();

const commands = SLASH_COMMANDS;
const selectedIdx = ref(0);
const popupRef = ref<HTMLElement>();
const listRef = ref<HTMLElement>();

const filteredCmds = computed(() => {
    const q = props.filterText.toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
        c.name.includes(q) || c.zhName.includes(q) || c.description.toLowerCase().includes(q)
    );
});

const labels: Record<string, string> = {
    core: 'Core', session: 'Session', debug: 'Debug', tools: 'Tools', config: 'Config', other: 'Other',
};
function categoryLabel(cat: string) { return labels[cat] || cat; }

watch(() => props.visible, async (v) => {
    if (v) { selectedIdx.value = 0; await nextTick(); }
});

watch(() => props.filterText, () => { selectedIdx.value = 0; });

function emitSelect(cmd: SlashCommand) { emit('select', cmd); }

defineExpose({
    moveUp() {
        if (filteredCmds.value.length === 0) return;
        selectedIdx.value = (selectedIdx.value - 1 + filteredCmds.value.length) % filteredCmds.value.length;
        listRef.value?.children[selectedIdx.value]?.scrollIntoView({ block: 'nearest' });
    },
    moveDown() {
        if (filteredCmds.value.length === 0) return;
        selectedIdx.value = (selectedIdx.value + 1) % filteredCmds.value.length;
        listRef.value?.children[selectedIdx.value]?.scrollIntoView({ block: 'nearest' });
    },
    getSelected(): SlashCommand | null {
        return filteredCmds.value[selectedIdx.value] || null;
    },
});
</script>

<style scoped>
.slash-popup {
    position: absolute; bottom: 100%; left: 0; right: 0;
    max-height: 280px; display: flex; flex-direction: column;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    z-index: 100;
}
.popup-title {
    padding: 4px 10px; font-size: 11px; flex-shrink: 0;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
}
.popup-list {
    flex: 1; overflow-y: auto; padding: 2px 0;
}
.cmd-row {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px; cursor: pointer; font-size: 12px;
}
.cmd-row:hover, .cmd-row.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.cmd-name {
    width: 90px; flex-shrink: 0; font-weight: 600;
    color: var(--vscode-textLink-foreground); white-space: nowrap;
}
.cmd-zh {
    width: 48px; flex-shrink: 0; font-size: 11px;
    color: var(--vscode-descriptionForeground); white-space: nowrap;
}
.cmd-desc { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-cat {
    width: 44px; flex-shrink: 0; text-align: center; font-size: 10px;
    padding: 0 2px; border-radius: 2px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}
.no-match { padding: 10px; text-align: center; color: var(--vscode-descriptionForeground); }
</style>
