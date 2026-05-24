<template>
    <div class="work-panel">
        <div v-if="todos.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <p>暂无工作任务</p>
            <p class="empty-hint">agent 使用任务工具后会显示在这里</p>
        </div>

        <ul v-else class="todo-list">
            <li
                v-for="(todo, idx) in sortedTodos"
                :key="idx"
                class="todo-item"
                :class="'todo-' + todo.status"
            >
                <span class="todo-status-icon">{{ statusIcon(todo.status) }}</span>
                <span class="todo-content">{{ todo.content }}</span>
                <span class="todo-status-label">{{ todo.status }}</span>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}

const props = defineProps<{
    todos: TodoItem[];
}>();

// 排序：in_progress 在前，pending 中间，completed 在后
const sortedTodos = computed(() => {
    const order: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
    return [...props.todos].sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));
});

function statusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✅';
        case 'in_progress': return '🔄';
        default: return '⬜';
    }
}
</script>

<style scoped>
.work-panel {
    padding: 12px;
}
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--vscode-descriptionForeground);
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-hint { font-size: 12px; margin-top: 8px; }

.todo-list {
    list-style: none;
    margin: 0;
    padding: 0;
}
.todo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    font-size: 13px;
}
.todo-item:last-child { border-bottom: none; }
.todo-status-icon { flex-shrink: 0; font-size: 14px; }
.todo-content { flex: 1; }
.todo-status-label {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
    flex-shrink: 0;
}

.todo-in_progress .todo-status-label {
    background: #60a5fa33;
    color: #60a5fa;
}
.todo-pending .todo-status-label {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.todo-completed .todo-status-label {
    background: #2ea04333;
    color: #2ea043;
}
.todo-completed .todo-content {
    text-decoration: line-through;
    opacity: 0.6;
}
</style>
