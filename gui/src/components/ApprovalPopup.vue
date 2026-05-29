<template>
    <div v-if="visible" class="approval-overlay" @keydown="handleKeydown" tabindex="0" ref="overlayRef">
        <div class="approval-dialog">
            <!-- 标题行 -->
            <div class="approval-header">
                <span class="approval-icon">🔐</span>
                <span class="approval-tool-name">{{ toolName }}</span>
                <span class="approval-subtitle">需要审批</span>
            </div>

            <!-- 描述 -->
            <div class="approval-body">
                <div class="approval-desc">{{ description }}</div>
            </div>

            <!-- 类型 / 影响 -->
            <div v-if="toolType || impact" class="approval-meta">
                <div v-if="toolType" class="meta-row">
                    <span class="meta-label">类型</span>
                    <span class="meta-value">{{ toolType }}</span>
                </div>
                <div v-if="impact" class="meta-row">
                    <span class="meta-label">影响</span>
                    <span class="meta-value impact-high" :class="{ 'impact-high': impact.includes('高'), 'impact-mid': impact.includes('中'), 'impact-low': impact.includes('低') }">{{ impact }}</span>
                </div>
            </div>

            <!-- 参数详情 -->
            <div v-if="params" class="approval-params">
                <div class="params-label">参数</div>
                <pre class="params-content">{{ params }}</pre>
            </div>

            <!-- 选项列表（点击/Enter 直接执行） -->
            <div v-if="!decided" class="approval-options">
                <div
                    v-for="(opt, idx) in options"
                    :key="idx"
                    class="approval-option"
                    :class="{ 'option-focused': focusedIdx === idx }"
                    @click="commitOption(idx)"
                    @mouseenter="focusedIdx = idx"
                >
                    <span class="option-num">{{ idx + 1 }}</span>
                    <span class="option-label">{{ opt.label }}</span>
                    <span class="option-hint">{{ opt.hint }}</span>
                </div>
            </div>

            <!-- 确认区（选中后按 Enter 进入确认态） -->
            <div v-if="false" class="approval-confirm">
                <div class="confirm-banner">
                    ⏎ 确认 {{ pendingLabel }}
                </div>
                <div class="confirm-hint">
                    Enter 确认 &nbsp;|&nbsp; Esc 返回选择
                </div>
            </div>

            <!-- 倒计时（未决定时） -->
            <div v-if="!decided && countdown > 0" class="approval-timeout">
                {{ formattedCountdown }} 后自动拒绝
            </div>

            <!-- 已决定状态 -->
            <div v-if="decided" class="approval-decided">
                ✓ 已发送：{{ decisionText }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';

// ── Options config ──────────────────────────────────────────

interface Option {
    label: string;
    hint: string;
    decision: 'allow' | 'deny';
    remember: boolean;
}

const options: Option[] = [
    { label: '允许本次',   hint: '仅本次',            decision: 'allow', remember: false },
    { label: '信任会话',   hint: '本次会话不再提示',   decision: 'allow', remember: true  },
    { label: '拒绝',       hint: '',                  decision: 'deny',  remember: false },
];

// ── Props ─────────────────────────────────────────────────────

const props = defineProps<{
    visible: boolean;
    approvalId: string;
    toolName: string;
    description: string;
    toolType?: string;
    impact?: string;
    params?: string;
}>();

const emit = defineEmits<{
    decide: [decision: 'allow' | 'deny', remember: boolean];
    close: [];
}>();

// ── State ─────────────────────────────────────────────────────

const decided = ref(false);
const decisionText = ref('');
const focusedIdx = ref(0);
const confirmed = ref(false);
const pendingLabel = ref('');
const overlayRef = ref<HTMLElement>();
const TIMEOUT_SECS = 300;
const countdown = ref(TIMEOUT_SECS);
let timer: ReturnType<typeof setInterval> | null = null;

// ── Computed ──────────────────────────────────────────────────

const formattedCountdown = computed(() => {
    const m = Math.floor(countdown.value / 60);
    const s = countdown.value % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
});

// ── Watch visibility ─────────────────────────────────────────

watch(() => props.visible, async (val) => {
    if (val) {
        decided.value = false;
        decisionText.value = '';
        focusedIdx.value = 0;
        confirmed.value = false;
        pendingLabel.value = '';
        countdown.value = TIMEOUT_SECS;
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
                if (!decided.value) {
                    commitOption(2); // auto-deny
                }
                if (timer) clearInterval(timer);
            }
        }, 1000);
        await nextTick();
        overlayRef.value?.focus();
    } else {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
});

// ── Methods ───────────────────────────────────────────────────

function focusOption(idx: number) {
    if (decided.value) return;
    focusedIdx.value = idx;
    // 鼠标点击直接进入确认
    commitOption(idx);
}

function enterConfirm(idx: number) {
    if (confirmed.value || decided.value) return;
    const opt = options[idx];
    if (!opt) return;
    confirmed.value = true;
    pendingLabel.value = opt.label;
}

function cancelConfirm() {
    if (decided.value) return;
    confirmed.value = false;
    pendingLabel.value = '';
}

function commitOption(idx: number) {
    if (decided.value) return;
    const opt = options[idx];
    if (!opt) return;
    decided.value = true;
    decisionText.value = opt.label;
    confirmed.value = false;
    if (timer) clearInterval(timer);
    emit('decide', opt.decision, opt.remember);
}

function handleKeydown(e: KeyboardEvent) {
    if (decided.value) return;

    // 确认态 → Enter 提交 / Esc 取消
    if (confirmed.value) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitOption(focusedIdx.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelConfirm();
        }
        return;
    }

    // 选择态
    if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        focusedIdx.value = (focusedIdx.value - 1 + options.length) % options.length;
    } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        focusedIdx.value = (focusedIdx.value + 1) % options.length;
    } else if (e.key === 'Enter') {
        e.preventDefault();
        commitOption(focusedIdx.value);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        // Esc 在未确认时关闭弹窗？不关闭，只有倒计时和明确选择才关闭
    } else if (e.key >= '1' && e.key <= String(options.length)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        focusedIdx.value = idx;
        commitOption(idx);
    }
}
</script>

<style scoped>
.approval-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    outline: none;
}
.approval-dialog {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    min-width: 420px;
    max-width: 560px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    overflow: hidden;
}

/* 标题行 */
.approval-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--vscode-textBlockQuote-background);
    border-bottom: 1px solid var(--vscode-panel-border);
}
.approval-icon {
    font-size: 16px;
}
.approval-tool-name {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 13px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
}
.approval-subtitle {
    margin-left: auto;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

/* 描述 */
.approval-body {
    padding: 10px 16px;
}
.approval-desc {
    font-size: 12px;
    color: var(--vscode-foreground);
    line-height: 1.5;
    word-break: break-all;
    opacity: 0.85;
}

/* 类型/影响 */
.approval-meta {
    padding: 4px 16px;
}
.meta-row {
    display: flex;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
}
.meta-label {
    color: var(--vscode-descriptionForeground);
    min-width: 32px;
}
.meta-value {
    color: var(--vscode-foreground);
}
.meta-value.impact-high {
    color: #f85149;
}
.meta-value.impact-mid {
    color: #d29922;
}
.meta-value.impact-low {
    color: #3fb950;
}

/* 参数 */
.approval-params {
    padding: 0 16px 10px;
}
.params-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}
.params-content {
    margin: 0;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 100px;
    overflow-y: auto;
    opacity: 0.8;
    background: var(--vscode-textBlockQuote-background);
    padding: 6px 8px;
    border-radius: 3px;
}

/* 选项列表 */
.approval-options {
    padding: 4px 10px 10px;
}
.approval-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
    margin-bottom: 2px;
}
.approval-option:hover,
.approval-option.option-focused {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.option-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 3px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
}
.option-label {
    font-size: 13px;
    font-weight: 600;
}
.option-hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
}

/* 确认区 */
.approval-confirm {
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
}
.confirm-banner {
    font-size: 13px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    padding: 6px 0;
}
.confirm-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
}

/* 倒计时 */
.approval-timeout {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-top: 1px solid var(--vscode-panel-border);
}

/* 已决定 */
.approval-decided {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    font-style: italic;
    border-top: 1px solid var(--vscode-panel-border);
}
</style>
