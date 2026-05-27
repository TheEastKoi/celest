<template>
    <div class="context-panel">
        <div class="ctx-section" v-if="usage">
            <div class="ctx-section-title">用量</div>
            <div class="ctx-row"><span>输入</span><span>{{ fmtNum(usage.totals?.input_tokens) }} tk</span></div>
            <div class="ctx-row"><span>输出</span><span>{{ fmtNum(usage.totals?.output_tokens) }} tk</span></div>
            <div class="ctx-row" v-if="usage.totals?.cached_tokens"><span>缓存命中</span><span>{{ fmtNum(usage.totals.cached_tokens) }} tk</span></div>
            <div class="ctx-row" v-if="usage.totals?.cost_usd"><span>费用</span><span>${{ usage.totals.cost_usd.toFixed(4) }}</span></div>
            <div class="ctx-row"><span>轮次</span><span>{{ usage.totals?.turns || 0 }}</span></div>
        </div>
        <div class="ctx-section" v-if="workspace">
            <div class="ctx-section-title">工作区</div>
            <div class="ctx-row" v-if="workspace.git_repo">
                <span>分支</span><span>{{ workspace.branch || 'HEAD' }}</span>
            </div>
            <div class="ctx-row" v-if="workspace.unstaged"><span>未暂存</span><span>{{ workspace.unstaged }}</span></div>
            <div class="ctx-row" v-if="workspace.staged"><span>已暂存</span><span>{{ workspace.staged }}</span></div>
            <div class="ctx-row" v-if="workspace.ahead"><span>领先</span><span>{{ workspace.ahead }}</span></div>
        </div>
        <div class="ctx-section" v-if="mcpCount !== null">
            <div class="ctx-section-title">🔌 MCP</div>
            <div class="ctx-row"><span>服务器</span><span>{{ mcpCount }}</span></div>
        </div>
        <div class="ctx-empty" v-if="!usage && !workspace && mcpCount === null">
            <div class="empty-icon">🔍</div>
            <p>上下文 (Context)</p>
            <p class="empty-hint">发送对话后显示用量、Git 分支和 MCP 状态</p>
        </div>
    </div>
</template>

<script setup lang="ts">
export interface ContextUsage {
    totals?: {
        input_tokens: number;
        output_tokens: number;
        cached_tokens: number;
        cost_usd: number;
        turns: number;
    };
}

export interface ContextWorkspace {
    git_repo: boolean;
    branch?: string;
    staged: number;
    unstaged: number;
    ahead?: number;
}

const props = defineProps<{
    usage: ContextUsage | null;
    workspace: ContextWorkspace | null;
    mcpCount: number | null;
}>();

function fmtNum(n?: number): string {
    if (n === undefined || n === null) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}
</script>

<style scoped>
.context-panel { font-size: 12px; padding: 8px; }
.ctx-section { margin-bottom: 10px; }
.ctx-section-title { font-weight: 600; font-size: 11px; color: var(--vscode-textLink-foreground); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.ctx-row { display: flex; justify-content: space-between; padding: 2px 4px; font-size: 11px; }
.ctx-row span:first-child { color: var(--vscode-descriptionForeground); }
.ctx-row span:last-child { font-family: var(--vscode-editor-font-family); }
.ctx-empty { padding: 12px; color: var(--vscode-descriptionForeground); text-align: center; display: flex; flex-direction: column; align-items: center; }
.ctx-empty .empty-icon { font-size: 36px; margin-bottom: 8px; }
.ctx-empty .empty-hint { font-size: 11px; margin-top: 4px; }
.ctx-empty p { margin: 2px 0; }
</style>
