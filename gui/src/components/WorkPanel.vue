<template>
    <div class="work-panel">
        <!-- Todos -->
        <div v-if="todos.length === 0 && plan.steps.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <p>暂无工作任务</p>
            <p class="empty-hint">agent 使用任务工具后会显示在这里</p>
        </div>

        <!-- Plan explanation -->
        <div v-if="plan.explanation" class="plan-explanation">{{ plan.explanation }}</div>

        <!-- Plan steps -->
        <ul v-if="plan.steps.length > 0" class="plan-list">
            <li v-for="(step, idx) in plan.steps" :key="'p'+idx" class="plan-step" :class="'step-'+step.status">
                <span class="item-icon">{{ statusIcon(step.status) }}</span>
                <span class="item-text">{{ step.step }}</span>
                <span class="item-label">{{ step.status }}</span>
            </li>
        </ul>

        <!-- Todos -->
        <ul v-if="todos.length > 0" class="todo-list">
            <li v-for="(todo, idx) in sortedTodos" :key="'t'+idx" class="todo-item" :class="'todo-'+todo.status">
                <span class="item-icon">{{ statusIcon(todo.status) }}</span>
                <span class="item-text">{{ todo.content }}</span>
                <span class="item-label">{{ todo.status }}</span>
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

interface PlanStep {
    step: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface PlanData {
    explanation?: string;
    steps: PlanStep[];
}

const props = defineProps<{
    todos: TodoItem[];
    plan: PlanData;
}>();

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
.work-panel { padding: 12px; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: var(--vscode-descriptionForeground); }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-hint { font-size: 12px; margin-top: 8px; }

.plan-explanation {
    padding: 10px 12px; margin-bottom: 10px;
    background: var(--vscode-textBlockQuote-background);
    border-radius: 6px; font-size: 12px; line-height: 1.5;
    color: var(--vscode-descriptionForeground);
    border-left: 3px solid var(--vscode-textBlockQuote-border);
}

.plan-list, .todo-list { list-style: none; margin: 0; padding: 0; }
.plan-list { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed var(--vscode-sideBarSectionHeader-border); }

.plan-step, .todo-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; font-size: 12px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
}
.plan-step:last-child, .todo-item:last-child { border-bottom: none; }

.item-icon { flex-shrink: 0; font-size: 13px; }
.item-text { flex: 1; }
.item-label {
    font-size: 9px; padding: 1px 5px; border-radius: 3px;
    text-transform: uppercase; font-weight: 600; flex-shrink: 0;
}

.step-completed .item-label, .todo-completed .item-label { background: #2ea04333; color: #2ea043; }
.step-in_progress .item-label, .todo-in_progress .item-label { background: #60a5fa33; color: #60a5fa; }
.step-pending .item-label, .todo-pending .item-label { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.step-completed .item-text, .todo-completed .item-text { text-decoration: line-through; opacity: 0.6; }
</style>
