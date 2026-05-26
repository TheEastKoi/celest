<template>
  <div class="usage-panel">
    <div class="panel-header">
      <h3 class="panel-title">Usage</h3>
      <select v-model="groupBy" @change="fetchUsage" class="group-select">
        <option value="day">By Day</option>
        <option value="model">By Model</option>
        <option value="provider">By Provider</option>
        <option value="thread">By Thread</option>
      </select>
    </div>

    <div v-if="loading" class="loading">Loading usage data…</div>

    <div v-else-if="!usage" class="empty">
      <p>No usage data available.</p>
    </div>

    <div v-else class="usage-content">
      <!-- Totals -->
      <div class="totals-card">
        <div class="total-row">
          <span class="total-label">Total Cost</span>
          <span class="total-value cost">${{ usage.totals?.cost_usd?.toFixed(4) || '0.00' }}</span>
        </div>
        <div class="total-row">
          <span class="total-label">Turns</span>
          <span class="total-value">{{ usage.totals?.turns || 0 }}</span>
        </div>
        <div class="total-row">
          <span class="total-label">Input</span>
          <span class="total-value">{{ formatTokens(usage.totals?.input_tokens) }}</span>
        </div>
        <div class="total-row">
          <span class="total-label">Output</span>
          <span class="total-value">{{ formatTokens(usage.totals?.output_tokens) }}</span>
        </div>
        <div class="total-row" v-if="usage.totals?.cached_tokens">
          <span class="total-label">Cached</span>
          <span class="total-value">{{ formatTokens(usage.totals.cached_tokens) }}</span>
        </div>
        <div class="total-row" v-if="usage.totals?.reasoning_tokens">
          <span class="total-label">Reasoning</span>
          <span class="total-value">{{ formatTokens(usage.totals.reasoning_tokens) }}</span>
        </div>
      </div>

      <!-- Buckets -->
      <div v-if="usage.buckets?.length" class="buckets">
        <div class="bucket-header">
          <span class="bucket-key">Group</span>
          <span class="bucket-tokens">Tokens</span>
          <span class="bucket-cost">Cost</span>
          <span class="bucket-turns">Turns</span>
        </div>
        <div v-for="b in usage.buckets" :key="b.key" class="bucket-row">
          <span class="bucket-key">{{ formatKey(b.key) }}</span>
          <span class="bucket-tokens">{{ formatTokens(b.input_tokens + b.output_tokens) }}</span>
          <span class="bucket-cost">${{ b.cost_usd?.toFixed(4) || '0.00' }}</span>
          <span class="bucket-turns">{{ b.turns }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  turns: number;
}

interface UsageBucket extends UsageTotals {
  key: string;
}

interface UsageData {
  since?: string;
  until?: string;
  group_by: string;
  totals: UsageTotals;
  buckets: UsageBucket[];
}

const usage = ref<UsageData | null>(null);
const loading = ref(true);
const groupBy = ref('day');

onMounted(() => {
  fetchUsage();
});

function fetchUsage() {
  loading.value = true;
  vscode?.postMessage({ type: 'getUsage', group_by: groupBy.value });
}

function formatTokens(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatKey(key: string): string {
  if (key.length === 10 && key.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return key; // date already formatted
  }
  return key.length > 24 ? key.slice(0, 24) + '…' : key;
}

// Listen for responses
const handler = (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === 'usageData') {
    usage.value = msg.usage;
    loading.value = false;
  }
};
window.addEventListener('message', handler);
</script>

<style scoped>
.usage-panel {
  padding: 12px;
  height: 100%;
  overflow-y: auto;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.group-select {
  font-size: 12px;
  padding: 2px 6px;
  background: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  cursor: pointer;
}

.loading, .empty {
  text-align: center;
  padding: 24px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
}

.totals-card {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, #333);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}

.total-label {
  color: var(--vscode-descriptionForeground);
}

.total-value {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.total-value.cost {
  color: var(--vscode-charts-green, #4ec9b0);
}

.bucket-header {
  display: grid;
  grid-template-columns: 1fr 70px 80px 50px;
  gap: 8px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border, #333);
}

.bucket-row {
  display: grid;
  grid-template-columns: 1fr 70px 80px 50px;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  border-bottom: 1px solid var(--vscode-panel-border, #3331);
  font-variant-numeric: tabular-nums;
}

.bucket-row:last-child { border-bottom: none; }

.bucket-key {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bucket-cost {
  color: var(--vscode-charts-green, #4ec9b0);
}
</style>
