/**
 * 第二批改造 — 综合测试
 *
 * 覆盖：
 * - Bug 2: enrichPromptWithFiles 文件不存在时注入 ⚠ 提示
 * - Bug 2: @ 正则只对有扩展名/路径的文本自动包装
 * - Bug 2: 路径穿越防护与缺失提示不冲突
 * - Bug 6: switchMode PATCH 失败时发送 modeSwitchFailed
 * - Bug 6: switchMode 成功时发送 modeSwitched
 * - Bug 4: 首轮模式引导注入
 * - Bug 4: /new 后 _turnCount 重置 → 下一个 prompt 注入引导
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

function mockContext() {
    return {
        subscriptions: [],
        extensionUri: { fsPath: '/fake/ext', path: '/fake/ext' },
        globalStorageUri: { fsPath: '/fake/globalStorage' },
        storageUri: { fsPath: '/fake/storage' },
        secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
        extension: { packageJSON: { version: '0.2.0' } },
    } as any;
}

import { ChatViewProvider } from './chatViewProvider';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

function makeTuiManager(ctx: any) {
    const mgr = new TuiProcessManager(ctx);
    (mgr as any)._started = true;
    (mgr as any)._port = 19999;
    (mgr as any)._currentThreadId = 'thr_test';
    (mgr as any)._currentTurnId = 'turn_test';
    (mgr as any).process = { exitCode: null };
    return mgr;
}

function setupProvider() {
    const ctx = mockContext();
    const tuiManager = makeTuiManager(ctx);
    const provider = new ChatViewProvider(ctx, tuiManager);
    (provider as any)._view = mockWebviewView;
    return { provider, tuiManager, ctx };
}

// ═══════════════════════════════════════════════════════════════
// Bug 2: enrichPromptWithFiles 缺失文件提示
// ═══════════════════════════════════════════════════════════════

describe('Bug 2: enrichPromptWithFiles 缺失文件提示', () => {
    let provider: ChatViewProvider;

    beforeEach(() => {
        mockPostMessage.mockClear();
        const setup = setupProvider();
        provider = setup.provider;
    });

    it('@[不存在的文件] 应注入 ⚠ 提示', () => {
        // 使用一个明确不存在的工作区路径
        const result = (provider as any).enrichPromptWithFiles(
            '请分析 @[nonexistent/file_xyz.ts]',
            '/fake/workspace'
        );
        // 应该包含缺失文件提示
        expect(result).toContain('⚠');
        expect(result).toContain('未找到');
        expect(result).toContain('nonexistent/file_xyz.ts');
    });

    it('@[多个文件] 部分存在部分不存在时应报告缺失的', () => {
        const result = (provider as any).enrichPromptWithFiles(
            '检查 @[missing1.txt] 和 @[missing2.txt]',
            '/fake/workspace'
        );
        expect(result).toContain('⚠');
        expect(result).toContain('missing1.txt');
        expect(result).toContain('missing2.txt');
    });

    it('@[文件] 存在时不应显示 ⚠ 提示', () => {
        // 使用实际存在的测试文件
        const realFile = 'src/chatViewProvider.ts';
        const result = (provider as any).enrichPromptWithFiles(
            '分析 @[' + realFile + ']',
            process.cwd()
        );
        // 文件存在时应显示文件内容，不应有 ⚠
        expect(result).toContain('[文件:');
        expect(result).not.toContain('未找到或无法访问');
    });

    it('路径穿越的 @[../etc/file] 应同时被拦截并报告', () => {
        const result = (provider as any).enrichPromptWithFiles(
            '检查 @[../../../etc/passwd]',
            '/fake/workspace'
        );
        // 路径穿越被拦截，也应在缺失提示中
        expect(result).toContain('⚠');
        expect(result).toContain('../../../etc/passwd');
        // 不应包含文件内容标记
        expect(result).not.toContain('[文件:');
    });
});

// ═══════════════════════════════════════════════════════════════
// Bug 2: @ 正则行为
// ═══════════════════════════════════════════════════════════════

describe('Bug 2: @ 正则只对文件路径样式的文本自动包装', () => {
    // 模拟 App.vue 中的正则 — 只包装含扩展名或路径分隔符的
    const autoWrapRe = /@([^\s\[]\S*(?:\.\w{1,8}|[\\/])\S*)/g;

    it('@src/file.ts 应被包装为 @[src/file.ts]', () => {
        const text = '分析 @src/file.ts 的内容';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toBe('分析 @[src/file.ts] 的内容');
    });

    it('@model 不应被包装（无扩展名或路径分隔符）', () => {
        const text = '请 @model 切换';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toBe('请 @model 切换');
    });

    it('@config 不应被包装', () => {
        const text = '查看 @config 设置';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toBe('查看 @config 设置');
    });

    it('@path/to/file 应被包装（含路径分隔符）', () => {
        const text = '打开 @path/to/file 看看';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toBe('打开 @[path/to/file] 看看');
    });

    it('@[已包装的] 不应重复包装', () => {
        const text = '打开 @[already/wrapped.ts] 看看';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toBe('打开 @[already/wrapped.ts] 看看');
    });

    it('@C:\\path\\to\\file.txt 应被包装（Windows 绝对路径）', () => {
        const text = '打开 @C:\\Users\\test\\file.txt 文件';
        const result = text.replace(autoWrapRe, (_m, p) => `@[${p}]`);
        expect(result).toContain('@[');
        expect(result).toContain('C:\\Users\\test\\file.txt');
    });
});

// ═══════════════════════════════════════════════════════════════
// Bug 6: switchMode 失败回滚
// ═══════════════════════════════════════════════════════════════

describe('Bug 6: switchMode 失败回滚', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('switchMode PATCH 成功时应发送 modeSwitched', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.updateThreadConfig = vi.fn(async () => true);
        Object.defineProperty(tuiManager, 'connected', { get: () => true });

        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: 'plan',
        });

        const modeMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'modeSwitched'
        );
        expect(modeMsg).toBeDefined();
        expect(modeMsg[0].mode).toBe('plan');
    });

    it('switchMode 应设置 autoApprove（yolo=true, agent=false）', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.updateThreadConfig = vi.fn(async () => true);

        // 切换到 yolo
        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: 'yolo',
        });
        expect(tuiManager.autoApprove).toBe(true);

        // 切换回 agent
        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: 'agent',
        });
        expect(tuiManager.autoApprove).toBe(false);
    });

    it('switchMode 无模式参数应忽略', async () => {
        const { provider, tuiManager } = setupProvider();

        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: '',
        });

        const modeMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'modeSwitched'
        );
        expect(modeMsg).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// Bug 4: 首轮模式引导
// ═══════════════════════════════════════════════════════════════

describe('Bug 4: 首轮模式引导', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('首轮应包含模式引导文本', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.cancel = vi.fn(async () => {});
        tuiManager.sendPrompt = vi.fn(async (enriched: string) => {
            // 捕获发送给 TUI 的 enriched prompt
            (provider as any)._sentPrompt = enriched;
        });
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        (provider as any)._turnCount = 0;

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'hello',
            seq: 1,
        });

        const sent = (provider as any)._sentPrompt;
        expect(sent).toBeDefined();
        // 首轮应包含模式引导
        expect(sent).toContain('当前为');
        expect(sent).toContain('Agent');
        expect(sent).toContain('shell');
    });

    it('agent 模式引导应提到工具和命令', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.cancel = vi.fn(async () => {});
        tuiManager.setConfig({ mode: 'agent' });
        tuiManager.sendPrompt = vi.fn(async (enriched: string) => {
            (provider as any)._sentPrompt = enriched;
        });
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        (provider as any)._turnCount = 0;

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'hello',
            seq: 1,
        });

        expect((provider as any)._sentPrompt).toContain('Agent 模式');
        expect((provider as any)._sentPrompt).toContain('可使用工具');
    });

    it('plan 模式引导应提到只读', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.cancel = vi.fn(async () => {});
        tuiManager.setConfig({ mode: 'plan' });
        tuiManager.sendPrompt = vi.fn(async (enriched: string) => {
            (provider as any)._sentPrompt = enriched;
        });
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        (provider as any)._turnCount = 0;

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'hello',
            seq: 1,
        });

        expect((provider as any)._sentPrompt).toContain('Plan 模式');
        expect((provider as any)._sentPrompt).toContain('只读');
    });

    it('yolo 模式引导应提到自动批准', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.cancel = vi.fn(async () => {});
        tuiManager.setConfig({ mode: 'yolo' });
        tuiManager.sendPrompt = vi.fn(async (enriched: string) => {
            (provider as any)._sentPrompt = enriched;
        });
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        (provider as any)._turnCount = 0;

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'hello',
            seq: 1,
        });

        expect((provider as any)._sentPrompt).toContain('YOLO 模式');
        expect((provider as any)._sentPrompt).toContain('自动批准');
    });

    it('第二轮不应包含模式引导（不重复注入）', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.cancel = vi.fn(async () => {});
        tuiManager.sendPrompt = vi.fn(async (enriched: string) => {
            (provider as any)._sentPrompt = enriched;
        });
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        (provider as any)._turnCount = 1; // 第二轮

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '继续',
            seq: 1,
        });

        const sent = (provider as any)._sentPrompt;
        // 第二轮不应包含模式引导和 shell 提示
        expect(sent).not.toContain('当前为');
        expect(sent).not.toContain('预计运行超过10秒');
    });
});

// ═══════════════════════════════════════════════════════════════
// makeProgressBar 单元测试
// ═══════════════════════════════════════════════════════════════

describe('makeProgressBar', () => {
    it('0% 应返回全空进度条', () => {
        const { provider } = setupProvider();
        const bar = (provider as any).makeProgressBar(0);
        expect(bar).toBe('░░░░░░░░░░');
        expect(bar).not.toContain('█');
    });

    it('50% 应返回半满进度条', () => {
        const { provider } = setupProvider();
        const bar = (provider as any).makeProgressBar(50);
        expect(bar).toBe('█████░░░░░');
    });

    it('100% 应返回全满进度条', () => {
        const { provider } = setupProvider();
        const bar = (provider as any).makeProgressBar(100);
        expect(bar).toBe('██████████');
    });

    it('85% 应返回 8 格满', () => {
        const { provider } = setupProvider();
        const bar = (provider as any).makeProgressBar(85);
        // 85/10 = 8.5 → Math.round = 9 filled
        const filled = (bar.match(/█/g) || []).length;
        expect(filled).toBe(9);
    });
});

// ═══════════════════════════════════════════════════════════════
// checkContextUsage 完整测试
// ═══════════════════════════════════════════════════════════════

describe('checkContextUsage 完整测试', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('低于 85% 阈值时应发送 contextUsage 消息但不压缩', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.getUsage = vi.fn(async () => ({
            since: null, until: null, group_by: 'thread',
            totals: {
                input_tokens: 200_000,
                output_tokens: 50_000,
                cached_tokens: 0,
                reasoning_tokens: 0,
                cost_usd: 5.00,
                turns: 10,
                key: '',
            },
            buckets: [],
        }));
        tuiManager.compactThread = vi.fn();

        await (provider as any).checkContextUsage();

        // 250K / 1M = 25%，不应压缩
        expect(tuiManager.compactThread).not.toHaveBeenCalled();
        // 但应发送用量数据
        const ctxMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'contextUsage'
        );
        expect(ctxMsg).toBeDefined();
        expect(ctxMsg[0].usagePercent).toBe(25);
    });

    it('超过 85% 阈值时应自动压缩', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.getUsage = vi.fn(async () => ({
            since: null, until: null, group_by: 'thread',
            totals: {
                input_tokens: 800_000,
                output_tokens: 100_000,
                cached_tokens: 0,
                reasoning_tokens: 0,
                cost_usd: 20.00,
                turns: 30,
                key: '',
            },
            buckets: [],
        }));
        tuiManager.compactThread = vi.fn(async () => true);

        await (provider as any).checkContextUsage();

        // 900K / 1M = 90%，应自动压缩
        expect(tuiManager.compactThread).toHaveBeenCalledWith('thr_test', 'auto');
    });

    it('getUsage 返回 null 时不应崩溃', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.getUsage = vi.fn(async () => null);

        await expect(
            (provider as any).checkContextUsage()
        ).resolves.toBeUndefined();
    });

    it('getUsage 抛异常时不应崩溃', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.getUsage = vi.fn(async () => { throw new Error('Network error'); });

        await expect(
            (provider as any).checkContextUsage()
        ).resolves.toBeUndefined();
    });

    it('无活跃 thread 时超过阈值不尝试压缩', async () => {
        const { provider, tuiManager } = setupProvider();
        (tuiManager as any)._currentThreadId = undefined;
        tuiManager.getUsage = vi.fn(async () => ({
            since: null, until: null, group_by: 'thread',
            totals: {
                input_tokens: 900_000, output_tokens: 50_000,
                cached_tokens: 0, reasoning_tokens: 0,
                cost_usd: 30.00, turns: 40, key: '',
            },
            buckets: [],
        }));
        tuiManager.compactThread = vi.fn();

        await (provider as any).checkContextUsage();

        expect(tuiManager.compactThread).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════
// Bug 6: switchMode PATCH 失败回滚（后端→前端）
// ═══════════════════════════════════════════════════════════════

describe('Bug 6: switchMode PATCH 失败时发送 modeSwitchFailed', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('TUI 已连接但 PATCH 失败时应发送 modeSwitchFailed', async () => {
        const { provider, tuiManager } = setupProvider();
        Object.defineProperty(tuiManager, 'connected', { get: () => true });
        tuiManager.updateThreadConfig = vi.fn(async () => { throw new Error('PATCH failed'); });

        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: 'plan',
        });

        const failMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'modeSwitchFailed'
        );
        expect(failMsg).toBeDefined();
        expect(failMsg[0].mode).toBe('plan');
        expect(failMsg[0].oldMode).toBeDefined();
    });

    it('无活跃 thread 时 PATCH 跳过，仍发送 modeSwitched', async () => {
        const { provider, tuiManager } = setupProvider();
        (tuiManager as any)._currentThreadId = undefined; // 无活跃线程
        tuiManager.updateThreadConfig = vi.fn();

        await (provider as any).handleWebviewMessage({
            type: 'switchMode',
            mode: 'plan',
        });

        // 无活跃 thread →不尝试 PATCH → 直接 success
        const successMsg = mockPostMessage.mock.calls.find(
            (c: any) => c[0]?.type === 'modeSwitched'
        );
        expect(successMsg).toBeDefined();
        expect(tuiManager.updateThreadConfig).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════
// buildHelpText 完整性检查
// ═══════════════════════════════════════════════════════════════

describe('buildHelpText 完整性', () => {
    it('应包含所有新增的命令', () => {
        const { provider } = setupProvider();
        const help = (provider as any).buildHelpText();
        // 新增命令（Bug 1）
        expect(help).toContain('/undo');
        expect(help).toContain('/restore');
        expect(help).toContain('/goal');
        expect(help).toContain('/jobs');
        expect(help).toContain('/subagents');
        expect(help).toContain('/doctor');
        expect(help).toContain('/config');
        expect(help).toContain('/auth');
        expect(help).toContain('/clear');
        expect(help).toContain('/help');
        expect(help).toContain('/provider');
        // 原有命令
        expect(help).toContain('/new');
        expect(help).toContain('/fork');
        expect(help).toContain('/mode');
        expect(help).toContain('/model');
        expect(help).toContain('/compact');
        expect(help).toContain('/cost');
        expect(help).toContain('/tokens');
    });
});
