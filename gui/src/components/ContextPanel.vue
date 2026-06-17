<template>
    <div class="context-panel">
        <div class="ctx-section" v-if="usage">
            <div class="ctx-section-title">用量</div>
            <!-- Bug 3: 上下文占用进度条 -->
            <div class="ctx-progress-bar" v-if="usagePercent !== undefined">
                <div class="ctx-progress-fill" :style="{ width: usagePercent + '%' }" :class="{ 'ctx-warn': usagePercent >= 70, 'ctx-danger': usagePercent >= 85 }"></div>
            </div>
            <div class="ctx-row" v-if="usagePercent !== undefined"><span>上下文占用</span><span>{{ usagePercent }}%（~1M 窗口）</span></div>
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
    /** Bug 3: 上下文占用百分比（由 checkContextUsage 推送） */
    usagePercent?: number;
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
.ctx-section-title { font-weight: 600; font-size: 11px; color: var(--vscode-foreground); opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.ctx-row { display: flex; justify-content: space-between; padding: 2px 4px; font-size: 11px; }
.ctx-row span:first-child { color: var(--vscode-descriptionForeground); }
.ctx-row span:last-child { font-family: var(--vscode-editor-font-family); }
.ctx-empty { padding: 12px; color: var(--vscode-descriptionForeground); text-align: center; display: flex; flex-direction: column; align-items: center; }
.ctx-empty .empty-icon { font-size: 36px; margin-bottom: 8px; }
.ctx-empty .empty-hint { font-size: 11px; margin-top: 4px; }
.ctx-empty p { margin: 2px 0; }
.ctx-progress-bar { height: 6px; background: var(--vscode-input-background); border-radius: 3px; margin: 4px 0 6px 0; overflow: hidden; }
.ctx-progress-fill { height: 100%; border-radius: 3px; background: var(--vscode-charts-green); transition: width 0.3s ease; }
.ctx-progress-fill.ctx-warn { background: var(--vscode-charts-yellow); }
.ctx-progress-fill.ctx-danger { background: var(--vscode-charts-red); }
</style>
