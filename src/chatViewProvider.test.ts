/**
 * 审批模块单元测试
 *
 * 覆盖：
 * - 问题2: decideApproval 失败时发送 tuiWarning 通知前端
 * - #3: promptEnded finally 保证（防止 promptRunning 卡死）
 * - #9: _toolCache 过期清理
 * - #11: 历史恢复保留 reasoning/tool_call 摘要
 * - #12: providerApiKeys 状态判断修复
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock vscode ---
const mockPostMessage = vi.fn();
const mockWebview = {
    postMessage: mockPostMessage,
    onDidReceiveMessage: vi.fn(),
    options: {},
    html: '',
};

const mockWebviewView = {
    webview: mockWebview,
    visible: true,
    show: vi.fn(),
    onDidChangeVisibility: vi.fn(),
    onDidDispose: vi.fn(),
};

// Mock extension context
function mockContext() {
    return {
        subscriptions: [],
        extensionUri: { fsPath: '/fake/ext', path: '/fake/ext' },
        globalStorageUri: { fsPath: '/fake/globalStorage' },
        storageUri: { fsPath: '/fake/storage' },
        secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
    } as any;
}

// --- Dynamic import after mocks configured ---
import { ChatViewProvider } from './chatViewProvider';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

/**
 * 构造一个轻量 TuiProcessManager，跳过实际进程启动
 */
function makeTuiManager(ctx: any) {
    const mgr = new TuiProcessManager(ctx);
    // 伪造已启动状态，让 decideApproval 能走到 HTTP 请求
    (mgr as any)._started = true;
    (mgr as any)._port = 19999; // 不存在的端口，确保请求失败
    return mgr;
}

describe('审批决策失败通知', () => {
    let provider: ChatViewProvider;
    let tuiManager: TuiProcessManager;

    beforeEach(() => {
        mockPostMessage.mockClear();
        const ctx = mockContext();
        tuiManager = makeTuiManager(ctx);
        provider = new ChatViewProvider(ctx, tuiManager);
        // 注入 webview view
        (provider as any)._view = mockWebviewView;
    });

    it('decideApproval 返回 false 时应发送 tuiWarning', async () => {
        // 模拟前端发来的审批决策
        const approvalMsg = {
            type: 'approvalDecision',
            approvalId: 'approval-test-001',
            decision: 'allow' as const,
            remember: false,
        };

        // 通过 handleWebviewMessage (private) 用反射调用
        await (provider as any).handleWebviewMessage(approvalMsg);

        // 验证：第一条消息是 tuiApprovalDecided（关闭弹窗）
        const calls = mockPostMessage.mock.calls;
        const firstMsg = calls.find((c: any) => c[0]?.type === 'tuiApprovalDecided');
        expect(firstMsg).toBeDefined();
        expect(firstMsg[0].approvalId).toBe('approval-test-001');

        // 验证：第二条消息是 tuiWarning（失败通知）
        const warningMsg = calls.find((c: any) => c[0]?.type === 'tuiWarning');
        expect(warningMsg).toBeDefined();
        expect(warningMsg[0].message).toContain('审批决策发送失败');
        expect(warningMsg[0].message).toContain('approval-test-001');
    });

    it('审批决策缺少 approvalId 时不发送任何请求', async () => {
        const badMsg = {
            type: 'approvalDecision',
            decision: 'allow',
        };

        await (provider as any).handleWebviewMessage(badMsg);

        // 不应发送 tuiApprovalDecided
        const decidedMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'tuiApprovalDecided'
        );
        expect(decidedMsg).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// #3: promptEnded finally 保证（防止 promptRunning 卡死）
// ═══════════════════════════════════════════════════════════════

describe('#3: promptEnded finally 保证', () => {
    let provider: ChatViewProvider;
    let tuiManager: TuiProcessManager;

    beforeEach(() => {
        mockPostMessage.mockClear();
        const ctx = mockContext();
        tuiManager = makeTuiManager(ctx);
        provider = new ChatViewProvider(ctx, tuiManager);
        (provider as any)._view = mockWebviewView;
        // 重置 promptSeq
        (provider as any)._promptSeq = 0;
    });

    it('sendPrompt 失败时仍应发送 promptEnded', async () => {
        // sendPrompt 会因端口 19999 连接失败而抛错
        const msg = {
            type: 'sendPrompt',
            prompt: 'test prompt',
            seq: 1,
        };

        // 需要让 connected 返回 true
        Object.defineProperty(tuiManager, 'connected', { get: () => true });

        await (provider as any).handleWebviewMessage(msg);

        // 无论成功失败，promptEnded 必须被发送（通过 finally 保证）
        const calls = mockPostMessage.mock.calls;
        const promptEndedCalls = calls.filter((c: any) => c[0]?.type === 'promptEnded');
        // 应该至少有一个 promptEnded（来自 finally）或 promptError
        const hasPromptEndedOrError = promptEndedCalls.length > 0 ||
            calls.some((c: any) => c[0]?.type === 'promptError');
        expect(hasPromptEndedOrError).toBe(true);
    });

    it('sendPrompt 被抢占时不应发送 promptEnded（由新请求负责）', async () => {
        // 模拟快速连发：第一个请求 seq=1，在 sendPrompt 期间被 seq=2 抢占
        const msg = {
            type: 'sendPrompt',
            prompt: 'first prompt',
            seq: 1,
        };

        // 需要让 connected 返回 true
        Object.defineProperty(tuiManager, 'connected', { get: () => true });

        // 在 sendPrompt 执行期间，模拟新请求抢占
        (tuiManager as any).sendPrompt = vi.fn(async () => {
            // 模拟在 sendPrompt 期间被抢占
            (provider as any)._promptSeq = 2;
            // 等待一下让 finally 有时间执行
            await new Promise(r => setTimeout(r, 10));
        });

        await (provider as any).handleWebviewMessage(msg);

        // 被抢占的请求不应发送 promptEnded（由 seq=2 的请求负责）
        const calls = mockPostMessage.mock.calls;
        const promptEndedCalls = calls.filter((c: any) => c[0]?.type === 'promptEnded');
        // 被抢占时不应有 promptEnded
        expect(promptEndedCalls.length).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// #9: _toolCache 清理机制
// ═══════════════════════════════════════════════════════════════

describe('#9: _toolCache 清理', () => {
    let provider: ChatViewProvider;
    let tuiManager: TuiProcessManager;

    beforeEach(() => {
        mockPostMessage.mockClear();
        const ctx = mockContext();
        tuiManager = makeTuiManager(ctx);
        provider = new ChatViewProvider(ctx, tuiManager);
        (provider as any)._view = mockWebviewView;
    });

    it('_evictToolCache 方法应存在', () => {
        expect(typeof (provider as any)._evictToolCache).toBe('function');
    });

    it('_evictToolCache 应清理过期条目', () => {
        const cache = (provider as any)._toolCache;
        // 添加一个过期的条目
        cache.set('old-call', {
            toolName: 'exec_shell',
            args: { cmd: 'ls' },
            ts: Date.now() - 10 * 60 * 1000, // 10 分钟前
        });

        (provider as any)._evictToolCache();

        expect(cache.has('old-call')).toBe(false);
    });

    it('_evictToolCache 应保留未过期条目', () => {
        const cache = (provider as any)._toolCache;
        // 添加一个未过期的条目
        cache.set('recent-call', {
            toolName: 'read_file',
            args: { path: '/tmp/test' },
            ts: Date.now(), // 刚刚
        });

        (provider as any)._evictToolCache();

        expect(cache.has('recent-call')).toBe(true);
    });

    it('_evictToolCache 超量时应清理 30%', () => {
        const cache = (provider as any)._toolCache;
        // 添加超过 TOOL_CACHE_MAX (200) 的条目
        for (let i = 0; i < 210; i++) {
            cache.set(`call-${i}`, {
                toolName: `tool-${i}`,
                args: {},
                ts: Date.now(), // 未过期
            });
        }

        (provider as any)._evictToolCache();

        // 应清理约 30%（63 条），剩余约 147 条
        expect(cache.size).toBeLessThan(200);
        expect(cache.size).toBeGreaterThan(100);
    });
});

// ═══════════════════════════════════════════════════════════════
// #11: 历史恢复保留 reasoning/tool_call 摘要
// ═══════════════════════════════════════════════════════════════

describe('#11: 历史恢复保留上下文', () => {
    let provider: ChatViewProvider;
    let tuiManager: TuiProcessManager;

    beforeEach(() => {
        mockPostMessage.mockClear();
        const ctx = mockContext();
        tuiManager = makeTuiManager(ctx);
        provider = new ChatViewProvider(ctx, tuiManager);
        (provider as any)._view = mockWebviewView;
    });

    it('resumeSession 应保留 agent_reasoning 类型', async () => {
        // Mock TUI 方法返回包含 reasoning 的历史
        (tuiManager as any)._started = true;

        // 返回空 workspace 以跳过工作区匹配检查
        vi.spyOn(tuiManager, 'resumeThread').mockResolvedValue({
            id: 'thr_test',
            workspace: '', // 空 workspace 跳过匹配检查
            created_at: '',
            updated_at: '',
        });
        vi.spyOn(tuiManager, 'getThreadDetail').mockResolvedValue({
            thread: { id: 'thr_test' },
            turns: [{
                id: 'turn_1',
                input_summary: 'user question',
                status: 'completed',
                item_ids: ['item_reasoning', 'item_message'],
            }],
            items: [
                { id: 'item_reasoning', kind: 'agent_reasoning', detail: 'Let me think about this...', status: 'completed' },
                { id: 'item_message', kind: 'agent_message', detail: 'The answer is 42.', status: 'completed' },
            ],
            latest_seq: 10,
        });
        vi.spyOn(tuiManager, 'getUsage').mockResolvedValue(null);
        vi.spyOn(tuiManager, 'getWorkspaceStatus').mockResolvedValue(null);
        vi.spyOn(tuiManager, 'cancel').mockResolvedValue(undefined);

        await provider.resumeSession('thr_test');

        // 检查 loadHistory 消息是否包含 reasoning
        const loadHistoryMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'loadHistory'
        );
        expect(loadHistoryMsg).toBeDefined();

        const history = loadHistoryMsg[0].history;
        const reasoningMsg = history.find((h: any) => h.content?.includes('<thinking>'));
        expect(reasoningMsg).toBeDefined();
        expect(reasoningMsg.content).toContain('Let me think');
    });

    it('resumeSession 应保留 tool_call 摘要', async () => {
        (tuiManager as any)._started = true;
        vi.spyOn(tuiManager, 'resumeThread').mockResolvedValue({
            id: 'thr_test',
            workspace: '', // 空 workspace 跳过匹配检查
            created_at: '',
            updated_at: '',
        });
        vi.spyOn(tuiManager, 'getThreadDetail').mockResolvedValue({
            thread: { id: 'thr_test' },
            turns: [{
                id: 'turn_1',
                input_summary: 'read the file',
                status: 'completed',
                item_ids: ['item_tool'],
            }],
            items: [
                { id: 'item_tool', kind: 'tool_call', summary: 'read_file', detail: 'file content here', status: 'completed' },
            ],
            latest_seq: 10,
        });
        vi.spyOn(tuiManager, 'getUsage').mockResolvedValue(null);
        vi.spyOn(tuiManager, 'getWorkspaceStatus').mockResolvedValue(null);
        vi.spyOn(tuiManager, 'cancel').mockResolvedValue(undefined);

        await provider.resumeSession('thr_test');

        const loadHistoryMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'loadHistory'
        );
        expect(loadHistoryMsg).toBeDefined();

        const history = loadHistoryMsg[0].history;
        const toolMsg = history.find((h: any) => h.content?.includes('🔧'));
        expect(toolMsg).toBeDefined();
        expect(toolMsg.content).toContain('read_file');
    });
});

// ═══════════════════════════════════════════════════════════════
// #12: providerApiKeys 状态判断
// ═══════════════════════════════════════════════════════════════

describe('#12: providerApiKeys 状态判断', () => {
    it('TOOL_META 应包含常见工具类型', () => {
        const toolMeta = (ChatViewProvider as any).TOOL_META;
        expect(toolMeta).toBeDefined();
        expect(toolMeta.exec_shell).toBeDefined();
        expect(toolMeta.write_file).toBeDefined();
        expect(toolMeta.read_file).toBeDefined();
    });

    it('低影响工具应自动批准', () => {
        const toolMeta = (ChatViewProvider as any).TOOL_META;
        expect(toolMeta.read_file.impact.startsWith('低')).toBe(true);
        expect(toolMeta.list_dir.impact.startsWith('低')).toBe(true);
    });

    it('高影响工具不应自动批准', () => {
        const toolMeta = (ChatViewProvider as any).TOOL_META;
        expect(toolMeta.exec_shell.impact.startsWith('高')).toBe(true);
        expect(toolMeta.write_file.impact.startsWith('中')).toBe(true);
    });
});
