<template>
    <div class="plan-panel">
        <div v-if="!hasPlan" class="empty-state">
            <div class="empty-icon">📐</div>
            <p>暂无计划</p>
            <p class="empty-hint">agent 使用 update_plan 后会显示在这里</p>
        </div>

        <template v-else>
            <div v-if="plan.explanation" class="plan-explanation">
                {{ plan.explanation }}
            </div>
            <ul class="plan-list">
                <li
                    v-for="(step, idx) in plan.steps"
                    :key="idx"
                    class="plan-step"
                    :class="'step-' + step.status"
                >
                    <span class="step-icon">{{ statusIcon(step.status) }}</span>
                    <span class="step-text">{{ step.step }}</span>
                    <span class="step-label">{{ step.status }}</span>
                </li>
            </ul>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface PlanStep {
    step: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface PlanData {
    explanation?: string;
    steps: PlanStep[];
}

const props = defineProps<{
    plan: PlanData;
}>();

const hasPlan = computed(() => props.plan.steps.length > 0);

function statusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✅';
        case 'in_progress': return '🔄';
        default: return '⬜';
    }
}
</script>

<style scoped>
.plan-panel {
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

.plan-explanation {
    padding: 10px 12px;
    margin-bottom: 12px;
    background: var(--vscode-textBlockQuote-background);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--vscode-descriptionForeground);
    border-left: 3px solid var(--vscode-textBlockQuote-border);
}

.plan-list {
    list-style: none;
    margin: 0;
    padding: 0;
}
.plan-step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    font-size: 13px;
}
.plan-step:last-child { border-bottom: none; }
.step-icon { flex-shrink: 0; font-size: 14px; }
.step-text { flex: 1; }
.step-label {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
    flex-shrink: 0;
}

.step-completed .step-label {
    background: #2ea04333;
    color: #2ea043;
}
.step-in_progress .step-label {
    background: #60a5fa33;
    color: #60a5fa;
}
.step-pending .step-label {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.step-completed .step-text {
    text-decoration: line-through;
    opacity: 0.6;
}
</style>
