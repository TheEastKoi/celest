<template>
    <div v-if="visible" class="at-mention-popup">
        <div class="popup-header">Mention files</div>
        <div class="popup-list" ref="listRef">
            <div
                v-for="(item, idx) in filteredItems"
                :key="item.path"
                class="popup-item"
                :class="{ active: idx === selectedIdx }"
                @click="select(item)"
                @mouseenter="selectedIdx = idx"
                :title="item.relativePath"
            >
                <span class="item-icon" :class="iconClass(item)" :style="iconStyle(item)">{{ iconLabel(item) }}</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-path">{{ item.relativePath }}</span>
            </div>
            <div v-if="filteredItems.length === 0" class="popup-empty">
                No matching files
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

export interface FileItem {
    name: string;
    relativePath: string;
    path: string;
    isDir?: boolean;
}

const props = defineProps<{
    visible: boolean;
    filterText: string;
    items: FileItem[];
}>();

const emit = defineEmits<{
    select: [item: FileItem];
    close: [];
}>();

const selectedIdx = ref(0);
const listRef = ref<HTMLElement>();

const filteredItems = computed(() => {
    const q = props.filterText.toLowerCase();
    if (!q) return props.items.slice(0, 20);
    return props.items
        .filter(f =>
            f.name.toLowerCase().includes(q) ||
            f.relativePath.toLowerCase().includes(q)
        )
        .slice(0, 20);
});

watch(() => props.filterText, () => { selectedIdx.value = 0; });
watch(selectedIdx, () => {
    nextTick(() => {
        const el = listRef.value?.querySelector('.popup-item.active') as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
    });
});

function ext(file: FileItem): string {
    if (file.isDir) return '';
    return file.name.split('.').pop()?.toLowerCase() || '';
}

function iconLabel(file: FileItem): string {
    if (file.isDir) return '📁';
    const e = ext(file);
    if (!e) return '?';
    return e.slice(0, 3).toUpperCase();
}

function iconClass(file: FileItem): string {
    if (file.isDir) return 'icon-dir';
    return 'icon-file';
}

const iconColors: Record<string, string> = {
    md:'#60a5fa', ts:'#34d399', tsx:'#34d399', js:'#34d399', jsx:'#34d399',
    py:'#fbbf24', rs:'#fbbf24', go:'#fbbf24', java:'#fbbf24',
    json:'#f472b6', yaml:'#f472b6', yml:'#f472b6', toml:'#f472b6',
    html:'#a78bfa', css:'#a78bfa', scss:'#a78bfa',
    vue:'#34d399', svelte:'#34d399', sh:'#fbbf24', bat:'#fbbf24',
    png:'#fb923c', jpg:'#fb923c', gif:'#fb923c', svg:'#fb923c',
    txt:'#60a5fa', pdf:'#f87171', lock:'#6b7280',
};
function iconStyle(file: FileItem): Record<string, string> {
    if (file.isDir) return { background: '#fbbf24', color: '#fff' };
    const c = iconColors[ext(file)] || '#6b7280';
    return { background: c, color: '#fff' };
}

function select(item: FileItem) { emit('select', item); }

function moveSelection(delta: number) {
    const max = filteredItems.value.length - 1;
    selectedIdx.value = Math.max(0, Math.min(max, selectedIdx.value + delta));
}

function getSelected(): FileItem | null {
    const list = filteredItems.value;
    if (list.length === 0) return null;
    return list[selectedIdx.value] || list[0];
}

defineExpose({ moveSelection, getSelected, selectedIdx });
</script>

<style scoped>
.at-mention-popup {
    position: absolute; bottom: 100%; left: 0; right: 0;
    margin-bottom: 4px; max-height: 240px; display: flex; flex-direction: column;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 100;
}
.popup-header {
    padding: 4px 10px; font-weight: 600; font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-dropdown-border);
    flex-shrink: 0;
}
.popup-list { flex: 1; overflow-y: auto; padding: 2px 0; }
.popup-item {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px; cursor: pointer; font-size: 12px;
}
.popup-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.popup-item:hover { background: var(--vscode-list-hoverBackground); }
.item-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 3px;
    font-size: 8px; font-weight: 700; flex-shrink: 0;
}
.icon-dir { font-size: 13px; }
.icon-file { font-size: 8px; }
.item-name { font-weight: 500; flex-shrink: 0; white-space: nowrap; }
.item-path {
    color: var(--vscode-descriptionForeground); opacity: 0.7;
    font-size: 10px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; margin-left: auto; padding-left: 8px;
}
.popup-empty { padding: 16px 12px; text-align: center; color: var(--vscode-descriptionForeground); font-style: italic; }
</style>
