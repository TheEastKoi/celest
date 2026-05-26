<template>
    <div class="agents-panel">
        <div v-if="agents.length === 0" class="agents-empty">
            <div class="empty-icon">🤖</div>
            <p>子代理 (Agents)</p>
            <p class="empty-hint">agent_open 创建的并行子代理会显示在这里</p>
        </div>
        <div v-else class="agents-list">
            <div v-for="agent in agents" :key="agent.id" class="agent-item">
                <div class="agent-header">
                    <span class="agent-status-dot" :class="'dot-' + agent.status"></span>
                    <span class="agent-name">{{ agent.id.slice(0, 12) }}</span>
                    <span class="agent-status-label">{{ statusLabel(agent.status) }}</span>
                </div>
                <div class="agent-prompt" v-if="agent.prompt">{{ agent.prompt.slice(0, 80) }}</div>
                <div class="agent-result" v-if="agent.result">{{ agent.result.slice(0, 120) }}</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
export interface AgentItem {
    id: string;
    status: 'spawned' | 'running' | 'completed';
    prompt?: string;
    result?: string;
}

defineProps<{ agents: AgentItem[] }>();

function statusLabel(s: string): string {
    const map: Record<string, string> = {
        spawned: '已创建',
        running: '运行中',
        completed: '完成',
    };
    return map[s] || s;
}
</script>

<style scoped>
.agents-panel { font-size: 12px; padding: 8px; }
.agents-empty { padding: 12px; color: var(--vscode-descriptionForeground); text-align: center; display: flex; flex-direction: column; align-items: center; }
.agents-empty .empty-icon { font-size: 36px; margin-bottom: 8px; }
.agents-empty .empty-hint { font-size: 11px; margin-top: 4px; }
.agents-empty p { margin: 2px 0; }
.agents-list { padding: 4px; }
.agent-item { padding: 6px 8px; border-radius: 3px; margin-bottom: 4px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }
.agent-item:hover { background: var(--vscode-list-hoverBackground); }
.agent-header { display: flex; align-items: center; gap: 6px; }
.agent-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-spawned   { background: #d29922; }
.dot-running   { background: #58a6ff; }
.dot-completed { background: #3fb950; }
.agent-name { font-weight: 500; font-size: 12px; font-family: var(--vscode-editor-font-family); }
.agent-status-label { color: var(--vscode-descriptionForeground); font-size: 10px; }
.agent-prompt { color: var(--vscode-descriptionForeground); font-size: 10px; margin-top: 2px; margin-left: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-result { color: var(--vscode-textLink-foreground); font-size: 10px; margin-top: 2px; margin-left: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
