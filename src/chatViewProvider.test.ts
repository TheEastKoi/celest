/**
 * 审批模块单元测试
 * 
 * 覆盖：
 * - 问题2: decideApproval 失败时发送 tuiWarning 通知前端
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
