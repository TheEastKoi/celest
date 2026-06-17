/**
 * 第一批改造 — TuiProcessManager 新增功能测试
 *
 * 覆盖：
 * - Bug 10: currentThreadId / currentTurnId 公开 getter
 * - Bug 11: forkThread 支持可选 model/mode 参数
 * - Batch 1 新增 API: undoThread, restoreSnapshot, setGoal, getGoal,
 *   clearGoal, listModels, listSubagents, cancelSubagent, listJobs,
 *   cancelAllJobs, voiceTranscribe
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

vi.spyOn(logger, 'error').mockImplementation(() => {});
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});

function makeContext() {
    return { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
}

function makeStarted(tuiManager: TuiProcessManager) {
    (tuiManager as any)._started = true;
    (tuiManager as any)._port = 19999;
    return tuiManager;
}

// ═══════════════════════════════════════════════════════════════
// Bug 10: 公开 getter
// ═══════════════════════════════════════════════════════════════

describe('Bug 10: currentThreadId / currentTurnId 公开 getter', () => {
    it('currentThreadId 默认应为 undefined', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.currentThreadId).toBeUndefined();
    });

    it('currentThreadId getter 应返回 _currentThreadId 值', () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._currentThreadId = 'thr_test_123';
        expect(mgr.currentThreadId).toBe('thr_test_123');
    });

    it('currentTurnId 默认应为 undefined', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.currentTurnId).toBeUndefined();
    });

    it('currentTurnId getter 应返回 _currentTurnId 值', () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._currentTurnId = 'turn_test_456';
        expect(mgr.currentTurnId).toBe('turn_test_456');
    });
});

// ═══════════════════════════════════════════════════════════════
// Bug 11: forkThread 支持可选参数
// ═══════════════════════════════════════════════════════════════

describe('Bug 11: forkThread 支持 model/mode 参数', () => {
    it('forkThread 无参数时应返回 null（未连接）', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.forkThread('thr_1')).toBeNull();
    });

    it('forkThread 带 model 参数不应崩溃', async () => {
        const mgr = makeStarted(new TuiProcessManager(makeContext()));
        const result = await mgr.forkThread('thr_1', { model: 'deepseek-v4-pro' });
        // 端口不可达，预期 null
        expect(result).toBeNull();
    });

    it('forkThread 带 model + mode 参数不应崩溃', async () => {
        const mgr = makeStarted(new TuiProcessManager(makeContext()));
        const result = await mgr.forkThread('thr_1', { model: 'deepseek-v4-pro', mode: 'yolo' });
        expect(result).toBeNull();
    });

    it('forkThread 只有 mode 参数不应崩溃', async () => {
        const mgr = makeStarted(new TuiProcessManager(makeContext()));
        const result = await mgr.forkThread('thr_1', { mode: 'plan' });
        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════
// 新增 API 方法
// ═══════════════════════════════════════════════════════════════

describe('Batch 1 新增 API: undo / snapshot / goal', () => {
    it('undoThread() 未连接应返回 false', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.undoThread('thr_1')).toBe(false);
    });

    it('undoThread() 已连接但端口不可达应返回 false', async () => {
        const mgr = makeStarted(new TuiProcessManager(makeContext()));
        expect(await mgr.undoThread('thr_1')).toBe(false);
    });

    it('restoreSnapshot() 未连接应返回 null', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.restoreSnapshot('snap_1')).toBeNull();
    });

    it('setGoal() 未连接应返回 null', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.setGoal('Build a web app')).toBeNull();
    });

    it('setGoal() 带 title 参数不应崩溃', async () => {
        const mgr = makeStarted(new TuiProcessManager(makeContext()));
        const result = await mgr.setGoal('Build a web app', { title: 'My Goal' });
        expect(result).toBeNull();
    });

    it('getGoal() 未连接应返回 null', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getGoal()).toBeNull();
    });

    it('clearGoal() 未连接应返回 false', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.clearGoal()).toBe(false);
    });
});

describe('Batch 1 新增 API: models / subagents / jobs', () => {
    it('listModels() 未连接应返回 null', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listModels()).toBeNull();
    });

    it('listSubagents() 未连接应返回空数组', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listSubagents()).toEqual([]);
    });

    it('cancelSubagent() 未连接应返回 false', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.cancelSubagent('agent_1')).toBe(false);
    });

    it('listJobs() 未连接应返回空数组', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listJobs()).toEqual([]);
    });

    it('cancelAllJobs() 未连接应返回 false', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.cancelAllJobs()).toBe(false);
    });

    it('voiceTranscribe() 未连接应返回 null', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.voiceTranscribe()).toBeNull();
    });
});
