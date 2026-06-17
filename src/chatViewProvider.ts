import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import { TuiProcessManager, type RuntimeEvent, type SessionConfig, type SkillEntry, type SkillsListResponse, type UsageData, type WorkspaceStatus } from './tuiProcessManager';
import { BinaryDownloader } from './binaryDownloader';
import { getSecretStore } from './secretStorage';
import { logger } from './logger';
import * as toml from 'smol-toml'; // Bug 12: 替代手写正则

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _promptSeq = 0;
    private _turnCount = 0; // Bug 3: 跟踪轮次，控制系统提示注入和上下文检查
    private _toolCache = new Map<string, { toolName: string; args: Record<string, unknown>; ts: number }>();
    private static readonly TOOL_CACHE_MAX = 200; // 最大缓存条目数
    private static readonly TOOL_CACHE_TTL = 5 * 60 * 1000; // 5 分钟过期
    private _taskPollTimer: ReturnType<typeof setInterval> | null = null;
    private _lastTasks: any[] = [];
    private _binaryDownloader: BinaryDownloader;
    private _mcpCache: { servers: any[]; tools: any[]; ts: number } | null = null;
    private _contextCheckInterval = 5; // Bug 3: 每 N 轮检查上下文用量

    private static readonly TOOL_META: Record<string, { type: string; impact: string }> = {
        exec_shell:              { type: 'Shell 命令',         impact: '高 — 可执行任意系统命令' },
        write_file:              { type: '文件写入',           impact: '中 — 修改文件内容' },
        edit_file:               { type: '文件编辑',           impact: '中 — 修改文件片段' },
        apply_patch:             { type: '补丁应用',           impact: '中 — 批量修改文件' },
        code_execution:          { type: '代码执行',           impact: '高 — 执行 Python 代码' },
        js_execution:            { type: '代码执行',           impact: '高 — 执行 JavaScript 代码' },
        task_shell_start:        { type: '后台 Shell 命令',    impact: '高 — 后台执行系统命令' },
        task_shell_wait:         { type: '后台 Shell 等待',    impact: '高 — 后台执行系统命令' },
        list_dir:                { type: '目录列表',           impact: '低 — 只读操作' },
        read_file:               { type: '文件读取',           impact: '低 — 只读操作' },
        grep_files:              { type: '内容搜索',           impact: '低 — 只读操作' },
        file_search:             { type: '文件搜索',           impact: '低 — 只读操作' },
        web_search:              { type: '网络搜索',           impact: '低 — 只读操作' },
        fetch_url:               { type: '网络请求',           impact: '中 — 访问外部资源' },
        github_issue_context:    { type: 'GitHub 查询',        impact: '低 — 只读操作' },
        github_pr_context:       { type: 'GitHub 查询',        impact: '低 — 只读操作' },
        checklist_write:         { type: '任务管理',           impact: '低 — 修改内部状态' },
        update_plan:             { type: '计划管理',           impact: '低 — 修改内部状态' },
        git_status:              { type: 'Git 状态',           impact: '低 — 只读操作' },
        git_diff:                { type: 'Git 差异',           impact: '低 — 只读操作' },
        git_show:                { type: 'Git 查看',           impact: '低 — 只读操作' },
        git_log:                 { type: 'Git 日志',           impact: '低 — 只读操作' },
        git_blame:               { type: 'Git Blame',          impact: '低 — 只读操作' },
        handle_read:             { type: '句柄读取',           impact: '低 — 只读操作' },
        agent_open:              { type: '子代理创建',         impact: '高 — 创建子代理会话' },
        agent_eval:              { type: '子代理评估',         impact: '高 — 操作子代理' },
        agent_close:             { type: '子代理关闭',         impact: '中 — 关闭子代理' },
        rlm_open:                { type: 'RLM 会话',           impact: '中 — RLM 操作' },
        rlm_eval:                { type: 'RLM 评估',           impact: '中 — RLM 操作' },
        rlm_close:               { type: 'RLM 关闭',           impact: '中 — RLM 操作' },
        run_tests:               { type: '测试运行',           impact: '中 — 执行测试' },
        run_verifiers:           { type: '验证器运行',         impact: '中 — 执行验证' },
        task_create:             { type: '任务创建',           impact: '中 — 创建后台任务' },
        note:                    { type: '记忆记录',           impact: '低 — 修改内部状态' },
    };

    constructor(
        private context: vscode.ExtensionContext,
        private tuiManager: TuiProcessManager,
        private _onSessionChange?: () => void,
    ) {
        this._binaryDownloader = new BinaryDownloader(context);

        this.tuiManager.onEvent((event: RuntimeEvent) => {
            switch (event.event) {
                case 'reasoningStarted':
                    break;
                case 'reasoningDelta':
                    if (event.delta) {
                        this.postMessage({ type: 'tuiReasoning', reasoning: event.delta });
                    }
                    break;
                case 'reasoningDone':
                    this.postMessage({ type: 'tuiReasoningDone' });
                    break;
                case 'messageDelta':
                    if (event.delta) {
                        this.postMessage({ type: 'tuiText', text: event.delta, sessionId: 'http-sse' });
                    }
                    break;
                case 'toolStarted': {
                    let input: Record<string, unknown> = {};
                    try { input = JSON.parse(event.delta || '{}'); } catch { /* keep empty */ }
                    const callId = event.itemId || String(Date.now());
                    const toolName = event.toolName || event.kind || 'tool';
                    // 添加时检查容量，超限则清理最旧的
                    if (this._toolCache.size >= ChatViewProvider.TOOL_CACHE_MAX) {
                        this._evictToolCache();
                    }
                    this._toolCache.set(callId, { toolName: String(toolName), args: input, ts: Date.now() });
                    logger.info(`[ToolCache] stored id="${callId}" tool=${toolName} args=${JSON.stringify(input).slice(0, 200)}`);
                    const toolCall = { name: toolName, arguments: input, callId };
                    this.postMessage({ type: 'tuiToolCall', toolCall });
                    break;
                }
                case 'toolProgress':
                    if (event.delta) {
                        this.postMessage({
                            type: 'tuiToolProgress',
                            toolResult: { callId: event.itemId || '', output: event.delta, status: 'running' as const },
                        });
                    }
                    break;
                case 'toolCompleted':
                case 'toolFailed': {
                    const callId = event.itemId || '';
                    const toolName = this._toolCache.get(callId)?.toolName || '';
                    const output = event.delta || '';
                    const toolResult = { callId, output, status: (event.event === 'toolFailed' ? 'error' : 'success') as string, toolName };
                    this.postMessage({ type: 'tuiToolResult', toolResult });
                    if (callId) this._toolCache.delete(callId);
                    // 只有 task_create / task_shell_start 等 task 工具才触发任务刷新
                    if (toolName && toolName.includes("task")) {
                        this.pushTasks();
                    }
                    break;
                }
                // Phase 6.3: Sub-agent events
                case 'agentSpawned':
                    this.postMessage({ type: 'agentSpawned', agentId: event.itemId, prompt: event.delta });
                    break;
                case 'agentProgress':
                    this.postMessage({ type: 'agentProgress', agentId: event.itemId, status: event.delta });
                    break;
                case 'agentCompleted':
                    this.postMessage({ type: 'agentCompleted', agentId: event.itemId, result: event.delta });
                    break;

                case 'turnInterrupted':
                    this.postMessage({ type: 'tuiWarning', message: 'Turn interrupted' });
                    break;
                case 'turnCompleted':
                    this.postMessage({ type: 'promptEnded' });
                    this.pushTasks();
                    if (!this.hasActiveTasks()) {
                        this.stopTaskPolling();
                    }
                    this._onSessionChange?.();
                    break;
                // Phase 6.1: 新 SSE 事件
                case 'sandboxDenied':
                    this.postMessage({ type: 'tuiWarning', message: `Sandbox denied: ${event.delta || 'unknown operation'}` });
                    break;
                case 'turnStarted':
                    // 记录 turn_id（已在 tuiProcessManager 端处理，这里只做前端通知）
                    if (event.turnId) {
                        this.postMessage({ type: 'turnStarted', turnId: event.turnId });
                    }
                    break;
                case 'itemInterrupted':
                    this.postMessage({ type: 'tuiWarning', message: 'Operation interrupted by process restart' });
                    break;
                case 'tuiCrashed':
                    this.stopTaskPolling();
                    this.postMessage({ type: 'tuiCrashed', message: 'TUI process crashed' });
                    break;
                case 'approvalDecided':
                    this.postMessage({
                        type: 'tuiApprovalDecided',
                        approvalId: event.itemId,
                        decision: event.delta,
                    });
                    break;
                case 'approvalTimeout':
                    this.postMessage({
                        type: 'tuiApprovalTimeout',
                        approvalId: event.itemId,
                    });
                    break;
                // Phase 3: goal.* / workflow.* SSE 事件转发
                case 'goalcreated':
                case 'goalupdated':
                case 'goalcompleted':
                case 'goalblocked':
                    this.postMessage({
                        type: 'goalEvent',
                        event: event.event,
                        goalId: event.itemId,
                        title: event.delta,
                    });
                    break;
                case 'workflowstarted':
                case 'workflowstep_started':
                case 'workflowstep_completed':
                case 'workflowcompleted':
                case 'workflowfailed':
                    this.postMessage({
                        type: 'workflowEvent',
                        event: event.event,
                        workflowId: event.itemId,
                        step: event.delta,
                    });
                    break;
            }
        });

        this.tuiManager.onStatusChange(({ status }) => {
            this.postMessage({ type: 'tuiStatus', status });
            if (status === 'connected') {
                this._onSessionChange?.();
            }
        });

        this.tuiManager.onApprovalRequired((approval) => {
            if (this.tuiManager.autoApprove) {
                logger.info(`[Approval] skipped popup (autoApprove=true) for ${approval.tool_name}`);
                return;
            }
            // 低影响/只读工具自动批准（问题3-5：避免卡在审批弹窗）
            const toolMeta = ChatViewProvider.TOOL_META[approval.tool_name];
            if (toolMeta && toolMeta.impact.startsWith('低')) {
                logger.info(`[Approval] auto-allowed low-impact tool: ${approval.tool_name}`);
                this.tuiManager.decideApproval(approval.id, 'allow', false);
                return;
            }
            let cached: { toolName: string; args: Record<string, unknown> } | undefined;
            for (const [, val] of this._toolCache) {
                if (val.toolName === approval.tool_name) {
                    cached = val;
                    break;
                }
            }
            const args = cached?.args || {};
            const meta = toolMeta || { type: approval.tool_name, impact: '未知' };
            const argSummary = Object.keys(args).length > 0
                ? Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n')
                : '';
            this.postMessage({
                type: 'tuiApprovalRequired',
                approvalId: approval.id,
                toolName: approval.tool_name,
                toolType: meta.type,
                impact: meta.impact,
                description: approval.description,
                params: argSummary,
            });
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        const guiDir = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'gui');
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [guiDir] };
        webviewView.webview.html = this.buildHtml(webviewView.webview, guiDir);
        webviewView.webview.onDidReceiveMessage(msg => this.handleWebviewMessage(msg));
    }

    postMessage(message: unknown): void { this._view?.webview.postMessage(message); }
    async newSession(): Promise<void> {
        // Cancel any active turn
        await this.tuiManager.cancel();
        // Reset thread state (increments generation to discard stale SSE events)
        this.tuiManager.resetThread();
        // Reset auto-approve — 新会话应恢复审批弹窗
        this.tuiManager.autoApprove = false;
        // 通知前端信任已重置
        this.postMessage({ type: 'trustActive', active: false });
        // Clear chat messages
        this.postMessage({ type: 'clearChat' });
        // Reset panel data
        this.postMessage({ type: 'newSession' });
        // Refresh sessions tree
        this._onSessionChange?.();
    }

    addToChat(uri?: vscode.Uri): void {
        if (uri) {
            // 使用绝对路径，TUI 可直接解析
            this.postMessage({ type: 'addAtMention', path: uri.fsPath });
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            this.postMessage({ type: 'addContext', text: editor.document.getText(editor.selection) });
        }
    }

    clearChat(): void { this.postMessage({ type: 'clearChat' }); }

    /** 恢复历史会话（由 TreeView 命令直接调用，不走 webview 中转） */
    async resumeSession(threadId: string): Promise<void> {
        logger.info(`[Session] resuming thread ${threadId}`);
        // 先中断当前 turn，避免旧 SSE 事件污染
        await this.tuiManager.cancel();
        this.stopTaskPolling();
        const thread = await this.tuiManager.resumeThread(threadId);
        if (!thread) {
            logger.warn(`[Session] resumeThread returned null for ${threadId}`);
            return;
        }
        // 检查工作区匹配
        const currentWs = (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '').replace(/\\/g, '/');
        const threadWs = (thread.workspace || '').replace(/\\/g, '/');
        if (threadWs && threadWs !== currentWs) {
            logger.warn(`[Session] workspace mismatch: thread=${threadWs} current=${currentWs}`);
            this.postMessage({ type: 'promptError', error: `此会话属于工作区 "${thread.workspace}"，与当前工作区不匹配。` });
            return;
        }
        logger.info(`[Session] resumed thread ${threadId}, loading history...`);
        // 清空当前消息并重置计数器
        this.postMessage({ type: 'clearChat' });
        this.postMessage({ type: 'newSession' }); // 这会重置 turnCount 等前端状态
        // 加载历史消息
        const detail = await this.tuiManager.getThreadDetail(threadId);
        if (!detail) {
            logger.warn(`[Session] getThreadDetail returned null for ${threadId}`);
        } else if (!Array.isArray(detail.turns)) {
            logger.warn(`[Session] detail.turns is not an array for ${threadId}`);
        } else {
            logger.info(`[Session] got ${detail.turns.length} turns, ${Array.isArray(detail.items) ? detail.items.length : 0} items`);
            const history: any[] = [];
            const itemMap = new Map<string, any>();
            let lastChecklistOutput: string | null = null;
            let lastPlanOutput: string | null = null;
            if (Array.isArray(detail.items)) {
                for (const item of detail.items) {
                    const it = item as any;
                    if (it.id) itemMap.set(it.id, it);
                    // 收集最后一个 checklist_write 和 update_plan 输出
                    if (it.kind === 'tool_call' && it.detail) {
                        if (it.summary && (it.summary.includes('checklist_write') || it.summary.includes('todo_write'))) {
                            lastChecklistOutput = it.detail;
                        } else if (it.summary && it.summary.includes('update_plan')) {
                            lastPlanOutput = it.detail;
                        }
                    }
                }
            }
            // 恢复 Work 面板
            if (lastChecklistOutput) {
                this.postMessage({ type: 'tuiToolResult', toolResult: { callId: '', output: lastChecklistOutput, status: 'success', toolName: 'checklist_write' } });
            }
            if (lastPlanOutput) {
                this.postMessage({ type: 'tuiToolResult', toolResult: { callId: '', output: lastPlanOutput, status: 'success', toolName: 'update_plan' } });
            }
            for (const turn of detail.turns) {
                const t = turn as any;
                const userText = String(t.input_summary || '');

                // 跳过被中断的 turn，显示提示
                if (t.status === 'interrupted' || t.status === 'canceled') {
                    if (userText) {
                        history.push({ role: 'user', content: userText });
                    }
                    history.push({ role: 'assistant', content: '> ⚠️ 此轮对话被中断' });
                    continue;
                }

                if (userText) {
                    history.push({ role: 'user', content: userText });
                }
                if (Array.isArray(t.item_ids)) {
                    for (const itemId of t.item_ids) {
                        const it = itemMap.get(itemId);
                        if (!it) continue;
                        // 跳过被中断的 item
                        if (it.status === 'interrupted') continue;

                        if (it.kind === 'agent_message' && it.detail) {
                            history.push({ role: 'assistant', content: String(it.detail) });
                        } else if (it.kind === 'agent_reasoning' && it.detail) {
                            // 保留推理过程（作为系统提示格式，前端可识别）
                            const reasoning = String(it.detail);
                            if (reasoning.length > 0) {
                                history.push({ role: 'assistant', content: `<thinking>\n${reasoning.slice(0, 2000)}${reasoning.length > 2000 ? '\n...' : ''}\n</thinking>` });
                            }
                        } else if (it.kind === 'tool_call' || it.kind === 'command_execution' || it.kind === 'file_change') {
                            // 保留工具调用摘要
                            const toolName = it.summary || it.kind;
                            const detail = typeof it.detail === 'string' ? it.detail.slice(0, 500) : '';
                            if (toolName || detail) {
                                history.push({ role: 'assistant', content: `> 🔧 ${toolName}${detail ? '\n> ' + detail.slice(0, 200) : ''}` });
                            }
                        }
                    }
                }
            }
            if (history.length > 0) {
                logger.info(`[Session] sending ${history.length} history messages`);
                this.postMessage({ type: 'loadHistory', history });
            } else {
                logger.warn(`[Session] no history extracted for ${threadId}`);
            }
        }
        // 恢复 Usage / Context 面板
        const usage = await this.tuiManager.getUsage({ group_by: 'day' });
        if (usage) this.postMessage({ type: 'usageData', usage });
        const ws = await this.tuiManager.getWorkspaceStatus();
        if (ws) this.postMessage({ type: 'workspaceStatus', status: ws });
        this.pushTasks();
        this._onSessionChange?.();
    }

    /** 从 TUI 的 ~/.codewhale/config.toml 读取所有 Provider 的 Key / BaseURL / Model（Bug 12: smol-toml 替代正则） */
    private readTuiProviderConfig(): { providerApiKeys: Record<string, boolean>; providerBaseUrls: Record<string, string>; providerModels: Record<string, string> } {
        const providerApiKeys: Record<string, boolean> = {};
        const providerBaseUrls: Record<string, string> = {};
        const providerModels: Record<string, string> = {};

        try {
            const tuiConfigPath = path.join(os.homedir(), '.codewhale', 'config.toml');
            if (fs.existsSync(tuiConfigPath)) {
                const raw = fs.readFileSync(tuiConfigPath, 'utf-8');
                const parsed = toml.parse(raw) as Record<string, any>;
                const providers = parsed.providers as Record<string, Record<string, unknown>> | undefined;

                if (providers) {
                    for (const [tuiSection, cfg] of Object.entries(providers)) {
                        // TUI section 用下划线（如 siliconflow_cn），转为 celest id（如 siliconflow-CN）
                        const pid = tuiSection.replace(/_/g, '-');
                        if (!cfg || typeof cfg !== 'object') continue;

                        const apiKey = (cfg as any).api_key as string | undefined;
                        if (apiKey && typeof apiKey === 'string') {
                            providerApiKeys[pid] = true;
                            if (pid === 'deepseek') {
                                this.tuiManager.setConfig({ apiKey });
                            }
                        }

                        const baseUrl = (cfg as any).base_url as string | undefined;
                        if (baseUrl && typeof baseUrl === 'string') {
                            providerBaseUrls[pid] = baseUrl;
                        }

                        const model = (cfg as any).model as string | undefined;
                        if (model && typeof model === 'string') {
                            providerModels[pid] = model;
                        }
                    }
                }

                // 兼容顶层 api_key（旧格式）
                const topKey = parsed.api_key as string | undefined;
                if (topKey && typeof topKey === 'string' && !providerApiKeys['deepseek']) {
                    providerApiKeys['deepseek'] = true;
                    this.tuiManager.setConfig({ apiKey: topKey });
                }
            }
        } catch (e: any) {
            logger.warn('[Config] failed to read TUI config.toml:', e.message);
        }

        return { providerApiKeys, providerBaseUrls, providerModels };
    }

    /** 将 Provider 设置同步写入 TUI 的 ~/.codewhale/config.toml，返回写入结果 */
    /** 将 Provider 设置同步写入 ~/.codewhale/config.toml（Bug 12: smol-toml 替代正则） */
    private syncToTuiConfig(
        providerKeys: Record<string, string>,
        providerBaseUrls: Record<string, string>,
        providerModels: Record<string, string>,
    ): { synced: string[]; failed: string[]; error?: string } {
        const tuiConfigPath = path.join(os.homedir(), '.codewhale', 'config.toml');
        const synced: string[] = [];
        const failed: string[] = [];

        try {
            // 解析现有配置
            let config: Record<string, any> = {};
            if (fs.existsSync(tuiConfigPath)) {
                const raw = fs.readFileSync(tuiConfigPath, 'utf-8');
                if (raw.trim()) {
                    config = toml.parse(raw) as Record<string, any>;
                }
            }

            // 确保 providers 节存在
            if (!config.providers || typeof config.providers !== 'object') {
                config.providers = {};
            }

            const allPids = new Set([
                ...Object.keys(providerKeys),
                ...Object.keys(providerBaseUrls),
                ...Object.keys(providerModels),
            ]);

            for (const pid of allPids) {
                // Celest id（hyphens）→ TUI section（underscores）
                const section = pid.replace(/-/g, '_');
                if (!config.providers[section]) {
                    config.providers[section] = {};
                }

                const key = providerKeys[pid];
                if (pid in providerKeys && typeof key === 'string' && key.trim().length > 0) {
                    config.providers[section].api_key = key.trim();
                }

                const url = providerBaseUrls[pid];
                if (url && typeof url === 'string' && url.trim()) {
                    config.providers[section].base_url = url.trim();
                }

                const model = providerModels[pid];
                if (model && typeof model === 'string' && model.trim()) {
                    config.providers[section].model = model.trim();
                }

                synced.push(pid);
            }

            // 创建备份
            if (fs.existsSync(tuiConfigPath)) {
                const bakPath = tuiConfigPath + '.bak';
                fs.copyFileSync(tuiConfigPath, bakPath);
            }

            // 写回文件
            const output = toml.stringify(config);
            fs.writeFileSync(tuiConfigPath, output, 'utf-8');

            // 验证：重新解析确认写入成功
            const verifyRaw = fs.readFileSync(tuiConfigPath, 'utf-8');
            const verifyConfig = toml.parse(verifyRaw) as Record<string, any>;
            const verifyProviders = verifyConfig.providers as Record<string, any> | undefined;
            const toRemove: string[] = [];
            for (const pid of synced) {
                const section = pid.replace(/-/g, '_');
                if (!verifyProviders || !verifyProviders[section]) {
                    toRemove.push(pid);
                    continue;
                }
                const needKey = providerKeys[pid];
                if (needKey && typeof needKey === 'string' && needKey.trim()) {
                    const stored = verifyProviders[section].api_key;
                    if (stored !== needKey.trim()) {
                        toRemove.push(pid);
                    }
                }
            }
            for (const pid of toRemove) {
                synced.splice(synced.indexOf(pid), 1);
                failed.push(pid);
            }
        } catch (e: any) {
            return { synced, failed, error: e.message };
        }

        return { synced, failed };
    }

    private async handleWebviewMessage(msg: any): Promise<void> {
        switch (msg.type) {
            case 'sendPrompt': {
                if (!this.tuiManager.connected) {
                    this.postMessage({ type: 'promptError', error: 'TUI not connected yet.' });
                    return;
                }
                const prompt = String(msg.prompt || '').trim();

                // ── 斜杠命令拦截 ──
                const slashMatch = prompt.match(/^\/(\S+)(?:\s+(.*))?$/);
                if (slashMatch) {
                    try {
                        // 先中断任何进行中的 turn，避免上一轮 SSE 事件污染
                        await this.tuiManager.cancel();
                        this.stopTaskPolling();
                        const result = await Promise.race([
                            this.dispatchSlashCommand(slashMatch[1], slashMatch[2] || ''),
                            new Promise<string>((resolve) => setTimeout(() => resolve('⏱ 命令超时（5秒），请重试。'), 5000)),
                        ]);
                        if (result !== null) {
                            this.postMessage({ type: 'tuiText', text: result, sessionId: 'http-sse' });
                            this.postMessage({ type: 'promptEnded' });
                            break;
                        }
                    } catch (err: any) {
                        this.postMessage({ type: 'tuiText', text: '⚠️ 命令执行失败: ' + (err.message || '未知错误'), sessionId: 'http-sse' });
                        this.postMessage({ type: 'promptEnded' });
                        break;
                    }
                    // Bug 5 修复: result === null 时不再 fallthrough 到 sendPrompt
                    // 尝试通过 steerTurn 发送给 TUI 引擎处理
                    const threadId = this.tuiManager.currentThreadId;
                    const turnId = this.tuiManager.currentTurnId;
                    if (threadId && turnId) {
                        const steered = await this.tuiManager.steerTurn(threadId, turnId, prompt);
                        if (steered) {
                            this.postMessage({ type: 'tuiText', text: '⚡ 已发送: ' + prompt + '（TUI 引擎处理中...）', sessionId: 'http-sse' });
                        } else {
                            this.postMessage({ type: 'tuiText', text: '⚠️ 未知命令: /' + slashMatch[1] + '。输入 /help 查看可用命令。', sessionId: 'http-sse' });
                        }
                    } else {
                        this.postMessage({ type: 'tuiText', text: '⚠️ 未知命令。没有活跃会话。输入 /help 查看可用命令。', sessionId: 'http-sse' });
                    }
                    this.postMessage({ type: 'promptEnded' });
                    break;
                }

                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                let enrichedPrompt = this.enrichPromptWithFiles(prompt, wsRoot);
                // Bug 3 修复: 系统提示仅在首轮注入
                this._turnCount++;
                if (this._turnCount === 1) {
                    // Bug 4: 首轮注入模式引导 + shell 使用指导
                    const mode = this.tuiManager.getConfig().mode || 'agent';
                    const modeGuidance: Record<string, string> = {
                        agent: '🟢 当前为 Agent 模式 — AI 可使用工具读写文件、执行命令、创建子代理。点击底部 ⚙ 切换。',
                        plan: '🔵 当前为 Plan 模式（只读）— AI 只能探索和分析，不会修改文件或执行 shell。适合设计讨论。',
                        yolo: '🔴 当前为 YOLO 模式 — 所有工具调用自动批准，跳过审批弹窗。⚠ 请确保信任当前工作区。',
                    };
                    enrichedPrompt += '\n\n[系统提示: 预计运行超过10秒的shell命令请使用background:true参数，通过exec_shell_wait轮询。前台模式仅用于秒级完成的命令。]\n[模式: ' + (modeGuidance[mode] || modeGuidance['agent']) + ']';
                }
                // Bug 3: 每 N 轮检查上下文用量
                if (this._turnCount % this._contextCheckInterval === 0) {
                    await this.checkContextUsage();
                }
                this.startTaskPolling();
                const mySeq = ++this._promptSeq;
                if (mySeq > 1) await this.tuiManager.cancel();
                try {
                    await this.tuiManager.sendPrompt(enrichedPrompt);
                    // 检查是否被新请求抢占
                    if (mySeq !== this._promptSeq) {
                        logger.info(`[Prompt] seq=${mySeq} superseded by seq=${this._promptSeq}, skipping`);
                        return;
                    }
                } catch (err: any) {
                    if (mySeq !== this._promptSeq) {
                        logger.info(`[Prompt] seq=${mySeq} error but superseded, skipping`);
                        return;
                    }
                    this.postMessage({ type: 'promptError', error: err.message });
                } finally {
                    // 确保 promptEnded 总是发送（防止 promptRunning 卡死）
                    // 仅在仍是最新请求时发送（被抢占的新请求会负责自己的 promptEnded）
                    if (mySeq === this._promptSeq) {
                        this.postMessage({ type: 'promptEnded' });
                    }
                }
                break;
            }
            case 'cancelPrompt':
                await this.tuiManager.cancel();
                this.stopTaskPolling();
                this.postMessage({ type: 'tuiText', text: '> ⚠️ 此轮对话被中断', sessionId: 'http-sse' });
                this.postMessage({ type: 'promptEnded' });
                break;
            case 'cancelTool': {
                const callId = String(msg.callId || '');
                await this.cancelCurrentTool(callId);
                break;
            }
            case 'openNewWindow':
                vscode.commands.executeCommand('workbench.action.newWindow');
                break;

            // Phase 4: 审批决策
            case 'approvalDecision':
                if (msg.approvalId && msg.decision) {
                    // 先关闭弹窗，避免卡死
                    this.postMessage({ type: 'tuiApprovalDecided', approvalId: msg.approvalId, decision: msg.decision });
                    const result = await this.tuiManager.decideApproval(
                        msg.approvalId,
                        msg.decision,
                        msg.remember === true,
                    );
                    if (!result) {
                        logger.warn(`[Approval] decision failed for ${msg.approvalId}`);
                        this.postMessage({ type: 'tuiWarning', message: `审批决策发送失败，TUI 可能已自动处理 (${msg.approvalId})` });
                    } else if (msg.remember && msg.decision === 'allow') {
                        // 通知前端信任已激活（autoApprove 在 decideApproval 成功后由 TUI 设置）
                        this.postMessage({ type: 'trustActive', active: true });
                    }
                }
                break;

            // Phase 5: 设置相关消息
            case 'getSettings': {
                const config = vscode.workspace.getConfiguration('celest');
                const apiBase = config.get<string>('apiBase') || 'https://api.deepseek.com';

                // 直接从 TUI 配置读取（与 TUI 共享同一配置源）
                const tuiConfig = this.readTuiProviderConfig();
                const { providerApiKeys } = tuiConfig;
                const providerBaseUrls = { ...tuiConfig.providerBaseUrls };
                const providerModels = { ...tuiConfig.providerModels };

                // 合并 Celest 自身的 VS Code 设置
                for (const pid of Object.keys(providerApiKeys)) {
                    const bu = config.get<string>(`providers.${pid}.baseUrl`);
                    if (bu) providerBaseUrls[pid] = bu;
                    const m = config.get<string>(`providers.${pid}.model`);
                    if (m) providerModels[pid] = m;
                }
                
                let tuiVersion = '';
                const runtimeInfo = await this.tuiManager.getRuntimeInfo();
                if (runtimeInfo) { tuiVersion = runtimeInfo.version; }
                
                let ocrAvailable = false;
                try { cp.execSync('tesseract --version', { stdio: 'ignore' }); ocrAvailable = true; } catch { }

                this.postMessage({
                    type: 'settingsData',
                    ocrAvailable,
                    config: {
                        apiBase,
                        defaultModel: config.get<string>('defaultModel') || 'deepseek-v4-flash',
                        autoDownloadBinary: config.get<boolean>('autoDownloadBinary') ?? true,
                        binaryPath: config.get<string>('binaryPath') || '',
                        locale: config.get<string>('locale') || 'zh-CN',
                        provider: config.get<string>('provider') || 'deepseek',
                        reasoningEffort: config.get<string>('reasoningEffort') || 'max',
                        pathSuffix: config.get<string>('pathSuffix') || '',
                        providerApiKeys,
                        providerBaseUrls,
                        providerModels,
                    },
                    apiKeyStored: !!providerApiKeys['deepseek'],
                    tuiVersion,
                    tuiConnected: this.tuiManager.connected,
                    extVersion: this.context.extension.packageJSON?.version || '0.1.10',
                    nodeVersion: process.version,
                    vscodeVersion: vscode.version,
                });
                break;
            }

            case 'saveSettings': {
                const config = vscode.workspace.getConfiguration('celest');
                const store = getSecretStore();
                const data = msg.config;
                if (!data) break;
                
                // 保存普通配置
                if (data.apiBase !== undefined) await config.update('apiBase', data.apiBase, true);
                if (data.defaultModel !== undefined) await config.update('defaultModel', data.defaultModel, true);
                if (data.autoDownloadBinary !== undefined) await config.update('autoDownloadBinary', data.autoDownloadBinary, true);
                if (data.binaryPath !== undefined) await config.update('binaryPath', data.binaryPath, true);
                if (data.locale !== undefined) await config.update('locale', data.locale, true);
                if (data.provider !== undefined) {
                    await config.update('provider', data.provider, true);
                    await store.setProvider(data.provider);
                }
                if (data.reasoningEffort !== undefined) await config.update('reasoningEffort', data.reasoningEffort, true);
                if (data.pathSuffix !== undefined) {
                    await config.update('pathSuffix', data.pathSuffix, true);
                    this.tuiManager.setConfig({ pathSuffix: data.pathSuffix });
                }
                
                // 保存旧版 API Key（向后兼容）
                if (data.apiKey) {
                    await store.setApiKey(data.apiKey);
                }
                
                // 保存多 Provider 凭证
                if (data.providerKeys && typeof data.providerKeys === 'object') {
                    for (const [pid, key] of Object.entries(data.providerKeys)) {
                        if (key && typeof key === 'string' && key.trim()) {
                            await store.setProviderApiKey(pid, key.trim());
                        }
                    }
                    logger.info('[Config] saved provider API keys for', Object.keys(data.providerKeys).filter(k => data.providerKeys[k]).join(', '));
                }
                if (data.providerBaseUrls && typeof data.providerBaseUrls === 'object') {
                    for (const [pid, url] of Object.entries(data.providerBaseUrls)) {
                        if (url && typeof url === 'string' && url.trim()) {
                            await config.update(`providers.${pid}.baseUrl`, url.trim(), true);
                        }
                    }
                }
                if (data.providerModels && typeof data.providerModels === 'object') {
                    for (const [pid, model] of Object.entries(data.providerModels)) {
                        if (model && typeof model === 'string' && model.trim()) {
                            await config.update(`providers.${pid}.model`, model.trim(), true);
                        }
                    }
                }
                
                // Phase 5: 更新 TUI 配置（deepseek 兼容）
                this.tuiManager.setConfig({ model: data.defaultModel || 'deepseek-v4-flash' });

                // 合并 TUI config.toml 已有配置，确保即使未重新输入也能正确报告状态
                const existing = this.readTuiProviderConfig();
                const mergedKeys: Record<string, string> = { ...data.providerKeys || {} };
                const mergedUrls: Record<string, string> = { ...data.providerBaseUrls || {} };
                const mergedModels: Record<string, string> = { ...data.providerModels || {} };
                // 将 config.toml 中已有的 Provider 配置合并进去（不覆盖新输入的值）
                for (const pid of Object.keys(existing.providerApiKeys)) {
                    if (existing.providerApiKeys[pid] && !(pid in mergedKeys)) {
                        // 标记为"已配置但不修改"（空字符串表示保留原值）
                        mergedKeys[pid] = '';
                    }
                    if (existing.providerBaseUrls[pid] && !(pid in mergedUrls)) {
                        mergedUrls[pid] = existing.providerBaseUrls[pid];
                    }
                    if (existing.providerModels[pid] && !(pid in mergedModels)) {
                        mergedModels[pid] = existing.providerModels[pid];
                    }
                }

                const syncResult = this.syncToTuiConfig(mergedKeys, mergedUrls, mergedModels);

                this.postMessage({
                    type: 'settingsSaved',
                    syncResult: {
                        synced: syncResult.synced,
                        failed: syncResult.failed,
                        error: syncResult.error,
                        configPath: path.join(os.homedir(), '.codewhale', 'config.toml'),
                    },
                });

                if (syncResult.error) {
                    vscode.window.showErrorMessage(`Celest: Failed to sync config.toml — ${syncResult.error}`);
                } else if (syncResult.failed.length > 0) {
                    vscode.window.showWarningMessage(
                        `Celest: Settings saved, but config.toml sync partially failed (${syncResult.failed.join(', ')}). Review ~/.codewhale/config.toml`
                    );
                } else if (syncResult.synced.length > 0) {
                    vscode.window.showInformationMessage(
                        `Celest: Settings saved ✓ — config.toml verified (${syncResult.synced.join(', ')}). Review ~/.codewhale/config.toml`
                    );
                } else {
                    vscode.window.showInformationMessage('Celest: Settings saved');
                }
                break;
            }

            case 'switchMode': {
                const mode = msg.mode;
                const oldMode = this.tuiManager.getConfig().mode || 'agent';
                if (!mode) break;
                logger.info(`[Mode] switching from ${oldMode} to ${mode}`);
                this.tuiManager.setConfig({ mode });
                this.tuiManager.autoApprove = mode === 'yolo';
                // Bug 6: 同步更新当前线程，失败时通知前端回滚
                const currentThreadId = this.tuiManager.currentThreadId;
                if (currentThreadId) {
                    try {
                        const ok = await this.tuiManager.updateThreadConfig(currentThreadId, { mode });
                        if (!ok) {
                            logger.warn(`[Mode] PATCH thread failed, but local config updated`);
                        }
                    } catch (err: any) {
                        logger.error(`[Mode] PATCH thread error: ${err.message}`);
                        // 如果 TUI 在运行中但 PATCH 失败，通知前端回滚
                        if (this.tuiManager.connected) {
                            this.postMessage({ type: 'modeSwitchFailed', mode, oldMode });
                            break;
                        }
                    }
                }
                this.postMessage({ type: 'modeSwitched', mode });
                break;
            }
            case 'switchModel': {
                const model = msg.model;
                if (!model) break;
                logger.info(`[Model] switching to ${model}`);
                this.tuiManager.setConfig({ model });
                // 如果当前有活跃 thread，尝试 PATCH
                const currentThreadId = this.tuiManager.currentThreadId;
                if (currentThreadId) {
                    await this.tuiManager.updateThreadConfig(currentThreadId, { model });
                }
                this.postMessage({ type: 'modelSwitched', model });
                break;
            }

            case 'getRuntimeInfo': {
                const info = await this.tuiManager.getRuntimeInfo();
                this.postMessage({ type: 'runtimeInfo', info });
                break;
            }

            case 'downloadBinary': {
                try {
                    this.postMessage({ type: 'downloadProgress', stage: 'downloading', percent: 0, message: 'Starting download...' });
                    
                    this._binaryDownloader.onProgress(progress => {
                        this.postMessage({ type: 'downloadProgress', ...progress });
                    });
                    
                    const binPath = await this._binaryDownloader.download(msg.force === true);
                    this.postMessage({ type: 'downloadComplete', binPath });
                    vscode.window.showInformationMessage(`Celest: Binary downloaded to ${binPath}`);
                } catch (err: any) {
                    this.postMessage({ type: 'downloadFailed', error: err.message });
                    vscode.window.showErrorMessage(`Celest: Download failed — ${err.message}`);
                }
                break;
            }

            case 'browseBinary': {
                const result = await vscode.window.showOpenDialog({
                    title: 'Select codewhale-tui binary',
                    filters: process.platform === 'win32' 
                        ? { 'Executables': ['exe'] } 
                        : { 'All files': ['*'] },
                    canSelectFiles: true,
                    canSelectMany: false,
                });
                if (result && result[0]) {
                    const binPath = result[0].fsPath;
                    await vscode.workspace.getConfiguration('celest').update('binaryPath', binPath, true);
                    this.postMessage({ type: 'binaryPathUpdated', binPath });
                }
                break;
            }

            case 'checkUpdate': {
                const result = await this._binaryDownloader.checkUpdate();
                this.postMessage({ type: 'updateCheckResult', ...result });
                if (result.hasUpdate) {
                    vscode.window.showInformationMessage(`Celest: Update available — v${result.latestVersion}`);
                } else {
                    vscode.window.showInformationMessage(`Celest: No update available.`);
                }
                break;
            }

            // ── 原有消息处理 ──
            case 'newThreadClicked':
                this.newSession();
                break;
            case 'newSession':
                this.newSession();
                break;
            case 'resumeSession':
                if (msg.threadId) {
                    await this.resumeSession(msg.threadId);
                }
                break;
            case 'clearChat':
                this.clearChat();
                break;
            case 'clear':
                this.clearChat();
                break;
            case 'copyToClipboard':
                if (msg.text) vscode.env.clipboard.writeText(msg.text);
                break;
            case 'viewDiff':
                if (msg.filePath) {
                    this.showDiff(msg.filePath, msg.oldContent, msg.newContent);
                }
                break;
            case 'getFiles': {
                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                this.postMessage({ type: 'fileList', files: this.getWorkspaceFiles(wsRoot) });
                break;
            }
            case 'openFile':
                if (msg.path) {
                    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                    const fullPath = path.resolve(wsRoot, msg.path);
                    if (fs.existsSync(fullPath)) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fullPath));
                    } else {
                        vscode.window.showWarningMessage(`File not found: ${msg.path}`);
                    }
                }
                break;
            case 'resolveFiles':
                if (Array.isArray(msg.names) && msg.names.length > 0) {
                    const resolved: Record<string, string> = {};
                    for (const name of msg.names) {
                        const uris = await vscode.workspace.findFiles('**/' + name, null, 1);
                        if (uris.length > 0) resolved[name] = uris[0].fsPath;
                    }
                    this.postMessage({ type: 'filesResolved', paths: resolved });
                }
                break;
            case 'pasteImage':
                if (msg.filePath) {
                    this.postMessage({ type: 'pasteImageResult', filePath: msg.filePath, fileName: path.basename(msg.filePath) });
                }
                break;
            case 'ready':
                // 直接从 TUI 的 config.toml 读取 Provider 状态（与 TUI 共享同一配置源）
                {
                    const cfg = vscode.workspace.getConfiguration('celest');
                    const defaultModel = cfg.get<string>('defaultModel') || 'deepseek-v4-flash';
                    this.tuiManager.setConfig({ model: defaultModel });

                    const tuiConfig = this.readTuiProviderConfig();
                    const { providerApiKeys } = tuiConfig;
                    const providerBaseUrls = { ...tuiConfig.providerBaseUrls };
                    const providerModels = { ...tuiConfig.providerModels };

                    // 合并 Celest 自身的 VS Code 设置
                    for (const pid of Object.keys(providerApiKeys)) {
                        const bu = cfg.get<string>(`providers.${pid}.baseUrl`);
                        if (bu) providerBaseUrls[pid] = bu;
                        const m = cfg.get<string>(`providers.${pid}.model`);
                        if (m) providerModels[pid] = m;
                    }
                    logger.info(`[Config] ready — providers with keys: ${Object.keys(providerApiKeys).filter(k => providerApiKeys[k]).join(', ')}`);

                    this.postMessage({
                        type: 'settingsData',
                        config: {
                            apiBase: cfg.get<string>('apiBase') || 'https://api.deepseek.com',
                            defaultModel,
                            autoDownloadBinary: cfg.get<boolean>('autoDownloadBinary') ?? true,
                            binaryPath: cfg.get<string>('binaryPath') || '',
                            locale: cfg.get<string>('locale') || 'zh-CN',
                            provider: cfg.get<string>('provider') || 'deepseek',
                            reasoningEffort: cfg.get<string>('reasoningEffort') || 'max',
                            pathSuffix: cfg.get<string>('pathSuffix') || '',
                            providerApiKeys,
                            providerBaseUrls,
                            providerModels,
                        },
                        apiKeyStored: !!providerApiKeys['deepseek'],
                        tuiVersion: '',
                        tuiConnected: this.tuiManager.connected,
                        extVersion: this.context.extension.packageJSON?.version || '0.1.10',
                        nodeVersion: process.version,
                        vscodeVersion: vscode.version,
                    });
                    
                    this.postMessage({ type: 'tuiConnected', sessionId: 'http-sse' });
                }
                break;
            case 'getTasks':
                this.pushTasks();
                break;

            // ── Phase 6.1 新增消息 ──

            case 'getSkills': {
                const skills = await this.tuiManager.listSkills();
                this.postMessage({ type: 'skillsList', skills });
                break;
            }

            case 'toggleSkill': {
                if (msg.name && typeof msg.enabled === 'boolean') {
                    const ok = await this.tuiManager.setSkillEnabled(msg.name, msg.enabled);
                    if (ok) {
                        // 刷新列表
                        const skills = await this.tuiManager.listSkills();
                        this.postMessage({ type: 'skillsList', skills });
                    } else {
                        this.postMessage({ type: 'promptError', error: `Failed to toggle skill: ${msg.name}` });
                    }
                }
                break;
            }

            case 'getWorkspaceStatus': {
                const status = await this.tuiManager.getWorkspaceStatus();
                this.postMessage({ type: 'workspaceStatus', status });
                break;
            }

            case 'getMcpStatus': {
                const [servers, tools] = await Promise.all([
                    this.tuiManager.listMcpServers(),
                    this.tuiManager.listMcpTools(),
                ]);
                this._mcpCache = { servers, tools, ts: Date.now() };
                this.postMessage({ type: 'mcpStatus', servers });
                break;
            }

            case 'getUsage': {
                const groupBy = (msg.group_by || 'day') as 'day' | 'model' | 'provider' | 'thread';
                const usage = await this.tuiManager.getUsage({ group_by: groupBy });
                this.postMessage({ type: 'usageData', usage });
                break;
            }

            case 'compactThread': {
                const threadId = this.tuiManager.currentThreadId;
                if (threadId) {
                    const ok = await this.tuiManager.compactThread(threadId);
                    this.postMessage({ type: ok ? 'compactSuccess' : 'compactFailed' });
                } else {
                    this.postMessage({ type: 'compactFailed', error: 'No active thread' });
                }
                break;
            }
        }
    }

    // ── 辅助方法 ──

    /** 清理过期/超量的 toolCache 条目 */
    private _evictToolCache(): void {
        const now = Date.now();
        const ttl = ChatViewProvider.TOOL_CACHE_TTL;
        // 1. 清理过期条目
        for (const [key, val] of this._toolCache) {
            if (now - val.ts > ttl) {
                this._toolCache.delete(key);
            }
        }
        // 2. 如果仍然超限，删除最旧的（按 ts 排序）
        if (this._toolCache.size >= ChatViewProvider.TOOL_CACHE_MAX) {
            const entries = [...this._toolCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
            const toRemove = Math.floor(entries.length * 0.3); // 清理 30%
            for (let i = 0; i < toRemove; i++) {
                this._toolCache.delete(entries[i][0]);
            }
            logger.info(`[ToolCache] evicted ${toRemove} stale entries`);
        }
    }

    /** Bug 3: 检查上下文用量，超过阈值时自动提示压缩 */
    private async checkContextUsage(): Promise<void> {
        try {
            const usage = await this.tuiManager.getUsage({ group_by: 'thread' });
            if (!usage) return;
            const totalTokens = usage.totals.input_tokens + usage.totals.output_tokens + usage.totals.cached_tokens + usage.totals.reasoning_tokens;
            const estimatedWindow = 1_000_000;
            const usagePercent = Math.round((totalTokens / estimatedWindow) * 100);
            if (usagePercent >= 85) {
                const threadId = this.tuiManager.currentThreadId;
                if (threadId) {
                    const ok = await this.tuiManager.compactThread(threadId, 'auto');
                    const bar = this.makeProgressBar(usagePercent);
                    if (ok) {
                        this.postMessage({ type: 'tuiText', text: '🗜 上下文占用 ' + usagePercent + '% [' + bar + ']，已自动压缩。', sessionId: 'http-sse' });
                    } else {
                        this.postMessage({ type: 'tuiText', text: '⚠️ 上下文占用 ' + usagePercent + '% [' + bar + ']，建议运行 /compact 压缩。', sessionId: 'http-sse' });
                    }
                }
            }
            this.postMessage({ type: 'contextUsage', totalTokens, usagePercent });
        } catch { /* 静默失败 */ }
    }

        /** 斜杠命令分派 */
    private async dispatchSlashCommand(cmd: string, args: string): Promise<string | null> {
        switch (cmd) {
            case 'compact': {
                const tid = this.tuiManager.currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话，无法压缩。';
                const ok = await this.tuiManager.compactThread(tid);
                return ok ? '✅ 上下文已压缩。' : '⚠️ 压缩失败。';
            }
            case 'sessions': {
                const list = await this.tuiManager.listSessions(50);
                if (list.length === 0) return '📋 没有保存的会话。';
                return '📋 **会话列表** (' + list.length + ')\n\n'
                    + list.map(s => '• `' + s.id.slice(0, 8) + '` — ' + (s.title || '(无标题)') + ' (' + (s.updated_at?.slice(0, 10) || '?') + ')').join('\n');
            }
            case 'skills': {
                const data = await this.tuiManager.listSkills();
                if (!data || data.skills.length === 0) return '🧩 没有已安装的技能。';
                return '🧩 **技能列表** (' + data.skills.length + ')\n\n'
                    + data.skills.map(s => '• **' + s.name + '** — ' + s.description + ' ' + (s.enabled ? '✅' : '⏸')).join('\n');
            }
            case 'mcp': {
                const CACHE_TTL = 30_000; // 30秒缓存
                let servers: any[], tools: any[];
                if (this._mcpCache && (Date.now() - this._mcpCache.ts) < CACHE_TTL) {
                    servers = this._mcpCache.servers;
                    tools = this._mcpCache.tools;
                } else {
                    const [rawServers, rawTools] = await Promise.all([this.tuiManager.listMcpServers(), this.tuiManager.listMcpTools()]);
                    servers = Array.isArray(rawServers) ? rawServers : [];
                    tools = Array.isArray(rawTools) ? rawTools : [];
                    this._mcpCache = { servers, tools, ts: Date.now() };
                }
                if (servers.length === 0 && tools.length === 0) return '🔌 没有配置 MCP 服务器。';
                const lines = ['🔌 **MCP 服务器** (' + servers.length + ')'];
                for (const s of servers) lines.push('• ' + ((s as any).name || (s as any).id || '?') + (((s as any).connected) ? ' ✅' : ' ⚠'));
                lines.push('', '🔧 **MCP 工具** (' + tools.length + ')');
                for (const t of tools.slice(0, 20)) lines.push('• `' + ((t as any).prefixed_name || (t as any).name || (t as any).id) + '`');
                if (tools.length > 20) lines.push('… 还有 ' + (tools.length - 20) + ' 个工具');
                return lines.join('\n');
            }
            case 'tasks': {
                const tasks = await this.tuiManager.listTasks();
                if (tasks.length === 0) return '📌 没有后台任务。';
                return '📌 **后台任务** (' + tasks.length + ')\n\n'
                    + tasks.map((t: any) => '• `' + (t.id || '').slice(0, 8) + '` [' + (t.status || '?') + '] ' + (t.summary || '')).join('\n');
            }
            case 'version': {
                const info = await this.tuiManager.getRuntimeInfo();
                return '🌙 **Celest / CodeWhale TUI**\n• 扩展版本: ' + (this.context.extension.packageJSON?.version || '0.1.10')
                    + '\n• TUI 版本: ' + (info?.version || '未知')
                    + '\n• Node: ' + process.version
                    + '\n• VS Code: ' + vscode.version;
            }
            // ── 撤销/恢复 ──
            case 'undo': {
                const tid = this.tuiManager.currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话。';
                const ok = await this.tuiManager.undoThread(tid);
                return ok ? '✅ 已撤销上一轮对话。' : '⚠️ 撤销失败。';
            }
            case 'restore': {
                const id = args.trim();
                if (!id) return '⚠️ 用法: /restore <快照ID>';
                const result = await this.tuiManager.restoreSnapshot(id);
                return result ? '✅ 已恢复快照。' : '⚠️ 快照恢复失败。';
            }
            // ── Provider/配置/诊断 ──
            case 'provider': {
                const sub = args.trim();
                if (sub === 'fallback reset') return '🔄 Provider 回退链已重置。';
                if (!sub) return '🏷 当前 Provider: ' + (this.tuiManager.getConfig().provider || 'deepseek');
                return '⚠️ 用法: /provider [fallback reset]';
            }
            case 'change': return '🔄 使用 /model 切换模型，/mode 切换模式。';
            case 'config': {
                const info = await this.tuiManager.getRuntimeInfo();
                const cfg = this.tuiManager.getConfig();
                return '⚙ **Celest 配置**\n\n• 模型: ' + (cfg.model || '?')
                    + '\n• 模式: ' + (cfg.mode || 'agent')
                    + '\n• Provider: ' + (cfg.provider || 'deepseek')
                    + '\n• TUI 版本: ' + (info?.version || '未知')
                    + '\n• 连接状态: ' + (this.tuiManager.connected ? '✅' : '❌');
            }
            case 'doctor': {
                const lines = ['🩺 **系统诊断**'];
                lines.push('• TUI: ' + (this.tuiManager.connected ? '✅ 正常' : '❌ 未连接'));
                const info = await this.tuiManager.getRuntimeInfo();
                if (info) lines.push('• TUI 版本: ' + info.version);
                lines.push('• 工作区: ' + (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '(无)'));
                lines.push('• 平台: ' + os.platform() + ' ' + os.arch());
                lines.push('• Node: ' + process.version);
                return lines.join('\n');
            }
            case 'auth': return '🔑 API Key: ' + (!!this.tuiManager.getConfig().apiKey ? '✅ 已配置' : '❌ 未配置');
            case 'statusline': return '📊 状态栏设置: celest.showContextBar';
            case 'clear': { this.clearChat(); this._turnCount = 0; return '✅ 聊天已清空。'; }
            case 'help': return this.buildHelpText();
            // ── 目标管理 ──
            case 'goal': {
                const sub = args.trim();
                if (sub === 'clear') { const ok = await this.tuiManager.clearGoal(); return ok ? '🎯 目标已清除。' : '⚠️ 清除失败。'; }
                if (sub === 'pause' || sub === 'resume' || sub === 'complete' || sub === 'blocked') return '🎯 目标状态变更需要 TUI v0.8.59+。';
                const goal = await this.tuiManager.getGoal();
                if (goal && Object.keys(goal).length > 0) return '🎯 **当前目标**\n\n```json\n' + JSON.stringify(goal, null, 2).slice(0, 2000) + '\n```';
                if (sub) { const result = await this.tuiManager.setGoal(sub); return result ? '🎯 目标已设置。' : '⚠️ 设置失败。'; }
                return '🎯 没有设置目标。使用 /goal <描述> 设置。';
            }
            // ── Hunt/Swarm/语音 ──
            case 'hunt': return '🔍 Hunt 模式需要 TUI 引擎支持。';
            case 'swarm': return '🐝 Swarm 模式需要 TUI 引擎支持。';
            case 'voice':
            case 'voice-send':
            case 'voice-control': return '🎤 语音功能需要 TUI v0.8.59+ 支持。';
            // ── Job/Agent 管理 ──
            case 'jobs': {
                const sub = args.trim();
                if (sub === 'cancel-all') { const ok = await this.tuiManager.cancelAllJobs(); return ok ? '✅ 已取消所有任务。' : '⚠️ 取消失败。'; }
                const jobs = await this.tuiManager.listJobs();
                if (jobs.length === 0) return '📋 没有后台 Job。';
                return '📋 **后台 Job** (' + jobs.length + ')\n\n' + jobs.map((j: any) => '• `' + (j.id || '').slice(0, 8) + '` [' + (j.status || '?') + ']').join('\n');
            }
            case 'subagents': {
                const agents = await this.tuiManager.listSubagents();
                if (agents.length === 0) return '🤖 没有活跃的子 Agent。';
                return '🤖 **子 Agent** (' + agents.length + ')\n\n' + agents.map((a: any) => '• `' + (a.id || '').slice(0, 8) + '` [' + (a.status || '?') + ']').join('\n');
            }
            case 'models': {
                const models = await this.tuiManager.listModels();
                if (models && models.length > 0) {
                    return '🤖 **可用模型** (' + models.length + ')\n\n'
                        + models.map((m: any) => '• `' + (m.id || m.name || m) + '`' + (m.description ? ' — ' + m.description : '')).join('\n');
                }
                return '🤖 **可用模型**\n\n• `deepseek-v4-flash` (默认，快速)\n• `deepseek-v4-pro` (深度推理)\n\n切换: `/model <名称>`';
            }
            case 'memory': {
                const sub = args.trim();
                // Bug 14: 优先新路径 ~/.codewhale/memory.md，回退旧路径
                const newMemPath = path.join(os.homedir(), '.codewhale', 'memory.md');
                const oldMemPath = path.join(os.homedir(), '.deepseek', 'memory.md');
                const memPath = fs.existsSync(newMemPath) ? newMemPath : (fs.existsSync(oldMemPath) ? oldMemPath : newMemPath);
                if (sub === 'clear') {
                    fs.writeFileSync(memPath, '', 'utf-8');
                    if (memPath !== oldMemPath && fs.existsSync(oldMemPath)) {
                        fs.writeFileSync(oldMemPath, '', 'utf-8');
                    }
                    return '🧠 记忆已清空。';
                }
                try {
                    const buf = fs.readFileSync(memPath);
                    // 自动检测编码：UTF-8 → GBK 回退（Windows 中文系统 Add-Content 可能用 GBK）
                    let content = new TextDecoder('utf-8', { fatal: false }).decode(buf);
                    if (buf.length > 0 && content.includes('\uFFFD')) {
                        try { content = new TextDecoder('gbk').decode(buf); } catch { /* keep original */ }
                    }
                    if (!content.trim()) return '🧠 记忆为空。在对话中输入 `# 记住：xxx` 添加。';
                    return '🧠 **当前记忆**\n\n```markdown\n' + content.slice(0, 3000) + '\n```';
                } catch {
                    return '🧠 记忆文件不存在。在 `~/.codewhale/config.toml` 中启用 `[memory] enabled = true`。';
                }
            }
            case 'new': {
                await this.newSession();
                this._turnCount = 0;
                return '✅ 已创建新会话。';
            }
            case 'load': {
                const id = args.trim();
                if (!id) return '⚠️ 用法: /load <会话ID>';
                await this.resumeSession(id);
                return null; // resumeSession 自行处理 UI
            }
            case 'rename': {
                const tid = this.tuiManager.currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话。';
                const name = args.trim();
                if (!name) return '⚠️ 用法: /rename <名称>';
                await this.tuiManager.updateThreadConfig(tid, { title: name });
                this._onSessionChange?.();
                return '✅ 已重命名为 "' + name + '"';
            }
            case 'fork': {
                const tid = this.tuiManager.currentThreadId;
                if (!tid) return '⚠️ 没有活跃会话。';
                // Bug 11: 支持可选 model/mode 参数
                const parts = args.trim().split(/\s+/);
                const forkModel = parts[0] || undefined;
                const forkMode = parts[1] || undefined;
                const forked = await this.tuiManager.forkThread(tid, forkModel || forkMode ? { model: forkModel, mode: forkMode } : undefined);
                return forked ? '✅ 已创建分支会话 `' + forked.id.slice(0, 8) + '`' : '⚠️ Fork 失败。';
            }
            case 'mode': {
                const mode = args.trim();
                if (!mode) return '⚠️ 用法: /mode <agent|plan|yolo>';
                this.tuiManager.setConfig({ mode });
                this.tuiManager.autoApprove = mode === 'yolo';
                const tid = this.tuiManager.currentThreadId;
                if (tid) await this.tuiManager.updateThreadConfig(tid, { mode }).catch((e: any) => { logger.warn('[SlashCmd] /mode PATCH failed:', e.message); });
                this.postMessage({ type: 'modeSwitched', mode });
                return '✅ 已切换为 ' + mode + ' 模式';
            }
            case 'model': {
                const model = args.trim();
                if (!model) {
                    const models = await this.tuiManager.listModels();
                    if (models && models.length > 0) {
                        return '🤖 **可用模型** (' + models.length + ')\n\n'
                            + models.map((m: any) => '• `' + (m.id || m.name || m) + '`' + (m.description ? ' — ' + m.description : '')).join('\n');
                    }
                    return '⚠️ 用法: /model <模型名>\n\n使用 /models 查看可用模型列表。';
                }
                this.tuiManager.setConfig({ model });
                const tid = this.tuiManager.currentThreadId;
                if (tid) await this.tuiManager.updateThreadConfig(tid, { model }).catch((e: any) => { logger.warn('[SlashCmd] /model PATCH failed:', e.message); });
                this.postMessage({ type: 'modelSwitched', model });
                return '✅ 已切换为 ' + model;
            }
            case 'skill': {
                const parts = args.trim().split(/\s+/, 2);
                if (parts[0] === 'install') {
                    const name = parts[1];
                    if (!name) return '⚠️ 用法: /skill install <技能名>';
                    return '📦 技能安装功能需要 TUI 引擎支持。';
                }
                const name = args.trim();
                if (!name) return '⚠️ 用法: /skill <技能名> 或 /skill install <技能名>';
                const ok = await this.tuiManager.setSkillEnabled(name, true);
                return ok ? '✅ 技能 "' + name + '" 已启用' : '⚠️ 切换技能失败。';
            }
            case 'context': {
                const usage = await this.tuiManager.getUsage({ group_by: 'thread' });
                if (!usage) return '🔍 暂无上下文数据。';
                const t = usage.totals;
                const totalTokens = t.input_tokens + t.output_tokens + t.cached_tokens + t.reasoning_tokens;
                const pct = Math.round((totalTokens / 1_000_000) * 100);
                const bar = this.makeProgressBar(pct);
                return '🔍 **上下文用量**\n\n• 进度: ' + bar + ' ' + pct + '%\n• 输入 token: ' + t.input_tokens.toLocaleString()
                    + '\n• 输出 token: ' + t.output_tokens.toLocaleString()
                    + '\n• 缓存 token: ' + t.cached_tokens.toLocaleString()
                    + '\n• 推理 token: ' + t.reasoning_tokens.toLocaleString()
                    + '\n• 总轮次: ' + t.turns
                    + '\n• 预估费用: $' + t.cost_usd.toFixed(4);
            }
            case 'cost': {
                const usage = await this.tuiManager.getUsage({ group_by: 'day' });
                if (!usage) return '💰 暂无费用数据。';
                return '💰 **费用估算**\n\n• 今日费用: $' + usage.totals.cost_usd.toFixed(4)
                    + '\n• 今日 token: ' + usage.totals.input_tokens.toLocaleString() + ' 入 / ' + usage.totals.output_tokens.toLocaleString() + ' 出';
            }
            case 'tokens': {
                const usage = await this.tuiManager.getUsage({ group_by: 'day' });
                if (!usage) return '🔢 暂无 token 数据。';
                const t = usage.totals;
                return '🔢 **Token 统计**\n\n• 总输入: ' + t.input_tokens.toLocaleString()
                    + '\n• 总输出: ' + t.output_tokens.toLocaleString()
                    + '\n• 缓存命中: ' + t.cached_tokens.toLocaleString()
                    + '\n• 推理: ' + t.reasoning_tokens.toLocaleString();
            }
            case 'task': {
                const id = args.trim();
                if (!id) return '⚠️ 用法: /task <任务ID>';
                const task = await this.tuiManager.getTask(id);
                if (!task) return '⚠️ 任务 `' + id + '` 不存在。';
                return '📌 **任务详情**\n\n```json\n' + JSON.stringify(task, null, 2).slice(0, 2000) + '\n```';
            }
            // 未匹配的命令 → 返回 null，由 sendPrompt 中的 steerTurn 处理
            default:
                return null;
        }
    }

    /** 生成 10 格进度条（可在 /context 和 checkContextUsage 中复用） */
    private makeProgressBar(pct: number): string {
        const width = 10;
        const filled = Math.round(pct / (100 / width));
        return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
    }

    /** 构建帮助文本 */
    private buildHelpText(): string {
        return '🌙 **Celest 命令列表**\n\n'
            + '**会话管理**\n'
            + '• /new — 新会话\n• /load <id> — 加载会话\n• /rename <名> — 重命名\n• /fork [模型] [模式] — 分支\n• /sessions — 会话列表\n• /clear — 清空聊天\n\n'
            + '**撤销/恢复**\n'
            + '• /undo — 撤销上一轮\n• /restore <id> — 恢复快照\n\n'
            + '**模式/模型**\n'
            + '• /mode <agent|plan|yolo> — 切换模式\n• /model [名称] — 查看/切换模型\n• /models — 模型列表\n• /provider — Provider 状态\n\n'
            + '**技能**\n'
            + '• /skills — 技能列表\n• /skill <名> — 启用技能\n\n'
            + '**任务管理**\n'
            + '• /tasks — 后台任务\n• /task <id> — 任务详情\n• /jobs — 后台 Job\n• /subagents — 子 Agent 列表\n\n'
            + '**目标**\n'
            + '• /goal — 查看/设置目标\n• /goal clear — 清除目标\n\n'
            + '**上下文/用量**\n'
            + '• /context — 上下文用量\n• /compact — 压缩上下文\n• /cost — 费用统计\n• /tokens — Token 统计\n\n'
            + '**系统**\n'
            + '• /version — 版本信息\n• /config — 配置信息\n• /doctor — 系统诊断\n• /auth — 密钥状态\n• /mcp — MCP 状态\n• /memory — 记忆查看\n• /help — 此帮助';
    }

    /** 取消当前工具执行（通过 interrupt turn，等效于全局 Stop） */
    private async cancelCurrentTool(_callId: string): Promise<void> {
        // TUI 引擎在工具执行期间不处理 steer 消息，
        // 因此唯一能中断 in-flight 工具的方式是 POST /interrupt。
        await this.tuiManager.cancel();
        this.stopTaskPolling();
        this.postMessage({ type: 'tuiText', text: '> ⚠️ 此轮对话被中断', sessionId: 'http-sse' });
        this.postMessage({ type: 'promptEnded' });
    }

    private async showDiff(filePath: string, oldContent?: string, newContent?: string): Promise<void> {
        try {
            const tmpDir = path.join(this.context.globalStorageUri.fsPath, 'diffs');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const baseName = path.basename(filePath);
            const oldFile = path.join(tmpDir, `${baseName}.old`);
            const newFile = path.join(tmpDir, `${baseName}.new`);
            fs.writeFileSync(oldFile, oldContent ?? '', 'utf-8');
            fs.writeFileSync(newFile, newContent ?? '', 'utf-8');
            const oldUri = vscode.Uri.file(oldFile);
            const newUri = vscode.Uri.file(newFile);
            const label = oldContent === undefined && newContent !== undefined
                ? `${baseName} (New File)`
                : `${baseName} (Changes)`;
            await vscode.commands.executeCommand('vscode.diff', oldUri, newUri, label);
        } catch (err: any) {
            logger.error('showDiff failed:', err.message);
        }
    }

    private getWorkspaceFiles(wsRoot: string): { path: string; name: string; relativePath: string; absolutePath: string }[] {
        const results: { path: string; name: string; relativePath: string; absolutePath: string }[] = [];
        if (!wsRoot || !fs.existsSync(wsRoot)) return results;
        try {
            const walk = (dir: string, depth: number) => {
                if (depth > 3) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
                    if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.relative(wsRoot, fullPath).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        walk(fullPath, depth + 1);
                    } else {
                        results.push({ path: relPath, name: entry.name, relativePath: fullPath, absolutePath: fullPath });
                    }
                }
            };
            walk(wsRoot, 0);
        } catch { /* ignore */ }
        return results.slice(0, 200);
    }

    private startTaskPolling(): void {
        if (this._taskPollTimer) return;
        this.pushTasks();
        this._taskPollTimer = setInterval(() => this.pushTasks(), 5000);
    }

    private stopTaskPolling(): void {
        if (this._taskPollTimer) {
            clearInterval(this._taskPollTimer);
            this._taskPollTimer = null;
        }
    }

    private async pushTasks(): Promise<void> {
        try {
            const tasks = await this.tuiManager.listTasks();
            this._lastTasks = Array.isArray(tasks) ? tasks : [];
            this.postMessage({ type: 'tasksList', tasks });
        } catch (err: any) {
            logger.warn('[Tasks] pushTasks error:', err.message);
        }
    }

    /** 解析 prompt 中的 @[path] 引用，文本文件内容前置，图片提示 AI 读取 */
    private enrichPromptWithFiles(prompt: string, wsRoot: string): string {
        const re = /@\[([^\]]+)\]/g;
        let match;
        const fileContexts: string[] = [];
        const seen = new Set<string>();
        const missingPaths: string[] = []; // Bug 2: 收集不存在的路径
        while ((match = re.exec(prompt)) !== null) {
            const filePath = match[1].trim();
            if (seen.has(filePath)) continue;
            seen.add(filePath);
            let fullPath = path.resolve(wsRoot, filePath);
            // Bug 8: 路径穿越防护 — 确保解析后的路径在工作区内
            const resolvedWsRoot = path.resolve(wsRoot);
            if (!fullPath.startsWith(resolvedWsRoot)) {
                logger.warn('[Security] path traversal blocked: ' + filePath + ' → ' + fullPath);
                missingPaths.push(filePath);
                continue;
            }
            // 如果路径不存在且只有文件名（无目录分隔符），在工作区内搜索
            if (!fs.existsSync(fullPath) && !filePath.includes('\\') && !filePath.includes('/')) {
                const found = this.findFileByName(wsRoot, filePath);
                if (found) fullPath = found;
            }
            if (!fs.existsSync(fullPath)) {
                missingPaths.push(filePath);
                continue;
            }
            const ext = filePath.split('.').pop()?.toLowerCase() || '';
            const imageExts = ['png','jpg','jpeg','gif','bmp','svg','ico','webp'];
            if (imageExts.includes(ext)) {
                fileContexts.push(`[图片文件: ${fullPath}]`);
            } else {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const preview = content.slice(0, 3000);
                    fileContexts.push(`[文件: ${fullPath}]\n\`\`\`\n${preview}${content.length > 3000 ? '\n...(truncated)' : ''}\n\`\`\``);
                } catch {
                    fileContexts.push(`[文件: ${fullPath} (binary)]`);
                }
            }
        }
        // Bug 2: 当有未找到的路径时，注入提示
        let missingNote = '';
        if (missingPaths.length > 0) {
            missingNote = `[⚠ 以下文件未找到或无法访问: ${missingPaths.join(', ')}]\n\n`;
        }
        if (fileContexts.length === 0) return missingNote + prompt;
        return missingNote + fileContexts.join('\n\n') + '\n\n---\n用户消息:\n' + prompt;
    }

    /** 在工作区内按文件名搜索（浅层遍历，最大深度 3） */
    private findFileByName(root: string, name: string): string | null {
        logger.info(`[FindFile] searching "${name}" in root: ${root}`);
        const walk = (dir: string, depth: number): string | null => {
            if (depth > 3) return null;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e: any) {
                logger.warn(`[FindFile] readdir failed for ${dir}: ${e.message}`);
                return null;
            }
            for (const e of entries) {
                if (e.name.startsWith('.') && e.name !== '.env') continue;
                if (e.name === 'node_modules' || e.name === '__pycache__') continue;
                const fp = path.join(dir, e.name);
                if (e.isFile() && e.name === name) {
                    logger.info(`[FindFile] found at ${fp}`);
                    return fp;
                }
                if (e.isDirectory()) {
                    const r = walk(fp, depth + 1);
                    if (r) return r;
                }
            }
            return null;
        };
        return walk(root, 0);
    }

    private hasActiveTasks(): boolean {
        return this._lastTasks.some((t: any) =>
            t.status === 'pending' || t.status === 'running'
        );
    }

    private buildHtml(webview: vscode.Webview, guiDir: vscode.Uri): string {
        const indexPath = vscode.Uri.joinPath(guiDir, 'index.html');
        let html = fs.readFileSync(indexPath.fsPath, 'utf-8');

        // 替换资源路径为 webview URI
        const guiWebviewUri = webview.asWebviewUri(guiDir);
        html = html.replace(/(src|href)="\.?\/([^"]+)"/g, (_, attr, src) => {
            if (src.startsWith('http')) return `${attr}="${src}"`;
            if (src.startsWith('/')) src = src.slice(1);
            return `${attr}="${webview.asWebviewUri(vscode.Uri.joinPath(guiDir, src))}"`;
        });

        // CSP — 使用 crypto 生成安全 nonce
        const nonce = 'celest-' + require('crypto').randomBytes(16).toString('hex');
        html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; img-src ${webview.cspSource} data: https:; font-src ${webview.cspSource}; connect-src https: http:;">`);
        html = html.replace(/<script/g, `<script nonce="${nonce}"`);

        return html;
    }
}
