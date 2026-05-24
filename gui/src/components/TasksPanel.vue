<template>
    <div class="tasks-panel">
        <div v-if="loading" class="tasks-loading">加载中...</div>
        <div v-else-if="tasks.length === 0" class="tasks-empty">暂无后台任务</div>
        <div v-else class="tasks-list">
            <div v-for="task in tasks" :key="task.id" class="task-item">
                <div class="task-header">
                    <span class="task-status-dot" :class="'dot-' + task.status"></span>
                    <span class="task-title">{{ task.title || task.id.slice(0, 12) }}</span>
                </div>
                <div class="task-meta">
                    <span class="task-status">{{ statusLabel(task.status) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
export interface TaskItem {
    id: string;
    title?: string;
    status: string;
    model?: string;
}
defineProps<{ tasks: TaskItem[]; loading: boolean }>();
function statusLabel(s: string): string {
    const map: Record<string, string> = { pending: '排队中', running: '运行中', completed: '完成', failed: '失败', canceled: '已取消' };
    return map[s] || s;
}
</script>

<style scoped>
.tasks-panel { font-size: 11px; }
.tasks-loading, .tasks-empty { padding: 12px; color: var(--vscode-descriptionForeground); text-align: center; font-style: italic; }
.tasks-list { padding: 4px; }
.task-item { padding: 6px 8px; border-radius: 3px; margin-bottom: 2px; }
.task-item:hover { background: var(--vscode-list-hoverBackground); }
.task-header { display: flex; align-items: center; gap: 6px; }
.task-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-pending   { background: #d29922; }
.dot-running   { background: #58a6ff; }
.dot-completed { background: #3fb950; }
.dot-failed    { background: #f85149; }
.dot-canceled  { background: #8b949e; }
.task-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-meta { margin-top: 2px; margin-left: 12px; }
.task-status { color: var(--vscode-descriptionForeground); font-size: 10px; }
</style>
