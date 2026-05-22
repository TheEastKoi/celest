<template>
    <div v-if="visible" class="at-mention-popup">
        <div class="popup-header">Mention files</div>
        <ul class="popup-list" ref="listRef">
            <li
                v-for="(item, idx) in filteredItems"
                :key="item.path"
                class="popup-item"
                :class="{ active: idx === selectedIdx }"
                @click="select(item)"
                @mouseenter="selectedIdx = idx"
            >
                <span class="item-icon">{{ item.isDir ? '📁' : '📄' }}</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-path">{{ item.relativePath }}</span>
            </li>
            <li v-if="filteredItems.length === 0" class="popup-empty">
                No matching files
            </li>
        </ul>
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

watch(() => props.filterText, () => {
    selectedIdx.value = 0;
});

watch(selectedIdx, () => {
    nextTick(() => {
        const el = listRef.value?.querySelector('.popup-item.active') as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
    });
});

function select(item: FileItem) {
    emit('select', item);
}

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
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 4px;
    max-height: 220px;
    overflow-y: auto;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 100;
    font-size: 12px;
}
.popup-header {
    padding: 6px 10px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-dropdown-border);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.popup-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    max-height: 180px;
    overflow-y: auto;
}
.popup-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
}
.popup-item.active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.popup-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.item-icon { flex-shrink: 0; font-size: 13px; }
.item-name { font-weight: 500; flex-shrink: 0; }
.item-path {
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: auto;
    padding-left: 8px;
}
.popup-empty {
    padding: 16px 12px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
</style>
