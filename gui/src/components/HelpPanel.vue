<template>
    <div v-if="sections.length > 0" class="right-panel">
        <div class="panel-header" @click="open = !open">
            <span>{{ open ? '▼' : '▶' }}</span>
            <span>❓ Help</span>
            <span class="panel-badge">{{ commandCount }} 命令 | {{ keyCount }} 快捷键</span>
        </div>
        <div v-show="open" class="panel-body">
            <div class="help-view">
                <div v-for="cat in sections" :key="cat.title" class="help-section">
                    <div class="help-section-title" :style="{ borderLeftColor: cat.color }">{{ cat.title }}</div>
                    <table class="help-table">
                        <tbody v-for="cmd in cat.commands" :key="cmd.names[0]" class="cmd-group">
                            <tr v-for="(n, i) in cmd.names" :key="i">
                                <td class="help-key">{{ cmd.usage && i === 0 ? '/' : '' }}{{ n }}</td>
                                <td v-if="i === 0" :rowspan="cmd.names.length" class="help-desc">{{ cmd.desc }}</td>
                                <td v-if="i === 0" :rowspan="cmd.names.length" class="help-usage">{{ cmd.usage }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getHelpSections, SLASH_COMMANDS, type HelpSection } from '../helpData';

const sections = ref<HelpSection[]>([]);
const open = ref(true);

const commandCount = computed(() => SLASH_COMMANDS.length);
const keyCount = computed(() => {
    const sec = sections.value.find(s => s.title.includes('Keybindings'));
    return sec ? sec.commands.length : 0;
});

function show() {
    sections.value = getHelpSections();
    open.value = true;
}

onMounted(() => { sections.value = getHelpSections(); });

defineExpose({ show });
</script>

<style scoped>
.right-panel { border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.right-panel:last-child { border-bottom: none; }
.panel-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; background: var(--vscode-sideBar-background); }
.panel-header:hover { background: var(--vscode-list-hoverBackground); }
.panel-body { max-height: 300px; overflow-y: auto; }
.panel-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 10px; padding: 0 5px; border-radius: 8px; min-width: 16px; text-align: center; line-height: 15px; margin-left: auto; }

.help-view { padding: 6px 0; }
.help-section { padding: 0; }
.help-section-title { padding: 6px 10px; font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; background: var(--vscode-sideBar-background); border-left: 3px solid var(--vscode-focusBorder); }
.help-table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; } .help-table tbody.cmd-group { border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.help-table td { padding: 4px 6px; vertical-align: middle; }

.help-table tr:hover td { background: var(--vscode-list-hoverBackground); }
.help-key { font-family: var(--vscode-editor-font-family, monospace); color: #60a5fa; font-weight: 600; width: 33.33%; }
.help-desc { vertical-align: middle !important; width: 33.33%; }
.help-usage { color: var(--vscode-descriptionForeground); font-size: 10px; width: 33.33%; vertical-align: middle !important; }
</style>
