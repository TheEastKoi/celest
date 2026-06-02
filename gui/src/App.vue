<template>
    <div class="celest-app">
        <header class="app-header">
            <span class="app-title"><img :src="iconPng" class="app-icon" /> Celest</span>
            <div class="header-actions">
                <button class="header-btn" @click="openSettings" title="Settings">⚙</button>
                <button class="header-btn" @click="handleCompact" title="压缩上下文 (/compact)">🗜</button>
                <button class="header-btn" @click="handleNewSession" title="新建会话">＋</button>
            </div>
        </header>
        <div class="main-split" v-if="tuiReady" ref="splitRef">
            <div class="split-left" :style="{ flex: `0 0 ${leftWidth}px` }"><ChatView ref="chatRef" @viewDiff="handleViewDiff" @stopTool="handleStopTool" /></div>
            <div class="split-handle" @mousedown="startResize" :class="{ dragging: isResizing }"></div>
            <div class="split-right" :style="{ flex: `0 0 ${rightWidth}px` }">
                <!-- 工作流 Work -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelWorkOpen = !panelWorkOpen">
                        <span class="panel-arrow">{{ panelWorkOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">📋 {{ t('panel.work') }}</span>
                        <span v-if="todos.length > 0" class="panel-badge">{{ incompleteTodoCount }}</span>
                    </div>
                    <div v-show="panelWorkOpen" class="panel-body"><WorkPanel :todos="todos" :plan="plan" /></div>
                </div>
                <!-- 任务流 Tasks -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelTasksOpen = !panelTasksOpen">
                        <span class="panel-arrow">{{ panelTasksOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">📌 {{ t('panel.tasks') }}</span>
                    </div>
                    <div v-show="panelTasksOpen" class="panel-body"><TasksPanel :tasks="taskList" :loading="tasksLoading" /></div>
                </div>
                <!-- 子代理 Agents -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelAgentsOpen = !panelAgentsOpen">
                        <span class="panel-arrow">{{ panelAgentsOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">🤖 {{ t('panel.agents') }}</span>
                        <span v-if="agentsList.length > 0" class="panel-badge">{{ agentsList.length }}</span>
                    </div>
                    <div v-show="panelAgentsOpen" class="panel-body"><AgentsPanel :agents="agentsList" /></div>
                </div>
                <!-- 技能 Skills -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelSkillsOpen = !panelSkillsOpen">
                        <span class="panel-arrow">{{ panelSkillsOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">🧩 {{ t('panel.skills') }}</span>
                        <span v-if="skillsList.length > 0" class="panel-badge">{{ skillsList.length }}</span>
                    </div>
                    <div v-show="panelSkillsOpen" class="panel-body">
                        <SkillsPanel :skills="skillsList" :warnings="skillsWarnings" :loading="skillsLoading" @toggle="handleSkillToggle" />
                    </div>
                </div>
                <!-- 上下文 Context -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelContextOpen = !panelContextOpen">
                        <span class="panel-arrow">{{ panelContextOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">🔍 {{ t('panel.context') }}</span>
                    </div>
                    <div v-show="panelContextOpen" class="panel-body">
                        <ContextPanel :usage="contextUsage" :workspace="contextWorkspace" :mcpCount="mcpCount" />
                    </div>
                </div>
                <!-- 统计用量 Usage -->
                <div class="right-panel">
                    <div class="panel-header" @click="panelUsageOpen = !panelUsageOpen">
                        <span class="panel-arrow">{{ panelUsageOpen ? '▼' : '▶' }}</span>
                        <span class="panel-label">📈 {{ t('panel.usage') }}</span>
                    </div>
                    <div v-show="panelUsageOpen" class="panel-body"><UsagePanel :usage="contextUsage" :loading="usageLoading" @refresh="handleUsageRefresh" /></div>
                </div>
                <HelpPanel ref="helpPanelRef" />
            </div>
        </div>
        <main v-if="!tuiReady" class="chat-area"><ChatView ref="chatRef" @viewDiff="handleViewDiff" @stopTool="handleStopTool" /></main>
        <footer class="input-area">
            <div v-if="!tuiReady" class="connecting-banner">{{ connectingText }}</div>
            <InputBox ref="inputBoxRef" @send="handleSend" @stop="handleStop" @pasteFiles="handlePasteFiles" @pasteImage="handlePasteImage" :disabled="!tuiReady" :showStop="promptRunning" :promptRunning="promptRunning" :files="fileList" :workspaceRoot="workspaceRoot" />
        </footer>
        <ContextBar :modelId="currentModel" :availableModels="availableModels" :mode="currentMode" :turnCount="turnCount" :sessionId="sessionId" :gitBranch="gitBranch" :gitDirty="gitDirty" @cycleMode="cycleMode" @switchModel="handleModelSwitch" />

        <ApprovalPopup
            :visible="showApproval"
            :approvalId="approvalId"
            :toolName="approvalToolName"
            :description="approvalDescription"
            :toolType="approvalToolType"
            :impact="approvalImpact"
            :params="approvalParams"
            @decide="handleApprovalDecision"
        />
    </div>

    <!-- Phase 5: 设置面板 — 移到 celest-app 外部避免 overflow:hidden 裁剪 -->
    <SettingsPanel
        :visible="showSettings"
        :config="settingsConfig"
        :apiKeyStored="apiKeyStored"
        :tuiVersion="tuiVersion"
        :tuiConnected="tuiReady"
        :extVersion="extVersion"
        :nodeVersion="nodeVersion"
        :vscodeVersion="vscodeVersion"
        :ocrAvailable="ocrAvailable"
        @close="showSettings = false"
        @save="handleSettingsSave"
        @downloadBinary="handleDownloadBinary"
        @checkUpdate="handleCheckUpdate"
        @browseBinary="handleBrowseBinary"
    />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import ChatView from './components/ChatView.vue';
import InputBox from './components/InputBox.vue';
import ContextBar from './components/ContextBar.vue';
import WorkPanel from './components/WorkPanel.vue';

import ApprovalPopup from './components/ApprovalPopup.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import iconPng from './assets/icon.png';
import { getAvailableModels, setLocale, t } from './i18n';
import type { FileItem } from './components/AtMentionPopup.vue';
import HelpPanel from './components/HelpPanel.vue';
import TasksPanel from './components/TasksPanel.vue';
import SkillsPanel from './components/SkillsPanel.vue';
import AgentsPanel from './components/AgentsPanel.vue';
import ContextPanel from './components/ContextPanel.vue';
import UsagePanel from './components/UsagePanel.vue';

declare function acquireVsCodeApi(): any; const vscode = acquireVsCodeApi?.();
const chatRef = ref<InstanceType<typeof ChatView>>(); const helpPanelRef = ref<InstanceType<typeof HelpPanel>>(); const inputBoxRef = ref<InstanceType<typeof InputBox>>(); const splitRef = ref<HTMLElement>();
const
    fileList = ref<FileItem[]>([]),
    turnCount = ref(0),
    todos = ref<any[]>([]),
    plan = ref<{ explanation?: string; steps: any[] }>({ steps: [] }),
    taskList = ref<any[]>([]),
    tasksLoading = ref(false),
    tuiReady = ref(false),
    sessionId = ref(''),
    leftWidth = ref(300),
    rightWidth = ref(300),
    isResizing = ref(false),
    panelWorkOpen = ref(false),
    panelTasksOpen = ref(false),
    panelSkillsOpen = ref(false),
    skillsList = ref<any[]>([]),
    skillsWarnings = ref<string[]>([]),
    skillsLoading = ref(false),
    panelAgentsOpen = ref(false),
    panelContextOpen = ref(false),
    agentsList = ref<any[]>([]),
    contextUsage = ref<any>(null),
    contextWorkspace = ref<any>(null),
    mcpCount = ref<number | null>(null),
    usageLoading = ref(false),
    panelUsageOpen = ref(false),
    gitBranch = ref(''),
    gitDirty = ref(false),
    workspaceRoot = ref(''),
    promptRunning = ref(false),
    requestSeq = ref(0),
    currentModel = ref('deepseek-v4-flash'),
    currentMode = ref('agent'),
    availableModels = getAvailableModels();

const showApproval = ref(false),
    approvalId = ref(''),
    approvalToolName = ref(''),
    approvalDescription = ref(''),
    approvalToolType = ref(''),
    approvalImpact = ref(''),
    approvalParams = ref(''),
    trustActive = ref(false);

const showSettings = ref(false),
    settingsConfig = ref({
        apiBase: 'https://api.deepseek.com',
        defaultModel: 'deepseek-v4-flash',
        autoDownloadBinary: true,
        binaryPath: '',
        locale: 'zh-CN',
        provider: 'deepseek',
        reasoningEffort: 'max',
    }),
    apiKeyStored = ref(false),
    tuiVersion = ref(''),
    extVersion = ref('0.1.0'),
    nodeVersion = ref(''),
    vscodeVersion = ref(''),
    ocrAvailable = ref(false),
    connectingText = ref(t('connecting'));

const incompleteTodoCount = computed(() => todos.value.filter((t: any) => t.status === 'in_progress' || t.status === 'pending').length);

function openSettings() { showSettings.value = true; vscode?.postMessage({ type: 'getSettings' }); }
function handleModelSwitch(id: string) { currentModel.value = id; vscode?.postMessage({ type: 'switchModel', model: id }); }
function cycleMode() { const modes = ['agent','plan','yolo']; const i = modes.indexOf(currentMode.value); currentMode.value = modes[(i+1)%modes.length]; vscode?.postMessage({ type: 'switchMode', mode: currentMode.value }); }
function handleSettingsSave(config: any) {
    vscode?.postMessage({ type: 'saveSettings', config });
    showSettings.value = false;
    if (config.defaultModel) currentModel.value = config.defaultModel;
    if (config.locale) { setLocale(config.locale as 'zh-CN' | 'en'); connectingText.value = t('connecting'); }
}
function handleDownloadBinary() { vscode?.postMessage({ type: 'downloadBinary', force: true }); }
function handleCheckUpdate() { vscode?.postMessage({ type: 'checkUpdate' }); }
function handleBrowseBinary() { vscode?.postMessage({ type: 'browseBinary' }); }
function handleNewSession() { chatRef.value?.clearMessages(); vscode?.postMessage({ type: 'newSession' }); }
function handleCompact() { vscode?.postMessage({ type: 'compactThread' }); }
function handleClearChat() { chatRef.value?.clearMessages(); vscode?.postMessage({ type: 'clearChat' }); }
function handleSkillToggle(name: string, enabled: boolean) { vscode?.postMessage({ type: 'toggleSkill', name, enabled }); }
function fetchSkills() { skillsLoading.value = true; vscode?.postMessage({ type: 'getSkills' }); }
function handleUsageRefresh(groupBy: string) { usageLoading.value = true; vscode?.postMessage({ type: 'getUsage', group_by: groupBy }); }
function handleSend(text: string) {
    // 预处理 @路径：如果路径中有空格且没用方括号，自动加 @[path]
    text = text.replace(/@([^\s\[]\S*(?:\s+\S+)+)/g, (_m, p) => `@[${p}]`);
    // 拦截本地 UI 命令
    const t = text.trim();
    if (t === '/clear') { handleClearChat(); return; }
    if (t === '/help' || t === '/?') { helpPanelRef.value?.show(); return; }
    if (t === '/compact') { vscode?.postMessage({ type: 'compactThread' }); return; }
    if (!tuiReady.value) return;
    promptRunning.value = true;
    requestSeq.value++;
    chatRef.value?.resetScrollState();
    chatRef.value?.addUserMessage(text);
    chatRef.value?.showTyping();
    vscode?.postMessage({ type: 'sendPrompt', prompt: text, seq: requestSeq.value, model: currentModel.value });
}
function handleStop() { vscode?.postMessage({ type: 'cancelPrompt' }); promptRunning.value = false; chatRef.value?.hideTyping(); }
function handleStopTool(callId: string) { vscode?.postMessage({ type: 'cancelTool', callId }); }
function handlePasteFiles(names: string[]) {
    vscode?.postMessage({ type: 'resolveFiles', names });
}
function handlePasteImage(base64: string, name: string) {
    vscode?.postMessage({ type: 'pasteImage', fileName: name, data: base64 });
}
function handleViewDiff(filePath: string, oldContent: string, newContent: string) { vscode?.postMessage({ type: 'viewDiff', filePath, oldContent, newContent }); }
function handleApprovalDecision(decision: 'allow' | 'deny', remember: boolean) {
    vscode?.postMessage({ type: 'approvalDecision', approvalId: approvalId.value, decision, remember });
}

function initSplitWidth() {
    const parentWidth = (splitRef.value?.parentElement as HTMLElement)?.clientWidth || 600;
    const available = parentWidth - 6;
    leftWidth.value = Math.floor(available * 0.65);
    rightWidth.value = Math.floor(available * 0.35);
}
function startResize(e: MouseEvent) {
    isResizing.value = true;
    const startX = e.clientX, startLeft = leftWidth.value, startRight = rightWidth.value;
    const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        let newLeft = Math.max(150, startLeft + dx); let newRight = startRight - dx;
        const total = (splitRef.value?.clientWidth || 600) - 6;
        if (newRight < 150) { newRight = 150; newLeft = total - 150; }
        leftWidth.value = newLeft; rightWidth.value = newRight;
    };
    const onUp = () => { isResizing.value = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}
function parseTodoWrite(raw: unknown) {
    try {
        let obj: any = null;
        if (typeof raw === 'string') {
            const text = raw as string;
            const start = text.indexOf('{');
            if (start >= 0) { try { obj = JSON.parse(text.slice(start)); } catch { /* */ } }
            if (!obj) { try { obj = JSON.parse(text); } catch { /* */ } }
        } else { obj = raw; }
        if (!obj || (!Array.isArray(obj.todos) && !Array.isArray(obj))) return;
        const list = Array.isArray(obj.todos) ? obj.todos : obj;
        if (Array.isArray(list)) {
            todos.value = list.filter((t: any) => t && typeof t === 'object').map((t: any) => ({
                content: String(t.content || t.task || t.title || t.name || t.description || t.text || ''),
                status: String(t.status || t.state || 'pending'),
            }));
        }
    } catch { /* */ }
}
function parseUpdatePlan(raw: unknown) {
    try {
        let obj: any = null;
        if (typeof raw === 'string') {
            const text = raw as string;
            const start = text.indexOf('{');
            if (start >= 0) { try { obj = JSON.parse(text.slice(start)); } catch { /* */ } }
            if (!obj) { try { obj = JSON.parse(text); } catch { /* */ } }
        } else { obj = raw; }
        if (!obj) return;
        let expl = '';
        if (typeof obj.explanation === 'string') expl = obj.explanation;
        let list = obj.plan;
        if (!Array.isArray(list)) list = obj.steps;
        if (!Array.isArray(list)) list = obj.items;
        if (Array.isArray(list) && list.length > 0) {
            plan.value = {
                explanation: expl,
                steps: list.map((s: any) => ({
                    step: String(s.step || s.title || s.name || s.description || s.content || ''),
                    status: ((s.status || s.state || 'pending') as any),
                })),
            };
        }
    } catch { /* */ }
}

// ── 面板自动折叠：内容为空时收起，有内容时展开 ──
watch([todos, () => plan.value.steps.length], () => {
    const hasContent = todos.value.length > 0 || plan.value.steps.length > 0;
    panelWorkOpen.value = hasContent;
}, { immediate: true });
watch(taskList, (t) => { panelTasksOpen.value = t.length > 0; }, { immediate: true });
watch(agentsList, (a) => { panelAgentsOpen.value = a.length > 0; }, { immediate: true });
watch(skillsList, (s) => { panelSkillsOpen.value = s.length > 0; }, { immediate: true });
watch(contextUsage, (c) => { panelContextOpen.value = c != null; }, { immediate: true });
watch(contextUsage, (c) => { panelUsageOpen.value = c != null; }, { immediate: true });

onMounted(async () => {
    await nextTick(); await nextTick(); initSplitWidth();
    if (splitRef.value) { new ResizeObserver(() => initSplitWidth()).observe(splitRef.value); }
    window.addEventListener('resize', initSplitWidth);
    watch(tuiReady, async (ready) => {
        if (ready) { await nextTick(); await nextTick(); initSplitWidth(); if (splitRef.value) { new ResizeObserver(() => initSplitWidth()).observe(splitRef.value); } }
    });

    window.addEventListener('message', (e: MessageEvent) => {
        const msg = e.data; if (!msg?.type) return;
        switch (msg.type) {
        case 'tuiReasoning': chatRef.value?.appendReasoning(msg.reasoning); break;
        case 'tuiReasoningDone': chatRef.value?.markReasoningDone(); break;
        // 流式文本：隐藏思考指示器，追加到消息
        case 'tuiUserMessage': chatRef.value?.addUserMessage(msg.text); break;
        case 'tuiText': chatRef.value?.appendText(msg.text); break;
        case 'tuiToolCall': chatRef.value?.addToolCall(msg.toolCall?.name || 'tool', msg.toolCall?.arguments, msg.toolCall?.callId); break;
        case 'tuiToolResult': {
            const { callId, output, status, toolName } = msg.toolResult || {};
            const tn = toolName || ''; const o = output;
            chatRef.value?.updateToolResult(callId || '', o ?? '', status || 'success');
            parseTodoWrite(o);
            parseUpdatePlan(o);
            break;
        }
        case 'tuiToolProgress': chatRef.value?.updateToolResult(msg.toolResult?.callId || '', msg.toolResult?.output ?? '', 'pending'); break;
        case 'promptStarted': promptRunning.value = true; turnCount.value++; break;
        case 'promptEnded': promptRunning.value = false; chatRef.value?.hideTyping(); chatRef.value?.cancelPendingTools(); chatRef.value?.resetScrollState(); vscode?.postMessage({ type: 'getUsage', group_by: 'day' }); vscode?.postMessage({ type: 'getWorkspaceStatus' }); break;
        case 'promptError': promptRunning.value = false; chatRef.value?.hideTyping(); chatRef.value?.appendText(`\n\n⚠️ Error: ${msg.error}`); break;
        case 'fileList': fileList.value = Array.isArray(msg.files) ? msg.files : []; break;
        case 'addAtMention': inputBoxRef.value?.insertAtCursor('@[' + (msg.path || '') + '] '); break;
        case 'filesResolved':
            if (msg.paths) {
                for (const [name, fullPath] of Object.entries(msg.paths)) {
                    inputBoxRef.value?.replaceText('@[' + name + ']', '@[' + (fullPath as string) + ']');
                }
            }
            break;
        case 'pasteImageResult': inputBoxRef.value?.replaceText('@[' + (msg.fileName || '') + '] ', '@' + (msg.filePath || '') + ' '); break;
        case 'clearChat': chatRef.value?.clearMessages(); break;
        case 'newSession': turnCount.value = 0; todos.value = []; plan.value = { steps: [] }; taskList.value = []; agentsList.value = []; contextUsage.value = null; contextWorkspace.value = null; trustActive.value = false; break;
        case 'loadHistory': {
            const history = msg.history;
            if (Array.isArray(history)) {
                for (const h of history) {
                    if (h.role === 'user') {
                        chatRef.value?.addUserMessage(String(h.content || ''));
                    } else if (h.role === 'assistant') {
                        chatRef.value?.addAssistantMessage(String(h.content || ''));
                    }
                }
                chatRef.value?.resetScrollState();
            }
            break;
        }
        case 'tuiConnected': tuiReady.value = true; sessionId.value = msg.sessionId || ''; vscode?.postMessage({ type: 'getTasks' }); vscode?.postMessage({ type: 'getSkills' }); vscode?.postMessage({ type: 'getWorkspaceStatus' }); vscode?.postMessage({ type: 'getMcpStatus' }); break;
        case 'tuiStatus':
            tuiReady.value = msg.status === 'connected';
            if (msg.status === 'connected') {
                vscode?.postMessage({ type: 'getSkills' });
                vscode?.postMessage({ type: 'getTasks' });
                vscode?.postMessage({ type: 'getWorkspaceStatus' });
                vscode?.postMessage({ type: 'getMcpStatus' });
                vscode?.postMessage({ type: 'getUsage', group_by: 'day' });
            }
            break;
        case 'tasksList': taskList.value = Array.isArray(msg.tasks) ? msg.tasks : []; tasksLoading.value = false; break;
        // Phase 6.1: Skills
        case 'skillsList': {
            const s = msg.skills;
            if (s) { skillsList.value = Array.isArray(s.skills) ? s.skills : []; skillsWarnings.value = Array.isArray(s.warnings) ? s.warnings : []; }
            skillsLoading.value = false;
            break;
        }
        case 'workspaceStatus': {
            if (msg.status) {
                workspaceRoot.value = msg.status.workspace || '';
                chatRef.value?.setStorageWorkspace(workspaceRoot.value);
                gitBranch.value = msg.status.branch || '';
                const dirty = (msg.status.staged || 0) + (msg.status.unstaged || 0) + (msg.status.untracked || 0);
                gitDirty.value = dirty > 0;
                contextWorkspace.value = msg.status;
            }
            break;
        }
        case 'compactSuccess': chatRef.value?.appendText('\n\n✅ Context compacted.'); break;
        case 'compactFailed': chatRef.value?.appendText(`\n\n⚠️ Compact failed: ${msg.error || 'Unknown'}`); break;
        // Phase 6.3: Agents
        case 'agentSpawned': {
            const existing = agentsList.value.find((a: any) => a.id === msg.agentId);
            if (!existing) {
                agentsList.value.push({ id: msg.agentId, status: 'spawned', prompt: msg.prompt || '' });
            }
            break;
        }
        case 'agentProgress': {
            const a = agentsList.value.find((a: any) => a.id === msg.agentId);
            if (a) { a.status = 'running'; if (msg.status) a.result = msg.status; }
            break;
        }
        case 'agentCompleted': {
            const ac = agentsList.value.find((a: any) => a.id === msg.agentId);
            if (ac) { ac.status = 'completed'; if (msg.result) ac.result = msg.result; }
            break;
        }
        // Phase 6.3: Context (response to getUsage/getWorkspace/getMcpStatus)
        case 'usageData': contextUsage.value = msg.usage; usageLoading.value = false; break;
        case 'mcpStatus': mcpCount.value = Array.isArray(msg.servers) ? msg.servers.length : null; break;
        case 'tuiWarning': chatRef.value?.appendText(`\n\n⚠️ ${msg.message || 'Warning'}`); break;
        case 'tuiCrashed': tuiReady.value = false; promptRunning.value = false; chatRef.value?.hideTyping(); chatRef.value?.appendText(`\n\n⚠️ TUI crashed: ${msg.message || 'Unknown'}`); break;

        case 'tuiApprovalRequired':
            approvalId.value = msg.approvalId || '';
            approvalToolName.value = msg.toolName || '';
            approvalDescription.value = msg.description || '';
            approvalToolType.value = msg.toolType || '';
            approvalImpact.value = msg.impact || '';
            approvalParams.value = msg.params || '';
            showApproval.value = true;
            break;
        case 'tuiApprovalDecided': showApproval.value = false; break;
        case 'tuiApprovalTimeout': showApproval.value = false; break;
        case 'trustActive':
            trustActive.value = msg.active === true;
            chatRef.value?.appendSystemMessage(msg.active ? '🔓 会话已信任 — 后续工具调用将自动批准' : '🔐 信任已重置');
            break;

        case 'openSettings': openSettings(); break;
        case 'settingsData':
            settingsConfig.value = msg.config || settingsConfig.value;
            apiKeyStored.value = msg.apiKeyStored ?? false;
            ocrAvailable.value = msg.ocrAvailable ?? false;
            tuiVersion.value = msg.tuiVersion || '';
            extVersion.value = msg.extVersion || '0.1.0';
            nodeVersion.value = msg.nodeVersion || '';
            vscodeVersion.value = msg.vscodeVersion || '';
            if (msg.config?.defaultModel) currentModel.value = msg.config.defaultModel;
            if (msg.config?.locale) { setLocale(msg.config.locale as 'zh-CN' | 'en'); connectingText.value = t('connecting'); }
            break;
        case 'settingsSaved': break;
        case 'modelSwitched': currentModel.value = msg.model || currentModel.value; break;
        case 'modeSwitched': currentMode.value = msg.mode || currentMode.value; break;
        case 'updateCheckResult': break; // 后端已弹窗通知
        case 'downloadProgress': break;
        case 'downloadComplete': break; // 后端已弹窗通知
        case 'downloadFailed': break;  // 后端已弹窗通知
        case 'localeChanged': setLocale(msg.locale as 'zh-CN' | 'en'); connectingText.value = t('connecting'); break;
    }});
    vscode?.postMessage({ type: 'ready' }); vscode?.postMessage({ type: 'getFiles' });
});
</script>

<style scoped>
.celest-app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px 6px 12px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); font-size: 14px; font-weight: 600; flex-shrink: 0; }

.app-title { font-size: 14px; display: flex; align-items: center; gap: 6px; }
.app-icon { width: 20px; height: 20px; }
.header-actions { display: flex; gap: 4px; align-items: center; }
.header-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 14px; padding: 4px 6px; border-radius: 4px; line-height: 1; }
.header-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }
.model-select { padding: 3px 6px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 11px; cursor: pointer; max-width: 130px; }
.model-select:focus { outline: none; border-color: var(--vscode-focusBorder); }
.main-split { display: flex; flex: 1; overflow: hidden; min-height: 0; }
.split-left { overflow-y: auto; min-width: 0; }
.split-right { overflow-y: auto; border-left: 1px solid var(--vscode-sideBarSectionHeader-border); border-radius: 6px; }
.split-handle { width: 4px; cursor: col-resize; background: transparent; flex-shrink: 0; transition: background 0.15s; }
.split-handle:hover, .split-handle.dragging { background: var(--vscode-focusBorder); }
.right-panel { border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.right-panel:last-child { border-bottom: none; }
.panel-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; background: var(--vscode-sideBar-background); }
.panel-header:hover { background: var(--vscode-list-hoverBackground); }
.panel-arrow { font-size: 10px; width: 12px; flex-shrink: 0; color: var(--vscode-descriptionForeground); }
.panel-label { font-size: 12px; font-weight: 600; }
.panel-body { max-height: 300px; overflow-y: auto; }
.panel-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 10px; padding: 0 5px; border-radius: 8px; min-width: 16px; text-align: center; line-height: 15px; margin-left: auto; }
.chat-area { flex: 1; overflow-y: auto; }
.input-area { flex-shrink: 0; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); }
.connecting-banner { padding: 8px 12px; font-size: 12px; text-align: center; color: var(--vscode-descriptionForeground); background: var(--vscode-textBlockQuote-background); }
.git-status-bar { display: flex; align-items: center; gap: 4px; padding: 2px 12px; font-size: 10px; color: var(--vscode-descriptionForeground); border-top: 1px solid var(--vscode-sideBarSectionHeader-border); flex-shrink: 0; }
.git-status-bar.dirty { color: var(--vscode-editorWarning-foreground, #cca700); }
.git-icon { font-size: 8px; }
.git-branch { font-family: var(--vscode-editor-font-family); }
.git-dirty-label { font-size: 9px; opacity: 0.7; }
</style>
