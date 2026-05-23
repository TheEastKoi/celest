<template>
    <div class="celest-app">
        <header class="app-header"><span class="app-title">🌙 Celest</span><div class="header-actions"><button class="header-btn" @click="handleClearChat" title="Clear chat">🗑</button><button class="header-btn" @click="handleNewWindow" title="Open in new window">↗</button></div></header>
        <div class="main-split" v-if="tuiReady" ref="splitRef">
            <div class="split-left" :style="{ flex: `0 0 ${leftWidth}px` }"><ChatView ref="chatRef" @viewDiff="handleViewDiff" /></div>
            <div class="split-handle" @mousedown="startResize" :class="{ dragging: isResizing }"></div>
            <div class="split-right" :style="{ flex: `0 0 ${rightWidth}px` }">
                <div class="right-panel"><div class="panel-header" @click="panelWorkOpen = !panelWorkOpen"><span>{{ panelWorkOpen ? '▼' : '▶' }}</span><span>📋 Work</span><span v-if="todos.length > 0" class="panel-badge">{{ incompleteTodoCount }}</span></div><div v-show="panelWorkOpen" class="panel-body"><WorkPanel :todos="todos" /></div></div>
                <div class="right-panel"><div class="panel-header" @click="panelPlanOpen = !panelPlanOpen"><span>{{ panelPlanOpen ? '▼' : '▶' }}</span><span>📐 Plan</span><span v-if="plan.steps.length > 0" class="panel-badge">{{ incompletePlanCount }}</span></div><div v-show="panelPlanOpen" class="panel-body"><PlanPanel :plan="plan" /></div></div>
                <div class="right-panel"><div class="panel-header" @click="panelTasksOpen = !panelTasksOpen"><span>{{ panelTasksOpen ? '▼' : '▶' }}</span><span>📌 Tasks</span></div><div v-show="panelTasksOpen" class="panel-body"><div class="tasks-placeholder">Background tasks will appear here</div></div></div>
<HelpPanel ref="helpPanelRef" />
            </div>
        </div>
        <main v-if="!tuiReady" class="chat-area"><ChatView ref="chatRef" @viewDiff="handleViewDiff" /></main>
        <footer class="input-area"><div v-if="!tuiReady" class="connecting-banner">Connecting to DeepSeek TUI...</div><InputBox ref="inputBoxRef" @send="handleSend" @stop="handleStop" :disabled="!tuiReady" :showStop="promptRunning" :files="fileList" /></footer>
        <ContextBar :modelName="modelName" :turnCount="turnCount" :sessionId="sessionId" />

        <!-- Phase 4: 审批弹窗 -->
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import ChatView from './components/ChatView.vue';
import InputBox from './components/InputBox.vue';
import ContextBar from './components/ContextBar.vue';
import WorkPanel from './components/WorkPanel.vue';
import PlanPanel from './components/PlanPanel.vue';
import ApprovalPopup from './components/ApprovalPopup.vue';
import type { FileItem } from './components/AtMentionPopup.vue';
import HelpPanel from './components/HelpPanel.vue';

declare function acquireVsCodeApi(): any; const vscode = acquireVsCodeApi?.();
const chatRef = ref<InstanceType<typeof ChatView>>(); const helpPanelRef = ref<InstanceType<typeof HelpPanel>>(); const inputBoxRef = ref<InstanceType<typeof InputBox>>(); const splitRef = ref<HTMLElement>();
const promptRunning = ref(false); const tuiReady = ref(false); const modelName = ref('deepseek-v4-flash'); const turnCount = ref(0); const sessionId = ref<string>('connecting');

// Phase 4: 审批状态
const showApproval = ref(false);
const approvalId = ref('');
const approvalToolName = ref('');
const approvalDescription = ref('');
const approvalToolType = ref('');
const approvalImpact = ref('');
const approvalParams = ref('');

const DEFAULT_RIGHT = 280; const MIN_LEFT = 200; const MIN_RIGHT = 160; const leftWidth = ref(400); const rightWidth = ref(DEFAULT_RIGHT); const isResizing = ref(false);
function initSplitWidth() { if (splitRef.value) { const total = splitRef.value.clientWidth; rightWidth.value = Math.round(total * 0.35); leftWidth.value = total - rightWidth.value - 4; } }
function startResize(e: MouseEvent) { isResizing.value = true; const startX = e.clientX; const startRight = rightWidth.value; const startTotal = splitRef.value?.clientWidth || 800; const onMove = (ev: MouseEvent) => { const dx = startX - ev.clientX; const newRight = Math.max(MIN_RIGHT, Math.min(startTotal - MIN_LEFT, startRight + dx)); rightWidth.value = newRight; leftWidth.value = startTotal - newRight - 4; }; const onUp = () => { isResizing.value = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }

const panelWorkOpen = ref(true); const panelPlanOpen = ref(true); const panelTasksOpen = ref(true);
const fileList = ref<FileItem[]>([]);

interface TodoItem { content: string; status: 'pending' | 'in_progress' | 'completed'; } const todos = ref<TodoItem[]>([]); const incompleteTodoCount = computed(() => todos.value.filter(t => t.status !== 'completed').length);
interface PlanStep { step: string; status: 'pending' | 'in_progress' | 'completed'; } interface PlanData { explanation?: string; steps: PlanStep[]; } const plan = ref<PlanData>({ steps: [] }); const incompletePlanCount = computed(() => plan.value.steps.filter(s => s.status !== 'completed').length);



watch(todos, (val) => { if (val.length > 0) panelWorkOpen.value = true; }, { deep: true }); watch(() => plan.value.steps, (val) => { if (val.length > 0) panelPlanOpen.value = true; }, { deep: true });

let typewriterTimer: ReturnType<typeof setInterval> | null = null; let typewriterQueue: string[] = []; const TYPEWRITER_SPEED = 15;
function startTypewriter(text: string) { stopTypewriter(); let i = 0; typewriterQueue = []; while (i < text.length) { const sz = 2 + Math.floor(Math.random() * 3); typewriterQueue.push(text.slice(i, i + sz)); i += sz; } typewriterTimer = setInterval(() => { if (typewriterQueue.length === 0) { stopTypewriter(); return; } chatRef.value?.appendText(typewriterQueue.shift()!); }, TYPEWRITER_SPEED); } function stopTypewriter() { if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; } typewriterQueue = []; }
let promptWatchdog: ReturnType<typeof setTimeout> | null = null; function resetPromptWatchdog() { if (promptWatchdog) clearTimeout(promptWatchdog); if (promptRunning.value) { promptWatchdog = setTimeout(() => { if (promptRunning.value) { promptRunning.value = false; stopTypewriter(); } }, 180_000); } }

function handleSend(prompt: string) { const cmdMatch = prompt.trim().match(/^\/(\S+)(?:\s+(.*))?$/); if (cmdMatch) { if (dispatchSlashCommand(cmdMatch[1], cmdMatch[2] || '')) return; } chatRef.value?.addUserMessage(prompt); chatRef.value?.showTyping(); promptRunning.value = true; resetPromptWatchdog(); vscode?.postMessage({ type: 'sendPrompt', prompt }); }
function dispatchSlashCommand(cmd: string, _args: string): boolean { switch (cmd) { case 'clear': chatRef.value?.clearMessages(); todos.value = []; plan.value = { steps: [] }; turnCount.value = 0; return true; case 'help': showHelpMessage(); return true; case 'model': chatRef.value?.addUserMessage('/model'); chatRef.value?.appendText('\n\n📋 Model switching will be available in Phase 5.'); return true; default: return false; } }

function showHelpMessage() { helpPanelRef.value?.show(); }

function handleStop() { stopTypewriter(); chatRef.value?.hideTyping(); vscode?.postMessage({ type: 'cancelPrompt' }); }
function handleClearChat() { chatRef.value?.clearMessages(); todos.value = []; plan.value = { steps: [] }; }
function handleNewWindow() { vscode?.postMessage({ type: 'openNewWindow' }); }

// Phase 4: 审批决策 → 发送到后端
function handleApprovalDecision(decision: 'allow' | 'deny', remember: boolean) {
    console.log('[Celest] approvalDecision:', decision, 'remember:', remember, 'id:', approvalId.value);
    vscode?.postMessage({
        type: 'approvalDecision',
        approvalId: approvalId.value,
        decision,
        remember,
    });
    showApproval.value = false;
}

// Phase 4: View Diff → 转发到 extension host
function handleViewDiff(filePath: string, oldContent?: string, newContent?: string) {
    console.log('[Celest] viewDiff:', filePath);
    vscode?.postMessage({
        type: 'viewDiff',
        filePath,
        oldContent,
        newContent,
    });
}

function parseTodoWrite(raw: unknown) {
    try {
        let obj: any = null;
        if (typeof raw === 'string') {
            const text = raw as string;
            const start = text.indexOf('{');
            if (start >= 0) {
                try { obj = JSON.parse(text.slice(start)); } catch { /* */ }
            }
            if (!obj) { try { obj = JSON.parse(text); } catch { /* */ } }
        } else {
            obj = raw;
        }
        if (!obj) return;
        let list = obj.todos;
        if (!Array.isArray(list)) list = obj.items;
        if (!Array.isArray(list)) list = obj.tasks;
        if (Array.isArray(list) && list.length > 0) {
            todos.value = list.map((t: any) => ({
                content: String(t.content || t.task || t.title || t.name || t.description || ''),
                status: ((t.status || t.state || 'pending') as any),
            }));
            console.log('[Celest] todos updated:', todos.value.length);
        }
    } catch (e) { console.log('[Celest] parseTodoWrite error:', e); }
}

function parseUpdatePlan(raw: unknown) {
    try {
        let obj: any = null;
        if (typeof raw === 'string') {
            const text = raw as string;
            const start = text.indexOf('{');
            if (start >= 0) {
                try { obj = JSON.parse(text.slice(start)); } catch { /* */ }
            }
            if (!obj) { try { obj = JSON.parse(text); } catch { /* */ } }
        } else {
            obj = raw;
        }
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
            console.log('[Celest] plan updated:', plan.value.steps.length);
        }
    } catch (e) { console.log('[Celest] parseUpdatePlan error:', e); }
}

onMounted(async () => {
    await nextTick(); await nextTick(); initSplitWidth();
    if (splitRef.value) {
        new ResizeObserver(() => initSplitWidth()).observe(splitRef.value);
    }
    window.addEventListener('resize', initSplitWidth);

    // Phase 4: tuiReady 变为 true 时 splitRef 重新渲染，需重新初始化分栏
    watch(tuiReady, async (ready) => {
        if (ready) {
            await nextTick(); await nextTick();
            initSplitWidth();
            if (splitRef.value) {
                new ResizeObserver(() => initSplitWidth()).observe(splitRef.value);
            }
        }
    });

    window.addEventListener('message', (e: MessageEvent) => {
        const msg = e.data; if (!msg?.type) return;
        switch (msg.type) {
        case 'tuiReasoning': chatRef.value?.appendReasoning(msg.reasoning); break;
        case 'tuiReasoningDone': chatRef.value?.markReasoningDone(); break;
        case 'tuiText': stopTypewriter(); chatRef.value?.hideTyping(); startTypewriter(msg.text); break;
        case 'tuiToolCall': chatRef.value?.addToolCall(msg.toolCall?.name || 'tool', msg.toolCall?.arguments, msg.toolCall?.callId); break;
        case 'tuiToolResult': {
            const { callId, output, status, toolName } = msg.toolResult || {};
            const tn = toolName || '';
            const o = output;
            chatRef.value?.updateToolResult(callId || '', o ?? '', status || 'success');
            if (tn === 'todo_write' || tn === 'checklist_write' || tn === 'checklist_add' || tn === 'checklist_update' || tn === 'todo_add' || tn === 'todo_update') { parseTodoWrite(o); }
            if (tn === 'update_plan') { parseUpdatePlan(o); }
            if (tn && (tn.includes('todo') || tn.includes('checklist') || tn === 'update_plan')) { console.log('[Celest] toolResult toolName:', tn, 'output type:', typeof o, 'raw:', String(o).slice(0,200)); } break; }
        case 'tuiToolProgress': chatRef.value?.updateToolResult(msg.toolResult?.callId || '', msg.toolResult?.output ?? '', 'pending'); break;
        case 'promptStarted': promptRunning.value = true; resetPromptWatchdog(); turnCount.value++; break;
        case 'promptEnded': promptRunning.value = false; if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; } if (!typewriterTimer) chatRef.value?.hideTyping(); break;
        case 'promptError': promptRunning.value = false; if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; } stopTypewriter(); chatRef.value?.hideTyping(); chatRef.value?.appendText(`\n\n⚠️ Error: ${msg.error}`); break;
        case 'fileList': fileList.value = Array.isArray(msg.files) ? msg.files : []; break;
        case 'addAtMention': inputBoxRef.value?.insertAtCursor('@' + (msg.path || '') + ' '); break;
        case 'pasteImageResult': inputBoxRef.value?.replaceText('@[' + (msg.fileName || '') + '] ', '@' + (msg.filePath || '') + ' '); break;
        case 'tuiEvent': if (msg.event === 'sessionUpdate' && msg.update?.content?.text) { chatRef.value?.hideTyping(); stopTypewriter(); startTypewriter(msg.update.content.text); } break;
        case 'clearChat': chatRef.value?.clearMessages(); break;
        case 'newSession': turnCount.value = 0; todos.value = []; plan.value = { steps: [] }; break;
        case 'tuiConnected': tuiReady.value = true; sessionId.value = msg.sessionId || ''; break;
        case 'tuiStatus': if (msg.status === 'restarting') tuiReady.value = false; else if (msg.status === 'connected') tuiReady.value = true; break;
        case 'tuiCrashed': tuiReady.value = false; promptRunning.value = false; if (promptWatchdog) { clearTimeout(promptWatchdog); promptWatchdog = null; } stopTypewriter(); chatRef.value?.appendText(`\n\n⚠️ TUI crashed: ${msg.message || 'Unknown'}`); break;

        // Phase 4: 审批消息
        case 'tuiApprovalRequired':
            approvalId.value = msg.approvalId || '';
            approvalToolName.value = msg.toolName || '';
            approvalDescription.value = msg.description || '';
            approvalToolType.value = msg.toolType || '';
            approvalImpact.value = msg.impact || '';
            approvalParams.value = msg.params || '';
            showApproval.value = true;
            console.log('[Celest] approval required:', approvalToolName.value, '—', approvalDescription.value);
            break;
        case 'tuiApprovalDecided':
            showApproval.value = false;
            console.log('[Celest] approval decided:', msg.approvalId, msg.decision);
            break;
        case 'tuiApprovalTimeout':
            showApproval.value = false;
            console.log('[Celest] approval timeout:', msg.approvalId);
            break;
    }});
    vscode?.postMessage({ type: 'ready' }); vscode?.postMessage({ type: 'getFiles' });
});
</script>

<style scoped>
.celest-app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px 6px 12px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); font-size: 14px; font-weight: 600; flex-shrink: 0; }
.header-actions { display: flex; gap: 2px; }
.header-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 14px; padding: 4px 6px; border-radius: 4px; line-height: 1; }
.header-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }
.main-split { display: flex; flex: 1; overflow: hidden; min-height: 0; }
.split-left { overflow-y: auto; min-width: 0; }
.split-right { overflow-y: auto; border-left: 1px solid var(--vscode-sideBarSectionHeader-border); border-radius: 6px; }
.split-handle { width: 4px; cursor: col-resize; background: transparent; flex-shrink: 0; transition: background 0.15s; }
.split-handle:hover, .split-handle.dragging { background: var(--vscode-focusBorder); }
.right-panel { border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.right-panel:last-child { border-bottom: none; }
.panel-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; background: var(--vscode-sideBar-background); }
.panel-header:hover { background: var(--vscode-list-hoverBackground); }
.panel-body { max-height: 300px; overflow-y: auto; }
.panel-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 10px; padding: 0 5px; border-radius: 8px; min-width: 16px; text-align: center; line-height: 15px; margin-left: auto; }
.tasks-placeholder { padding: 16px 12px; font-size: 12px; color: var(--vscode-descriptionForeground); text-align: center; font-style: italic; }
.chat-area { flex: 1; overflow-y: auto; }

.input-area { flex-shrink: 0; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); }
.connecting-banner { padding: 8px 12px; font-size: 12px; text-align: center; color: var(--vscode-descriptionForeground); background: var(--vscode-textBlockQuote-background); }
</style>
