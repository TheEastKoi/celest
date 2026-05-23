<template>
    <div v-if="visible" class="slash-popup" ref="popupRef">
        <div class="popup-title">Commands ({{ filteredCmds.length }} of {{ COMMANDS.length }})</div>
        <ul class="popup-list" ref="listRef">
            <li v-for="(cmd, i) in filteredCmds" :key="cmd.name" :class="{ selected: i === selectedIdx }" @click="emitSelect(cmd)">
                <span class="cmd-name">/{{ cmd.name }}</span>
                <span class="cmd-zh" v-if="cmd.zhName">({{ cmd.zhName }})</span>
                <span class="cmd-desc">{{ cmd.description }}</span>
                <span class="cmd-cat">{{ cmd.category }}</span>
            </li>
            <li v-if="filteredCmds.length === 0" class="no-match">No matching commands</li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

export interface SlashCommand {
    name: string;
    description: string;
    category: string;
    zhName?: string;
}

const COMMANDS: SlashCommand[] = [
    { name: 'agent', zhName: '子代理', description: 'Run sub-agent', category: 'core' },
    { name: 'anchor', zhName: '锚点', description: 'Add anchors', category: 'core' },
    { name: 'attach', zhName: '附加', description: 'Attach file/image', category: 'core' },
    { name: 'cache', zhName: '缓存', description: 'Cache stats', category: 'debug' },
    { name: 'change', zhName: '变更', description: 'Changelog', category: 'debug' },
    { name: 'clear', zhName: '清屏', description: 'Clear conversation', category: 'core' },
    { name: 'compact', zhName: '压缩', description: 'Compact context', category: 'session' },
    { name: 'config', zhName: '配置', description: 'Open config', category: 'config' },
    { name: 'context', zhName: '上下文', description: 'Context usage', category: 'debug' },
    { name: 'cost', zhName: '费用', description: 'Cost estimate', category: 'debug' },
    { name: 'cycle', zhName: '周期', description: 'Show a specific cycle', category: 'session' },
    { name: 'cycles', zhName: '周期列表', description: 'Compression cycles', category: 'session' },
    { name: 'diff', zhName: '差异', description: 'Latest diff', category: 'debug' },
    { name: 'edit', zhName: '编辑', description: 'Open last file', category: 'debug' },
    { name: 'exit', zhName: '退出', description: 'Exit TUI (CLI)', category: 'other' },
    { name: 'export', zhName: '导出', description: 'Export as markdown', category: 'session' },
    { name: 'feedback', zhName: '反馈', description: 'Submit feedback', category: 'project' },
    { name: 'fork', zhName: '分支', description: 'Fork session', category: 'session' },
    { name: 'goal', zhName: '目标', description: 'Set session goal', category: 'project' },
    { name: 'help', zhName: '帮助', description: 'Show this help', category: 'core' },
    { name: 'home', zhName: '首页', description: 'Home dashboard', category: 'core' },
    { name: 'hooks', zhName: '钩子', description: 'Manage hooks', category: 'tools' },
    { name: 'init', zhName: '初始化', description: 'Init project instructions', category: 'project' },
    { name: 'jobs', zhName: '作业', description: 'Background jobs', category: 'tools' },
    { name: 'links', zhName: '链接', description: 'Dashboard & API links', category: 'core' },
    { name: 'load', zhName: '加载', description: 'Load session', category: 'session' },
    { name: 'logout', zhName: '登出', description: 'Log out provider', category: 'config' },
    { name: 'lsp', zhName: '语言服务', description: 'LSP integration', category: 'tools' },
    { name: 'mcp', zhName: 'MCP', description: 'MCP servers', category: 'tools' },
    { name: 'memory', zhName: '记忆', description: 'Agent memory', category: 'tools' },
    { name: 'mode', zhName: '模式', description: 'Switch mode', category: 'core' },
    { name: 'model', zhName: '模型', description: 'Switch AI model', category: 'core' },
    { name: 'models', zhName: '模型列表', description: 'List models', category: 'core' },
    { name: 'network', zhName: '网络', description: 'Network permissions', category: 'tools' },
    { name: 'note', zhName: '笔记', description: 'Persistent notes', category: 'tools' },
    { name: 'profile', zhName: '配置', description: 'Profile management', category: 'other' },
    { name: 'provider', zhName: '供应商', description: 'Switch provider', category: 'core' },
    { name: 'queue', zhName: '队列', description: 'Queued prompts', category: 'core' },
    { name: 'recall', zhName: '回忆', description: 'Search compressed context', category: 'session' },
    { name: 'relay', zhName: '接力', description: 'Relay to fresh agent', category: 'session' },
    { name: 'rename', zhName: '重命名', description: 'Rename session', category: 'session' },
    { name: 'restore', zhName: '恢复', description: 'Restore session', category: 'other' },
    { name: 'retry', zhName: '重试', description: 'Retry last turn', category: 'debug' },
    { name: 'review', zhName: '审查', description: 'Review code changes', category: 'project' },
    { name: 'rlm', zhName: '递归', description: 'Recursive LM', category: 'other' },
    { name: 'save', zhName: '保存', description: 'Save session', category: 'session' },
    { name: 'sessions', zhName: '会话', description: 'List/resume sessions', category: 'session' },
    { name: 'settings', zhName: '设置', description: 'Show settings', category: 'config' },
    { name: 'share', zhName: '分享', description: 'Share as markdown', category: 'project' },
    { name: 'skill', zhName: '技能', description: 'Run skill', category: 'skills' },
    { name: 'skills', zhName: '技能列表', description: 'List skills', category: 'skills' },
    { name: 'stash', zhName: '暂存', description: 'Stash session', category: 'core' },
    { name: 'status', zhName: '状态', description: 'Runtime status', category: 'config' },
    { name: 'statusline', zhName: '状态栏', description: 'Toggle status line', category: 'config' },
    { name: 'subagents', zhName: '子代理', description: 'Sub-agent status', category: 'core' },
    { name: 'system', zhName: '系统', description: 'System prompt', category: 'debug' },
    { name: 'task', zhName: '任务', description: 'Background tasks', category: 'tools' },
    { name: 'theme', zhName: '主题', description: 'Switch theme', category: 'config' },
    { name: 'tokens', zhName: '令牌', description: 'Token counts', category: 'debug' },
    { name: 'translate', zhName: '翻译', description: 'Translate last msg', category: 'debug' },
    { name: 'trust', zhName: '信任', description: 'Trusted directories', category: 'config' },
    { name: 'undo', zhName: '撤销', description: 'Undo last change', category: 'debug' },
    { name: 'verbose', zhName: '详细', description: 'Toggle verbose', category: 'config' },
    { name: 'workspace', zhName: '工作区', description: 'Show/switch workspace', category: 'core' },
];

const props = defineProps<{ visible: boolean; filterText: string }>();
const emit = defineEmits<{ (e: 'select', cmd: SlashCommand): void }>();

const popupRef = ref<HTMLElement>();
const listRef = ref<HTMLElement>();
const selectedIdx = ref(0);

const filteredCmds = computed(() => {
    const q = props.filterText.toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c => c.name.includes(q) || (c.zhName && c.zhName.includes(q)) || c.description.toLowerCase().includes(q));
});

watch(() => props.filterText, () => { selectedIdx.value = 0; });
watch(selectedIdx, () => { nextTick(() => { const el = listRef.value?.children[selectedIdx.value] as HTMLElement; el?.scrollIntoView({ block: 'nearest' }); }); });

function select(idx: number): SlashCommand { const cmd = filteredCmds.value[idx]; emit('select', cmd); return cmd; }
defineExpose({ moveSelection: (d: number) => { const len = filteredCmds.value.length; selectedIdx.value = ((selectedIdx.value + d) % len + len) % len; }, getSelected: () => select(selectedIdx.value) });
function emitSelect(cmd: SlashCommand) { emit('select', cmd); }
</script>

<style scoped>
.slash-popup {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    max-height: 220px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.popup-title { padding: 4px 10px; font-size: 11px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
.popup-list { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; flex: 1; }
.popup-list li { display: flex; align-items: center; gap: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.popup-list li:hover, .popup-list li.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.cmd-name { font-weight: 600; color: #60a5fa; min-width: 80px; flex-shrink: 0; }
.cmd-zh { font-size: 11px; color: var(--vscode-descriptionForeground); flex-shrink: 0; }
.cmd-desc { flex: 1; font-size: 11px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-cat { font-size: 10px; color: var(--vscode-descriptionForeground); opacity: 0.5; flex-shrink: 0; }
.no-match { padding: 10px; font-size: 12px; color: var(--vscode-descriptionForeground); text-align: center; }
</style>
