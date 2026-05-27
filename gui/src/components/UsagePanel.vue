<template>
    <div class="usage-panel">
        <div v-if="loading" class="usage-empty">
            <div class="empty-icon">⏳</div>
            <p>加载中...</p>
        </div>
        <div v-else-if="!usage || !usage.totals" class="usage-empty">
            <div class="empty-icon">📈</div>
            <p>用量统计</p>
            <p class="empty-hint">发送对话后显示 token 用量和费用</p>
        </div>
        <div v-else class="usage-content">
            <div class="group-row">
                <select v-model="groupBy" @change="requestRefresh" class="group-select">
                    <option value="day">按天</option>
                    <option value="model">按模型</option>
                    <option value="provider">按提供商</option>
                    <option value="thread">按线程</option>
                </select>
                <button class="refresh-btn" @click="requestRefresh" title="刷新">↻</button>
            </div>

            <div class="totals-card">
                <div class="total-row">
                    <span class="total-label">总费用</span>
                    <span class="total-value cost">${{ usage.totals.cost_usd?.toFixed(6) || '0.00' }}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">轮次</span>
                    <span class="total-value">{{ usage.totals.turns || 0 }}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">输入</span>
                    <span class="total-value">{{ fmtNum(usage.totals.input_tokens) }} tk</span>
                </div>
                <div class="total-row">
                    <span class="total-label">输出</span>
                    <span class="total-value">{{ fmtNum(usage.totals.output_tokens) }} tk</span>
                </div>
                <div class="total-row" v-if="usage.totals.cached_tokens">
                    <span class="total-label">缓存命中</span>
                    <span class="total-value">{{ fmtNum(usage.totals.cached_tokens) }} tk</span>
                </div>
            </div>

            <div v-if="usage.buckets?.length" class="buckets">
                <div class="bucket-header">
                    <span class="bucket-key">分组</span>
                    <span class="bucket-tokens">Token</span>
                    <span class="bucket-cost">费用</span>
                </div>
                <div v-for="b in usage.buckets" :key="b.key" class="bucket-row">
                    <span class="bucket-key">{{ fmtKey(b.key) }}</span>
                    <span class="bucket-tokens">{{ fmtNum(b.input_tokens + b.output_tokens) }}</span>
                    <span class="bucket-cost">${{ b.cost_usd?.toFixed(4) || '0.00' }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

export interface UsageTotals {
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    reasoning_tokens: number;
    cost_usd: number;
    turns: number;
}

export interface UsageBucketData extends UsageTotals {
    key: string;
}

export interface UsagePanelData {
    totals?: UsageTotals;
    buckets?: UsageBucketData[];
}

const props = defineProps<{
    usage: UsagePanelData | null;
    loading: boolean;
}>();

const emit = defineEmits<{
    refresh: [groupBy: string];
}>();

const groupBy = ref('day');

function requestRefresh() {
    emit('refresh', groupBy.value);
}

function fmtNum(n?: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function fmtKey(key: string): string {
    if (key.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
    return key.length > 24 ? key.slice(0, 24) + '…' : key;
}
</script>

<style scoped>
.usage-panel { font-size: 12px; padding: 8px; }
.usage-empty { padding: 12px; color: var(--vscode-descriptionForeground); text-align: center; display: flex; flex-direction: column; align-items: center; }
.usage-empty .empty-icon { font-size: 36px; margin-bottom: 8px; }
.usage-empty .empty-hint { font-size: 11px; margin-top: 4px; }
.usage-empty p { margin: 2px 0; }
.usage-content { padding: 4px; }
.group-row { display: flex; gap: 4px; margin-bottom: 8px; }
.group-select { flex: 1; font-size: 11px; padding: 2px 4px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); border-radius: 3px; }
.refresh-btn { font-size: 12px; padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer; }
.totals-card { margin-bottom: 8px; }
.total-row { display: flex; justify-content: space-between; padding: 2px 4px; font-size: 11px; }
.total-label { color: var(--vscode-descriptionForeground); }
.total-value { font-family: var(--vscode-editor-font-family); }
.total-value.cost { color: var(--vscode-textLink-foreground); font-weight: 600; }
.buckets { margin-top: 4px; }
.bucket-header { display: flex; font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground); padding: 2px 4px; border-bottom: 1px solid var(--vscode-panel-border); }
.bucket-row { display: flex; padding: 2px 4px; font-size: 10px; font-family: var(--vscode-editor-font-family); }
.bucket-row:hover { background: var(--vscode-list-hoverBackground); }
.bucket-key { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bucket-tokens { width: 60px; text-align: right; }
.bucket-cost { width: 70px; text-align: right; }
</style>
