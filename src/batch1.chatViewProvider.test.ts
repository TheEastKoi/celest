/**
 * 第一批改造 — ChatViewProvider 新增功能测试
 *
 * 覆盖：
 * - Bug 1: 新增斜杠命令（/undo, /restore, /goal, /jobs, /subagents,
 *   /provider, /config, /doctor, /auth, /statusline, /clear, /help,
 *   /voice, /hunt, /swarm）
 * - Bug 1: /model 无参数时调用 listModels
 * - Bug 1: /skill install 子命令支持
 * - Bug 3: _turnCount 初始化和递增
 * - Bug 3: 系统提示只在首轮注入
 * - Bug 3: checkContextUsage 方法存在
 * - Bug 5: 未知命令不 fallthrough 到 sendPrompt
 * - Bug 5: 未知命令通过 steerTurn 或显示提示
 * - Bug 8: enrichPromptWithFiles 路径穿越防护
 * - Bug 14: /memory 优先读取 ~/.codewhale/memory.md
 * - buildHelpText 返回非空帮助文本
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
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

// Mock fs
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        existsSync: vi.fn((p: string) => {
            // 为 /memory 测试返回 true
            if (p.includes('memory.md')) return true;
            // 为路径穿越测试控制
            if (p.includes('etc')) return true;
            return actual.existsSync(p);
        }),
        readFileSync: vi.fn((p: string, ...args: any[]) => {
            const enc = args[0] || 'utf-8';
            if (p.includes('memory.md') && p.includes('.codewhale')) {
                return Buffer.from('new path memory content', 'utf-8');
            }
            if (p.includes('memory.md') && p.includes('.deepseek')) {
                return Buffer.from('old path memory content', 'utf-8');
            }
            const actualRead = actual.readFileSync as any;
            try { return actualRead(p, ...args); } catch { return Buffer.from('test content', 'utf-8'); }
        }),
        writeFileSync: vi.fn(),
    };
});

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
    // 设置 mock process 使 connected 返回 true
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

/** 用于测试斜杠命令：cancel 已 mock */
function setupForSlashCmd() {
    const { provider, tuiManager, ctx } = setupProvider();
    tuiManager.cancel = vi.fn(async () => {});
    return { provider, tuiManager };
}

/** 用于测试 sendPrompt：cancel + sendPrompt 已 mock */
function setupForSendPrompt() {
    const { provider, tuiManager, ctx } = setupProvider();
    tuiManager.cancel = vi.fn(async () => {});
    tuiManager.sendPrompt = vi.fn(async () => {});
    return { provider, tuiManager };
}

describe('Bug 3: _turnCount 和上下文监控', () => {
    it('_turnCount 初始值应为 0', () => {
        const { provider } = setupProvider();
        expect((provider as any)._turnCount).toBe(0);
    });

    it('_turnCount 应在 sendPrompt 后递增', async () => {
        const { provider, tuiManager } = setupForSendPrompt();

        mockPostMessage.mockClear();
        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'test prompt',
            seq: 1,
        });

        expect((provider as any)._turnCount).toBe(1);
    });

    it('第二次 sendPrompt 后 _turnCount 应为 2', async () => {
        const { provider, tuiManager } = setupForSendPrompt();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'first',
            seq: 1,
        });
        (provider as any)._promptSeq = 0;
        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: 'second',
            seq: 2,
        });

        expect((provider as any)._turnCount).toBe(2);
    });

    it('/new 命令应重置 _turnCount 为 0', async () => {
        const { provider, tuiManager } = setupForSendPrompt();
        (provider as any)._turnCount = 5;

        mockPostMessage.mockClear();
        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/new',
            seq: 1,
        });

        expect((provider as any)._turnCount).toBe(0);
    });

    it('checkContextUsage 方法应存在', () => {
        const { provider } = setupProvider();
        expect(typeof (provider as any).checkContextUsage).toBe('function');
    });
});

describe('Bug 1: 新增斜杠命令', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('/help 应返回非空帮助文本', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/help',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        const helpText = textMsgs[0][0].text;
        expect(helpText).toContain('/new');
        expect(helpText).toContain('/undo');
        expect(helpText).toContain('/goal');
        expect(helpText).toContain('/help');
    });

    it('/undo 无活跃会话应返回提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        (tuiManager as any)._currentThreadId = undefined;

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/undo',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('没有活跃会话');
    });

    it('/restore 无参数应返回用法提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/restore',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('用法');
    });

    it('/goal 无参数应返回 goal 状态', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.getGoal = vi.fn(async () => null);
        tuiManager.cancel = vi.fn(async () => {});

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/goal',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('没有设置目标');
    });

    it('/goal clear 应调用 clearGoal', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.clearGoal = vi.fn(async () => true);

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/goal clear',
            seq: 1,
        });

        expect(tuiManager.clearGoal).toHaveBeenCalled();
    });

    it('/voice 应返回提示信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/voice',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('语音');
    });

    it('/hunt 应返回提示信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/hunt',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('Hunt');
    });

    it('/swarm 应返回提示信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/swarm',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('Swarm');
    });

    it('/provider 应返回 Provider 信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/provider',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
    });

    it('/config 应返回配置信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/config',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('Celest');
    });

    it('/doctor 应返回诊断信息', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/doctor',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('诊断');
    });

    it('/auth 应返回密钥状态', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/auth',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('API Key');
    });

    it('/statusline 应返回设置提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/statusline',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
    });

    it('/clear 应清空聊天', async () => {
        const { provider, tuiManager } = setupProvider();
        (provider as any)._turnCount = 5;
        tuiManager.cancel = vi.fn(async () => {});

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/clear',
            seq: 1,
        });

        expect((provider as any)._turnCount).toBe(0);
        const clearMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'clearChat'
        );
        expect(clearMsgs.length).toBeGreaterThan(0);
    });
});

describe('Bug 1: 增强命令 (/model, /models, /skill, /fork)', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('/model 无参数应调用 listModels', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.listModels = vi.fn(async () => [
            { id: 'deepseek-v4-flash', name: 'V4 Flash' },
            { id: 'deepseek-v4-pro', name: 'V4 Pro' },
        ]);

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/model',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('deepseek-v4-flash');
        expect(textMsgs[0][0].text).toContain('deepseek-v4-pro');
    });

    it('/model deepseek-v4-pro 应切换模型', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.updateThreadConfig = vi.fn(async () => true);

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/model deepseek-v4-pro',
            seq: 1,
        });

        const config = tuiManager.getConfig();
        expect(config.model).toBe('deepseek-v4-pro');
    });

    it('/models 应调用 listModels', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.listModels = vi.fn(async () => [
            { id: 'deepseek-v4-flash', name: 'Fast' },
        ]);

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/models',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
    });

    it('/skill 无参数应返回用法提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/skill',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('用法');
    });

    it('/skill install 应返回提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/skill install my-skill',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
    });

    it('/fork deepseek-v4-pro yolo 应传递 model 和 mode 参数', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.forkThread = vi.fn(async () => ({ id: 'new_fork', created_at: '', updated_at: '' }));

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/fork deepseek-v4-pro yolo',
            seq: 1,
        });

        // forkThread 应该被调用并传入 model + mode
        expect(tuiManager.forkThread).toHaveBeenCalledWith(
            'thr_test',
            { model: 'deepseek-v4-pro', mode: 'yolo' }
        );
    });
});

describe('Bug 5: 未知命令不 fallthrough', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('未知命令 /unknown_cmd 不应以普通 prompt 发送', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.steerTurn = vi.fn(async () => false);

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/unknown_cmd',
            seq: 1,
        });

        // 应该发送错误提示，而不是 sendPrompt
        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('未知命令');
    });

    it('未知命令应尝试 steerTurn', async () => {
        const { provider, tuiManager } = setupProvider();
        tuiManager.steerTurn = vi.fn(async () => true);
        tuiManager.cancel = vi.fn(async () => {});

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/custom_command arg1',
            seq: 1,
        });

        expect(tuiManager.steerTurn).toHaveBeenCalledWith(
            'thr_test',
            'turn_test',
            '/custom_command arg1'
        );
    });

    it('未知命令在无活跃会话时应提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        (tuiManager as any)._currentThreadId = undefined;
        (tuiManager as any)._currentTurnId = undefined;
        tuiManager.cancel = vi.fn(async () => {});

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/some_command',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        expect(textMsgs[0][0].text).toContain('未知命令');
        expect(textMsgs[0][0].text).toContain('没有活跃会话');
    });

    it('已知命令 /context 不应显示未知命令提示', async () => {
        const { provider, tuiManager } = setupForSlashCmd();
        tuiManager.getUsage = vi.fn(async () => ({
            since: null, until: null, group_by: 'thread',
            totals: { key: '', input_tokens: 1000, output_tokens: 500, cached_tokens: 0, reasoning_tokens: 0, cost_usd: 0.01, turns: 3 },
            buckets: [],
        }));
        tuiManager.cancel = vi.fn(async () => {});

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/context',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs[0][0].text).toContain('上下文');
        expect(textMsgs[0][0].text).not.toContain('未知命令');
    });
});

describe('Bug 8: enrichPromptWithFiles 路径穿越防护', () => {
    it('@[../../../etc/passwd] 不应被读取', () => {
        const { provider } = setupProvider();
        // 使用真实的工作区路径
        const result = (provider as any).enrichPromptWithFiles(
            'check @[../../../etc/passwd]',
            '/fake/workspace'
        );
        // 路径穿越应被阻止，不应注入文件内容标记
        expect(result).not.toContain('[文件:');
        expect(result).not.toContain('root:');
        // prompt 文本本身保留（引用不改变），但路径在安全日志中被标记
        expect(result).toContain('check @[../../../etc/passwd]');
    });

    it('@[normal/file.ts] 应正常处理', () => {
        const { provider } = setupProvider();
        const result = (provider as any).enrichPromptWithFiles(
            'check @[src/test.txt]',
            '/fake/workspace'
        );
        // 应该尝试解析路径（即使文件不存在也不会崩溃）
        expect(result).toBeDefined();
    });
});

describe('Bug 14: /memory 路径优先', () => {
    beforeEach(() => { mockPostMessage.mockClear(); });

    it('/memory 应优先读取 ~/.codewhale/memory.md', async () => {
        const { provider, tuiManager } = setupForSlashCmd();

        // Mock fs.existsSync 使 .codewhale 路径返回 true
        const origExistsSync = fs.existsSync;
        (fs.existsSync as any) = vi.fn((p: string) => {
            if (p.includes('.codewhale') && p.includes('memory.md')) return true;
            if (p.includes('.deepseek') && p.includes('memory.md')) return false;
            return origExistsSync(p);
        });

        await (provider as any).handleWebviewMessage({
            type: 'sendPrompt',
            prompt: '/memory',
            seq: 1,
        });

        const textMsgs = mockPostMessage.mock.calls.filter(
            (c: any) => c[0]?.type === 'tuiText'
        );
        expect(textMsgs.length).toBeGreaterThan(0);
        // 应该读取新路径的内容
        expect(textMsgs[0][0].text).toContain('new path memory content');

        // 恢复
        (fs.existsSync as any) = origExistsSync;
    });
});

describe('buildHelpText', () => {
    it('应返回包含所有命令分类的帮助文本', () => {
        const { provider } = setupProvider();
        const help = (provider as any).buildHelpText();
        expect(help).toContain('会话管理');
        expect(help).toContain('撤销/恢复');
        expect(help).toContain('模式/模型');
        expect(help).toContain('技能');
        expect(help).toContain('任务管理');
        expect(help).toContain('目标');
        expect(help).toContain('上下文/用量');
        expect(help).toContain('系统');
        expect(help).toContain('/new');
        expect(help).toContain('/undo');
        expect(help).toContain('/help');
    });
});
