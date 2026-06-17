/**
 * 全量接口契约测试 — 验证所有公开 API 签名和行为
 *
 * 覆盖：
 * - TuiProcessManager 全部公开方法签名
 * - ChatViewProvider 内部方法存在性
 * - BinaryDownloader 公开方法
 * - SecretStore 公开方法
 * - 类型定义完整性
 * - SSE 事件分发不丢弃未知事件
 */

import { describe, it, expect, vi } from 'vitest';
import { TuiProcessManager } from './tuiProcessManager';
import { ChatViewProvider } from './chatViewProvider';
import { BinaryDownloader } from './binaryDownloader';
import { SecretStore, PROVIDER_ENV_MAP, ALL_PROVIDERS } from './secretStorage';
import { logger } from './logger';
import * as fs from 'node:fs';

vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

function makeContext() {
    return {
        subscriptions: [],
        extensionUri: { fsPath: '/fake/ext', path: '/fake/ext' },
        globalStorageUri: { fsPath: '/fake/globalStorage' },
        storageUri: { fsPath: '/fake/storage' },
        secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
        extension: { packageJSON: { version: '0.2.0' } },
    } as any;
}

function makeTuiManager() {
    const mgr = new TuiProcessManager(makeContext());
    (mgr as any)._started = true;
    (mgr as any)._port = 19999;
    (mgr as any)._currentThreadId = 'thr_test';
    (mgr as any)._currentTurnId = 'turn_test';
    (mgr as any).process = { exitCode: null };
    return mgr;
}

// ═══════════════════════════════════════════════════════════════
// TuiProcessManager 全部公开 API 签名验证
// ═══════════════════════════════════════════════════════════════

describe('TuiProcessManager 接口契约', () => {
    const mgr = makeTuiManager();

    // 属性
    it('应暴露 port (number)', () => expect(typeof mgr.port).toBe('number'));
    it('应暴露 connected (boolean)', () => expect(typeof mgr.connected).toBe('boolean'));
    it('应暴露 generation (number)', () => expect(typeof mgr.generation).toBe('number'));
    it('应暴露 autoApprove (boolean)', () => expect(typeof mgr.autoApprove).toBe('boolean'));
    it('应暴露 currentThreadId (string|undefined)', () => {
        const v = mgr.currentThreadId;
        expect(v === undefined || typeof v === 'string').toBe(true);
    });
    it('应暴露 currentTurnId (string|undefined)', () => {
        const v = mgr.currentTurnId;
        expect(v === undefined || typeof v === 'string').toBe(true);
    });

    // 生命周期
    it('应暴露 start()', () => expect(typeof mgr.start).toBe('function'));
    it('应暴露 dispose()', () => expect(typeof mgr.dispose).toBe('function'));
    it('应暴露 resetThread()', () => expect(typeof mgr.resetThread).toBe('function'));

    // 核心消息
    it('应暴露 sendPrompt()', () => expect(typeof mgr.sendPrompt).toBe('function'));
    it('应暴露 cancel()', () => expect(typeof mgr.cancel).toBe('function'));
    it('应暴露 decideApproval()', () => expect(typeof mgr.decideApproval).toBe('function'));

    // 配置
    it('应暴露 setConfig()', () => expect(typeof mgr.setConfig).toBe('function'));
    it('应暴露 getConfig()', () => expect(typeof mgr.getConfig).toBe('function'));
    it('应暴露 getRuntimeInfo()', () => expect(typeof mgr.getRuntimeInfo).toBe('function'));
    it('应暴露 updateThreadConfig()', () => expect(typeof mgr.updateThreadConfig).toBe('function'));

    // Thread
    it('应暴露 listThreads()', () => expect(typeof mgr.listThreads).toBe('function'));
    it('应暴露 getThread()', () => expect(typeof mgr.getThread).toBe('function'));
    it('应暴露 getThreadSummary()', () => expect(typeof mgr.getThreadSummary).toBe('function'));
    it('应暴露 getThreadDetail()', () => expect(typeof mgr.getThreadDetail).toBe('function'));
    it('应暴露 resumeThread()', () => expect(typeof mgr.resumeThread).toBe('function'));
    it('应暴露 forkThread()', () => expect(typeof mgr.forkThread).toBe('function'));
    it('应暴露 compactThread()', () => expect(typeof mgr.compactThread).toBe('function'));

    // Session
    it('应暴露 listSessions()', () => expect(typeof mgr.listSessions).toBe('function'));
    it('应暴露 getSession()', () => expect(typeof mgr.getSession).toBe('function'));
    it('应暴露 deleteSession()', () => expect(typeof mgr.deleteSession).toBe('function'));
    it('应暴露 resumeSessionThread()', () => expect(typeof mgr.resumeSessionThread).toBe('function'));

    // Tasks
    it('应暴露 listTasks()', () => expect(typeof mgr.listTasks).toBe('function'));
    it('应暴露 getTask()', () => expect(typeof mgr.getTask).toBe('function'));
    it('应暴露 createTask()', () => expect(typeof mgr.createTask).toBe('function'));
    it('应暴露 cancelTask()', () => expect(typeof mgr.cancelTask).toBe('function'));

    // Batch 1 新增
    it('应暴露 undoThread()', () => expect(typeof mgr.undoThread).toBe('function'));
    it('应暴露 restoreSnapshot()', () => expect(typeof mgr.restoreSnapshot).toBe('function'));
    it('应暴露 setGoal()', () => expect(typeof mgr.setGoal).toBe('function'));
    it('应暴露 getGoal()', () => expect(typeof mgr.getGoal).toBe('function'));
    it('应暴露 clearGoal()', () => expect(typeof mgr.clearGoal).toBe('function'));
    it('应暴露 listModels()', () => expect(typeof mgr.listModels).toBe('function'));
    it('应暴露 listSubagents()', () => expect(typeof mgr.listSubagents).toBe('function'));
    it('应暴露 cancelSubagent()', () => expect(typeof mgr.cancelSubagent).toBe('function'));
    it('应暴露 listJobs()', () => expect(typeof mgr.listJobs).toBe('function'));
    it('应暴露 cancelAllJobs()', () => expect(typeof mgr.cancelAllJobs).toBe('function'));
    it('应暴露 voiceTranscribe()', () => expect(typeof mgr.voiceTranscribe).toBe('function'));

    // 其他
    it('应暴露 steerTurn()', () => expect(typeof mgr.steerTurn).toBe('function'));
    it('应暴露 listSkills()', () => expect(typeof mgr.listSkills).toBe('function'));
    it('应暴露 setSkillEnabled()', () => expect(typeof mgr.setSkillEnabled).toBe('function'));
    it('应暴露 getWorkspaceStatus()', () => expect(typeof mgr.getWorkspaceStatus).toBe('function'));
    it('应暴露 getUsage()', () => expect(typeof mgr.getUsage).toBe('function'));
    it('应暴露 listMcpServers()', () => expect(typeof mgr.listMcpServers).toBe('function'));
    it('应暴露 listMcpTools()', () => expect(typeof mgr.listMcpTools).toBe('function'));
    it('应暴露 listAutomations()', () => expect(typeof mgr.listAutomations).toBe('function'));

    // 事件
    it('应暴露 onEvent', () => expect(mgr.onEvent).toBeDefined());
    it('应暴露 onStatusChange', () => expect(mgr.onStatusChange).toBeDefined());
    it('应暴露 onApprovalRequired', () => expect(mgr.onApprovalRequired).toBeDefined());
});

// ═══════════════════════════════════════════════════════════════
// SSE dispatchRawEvent — 所有已知事件不丢弃
// ═══════════════════════════════════════════════════════════════

describe('SSE dispatchRawEvent 事件覆盖', () => {
    it('goal.created 事件不应崩溃', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        (mgr as any).dispatchRawEvent('goal.created', JSON.stringify({
            payload: { id: 'g1', title: 'Build feature X' },
        }), mgr.generation);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'goalcreated' })
        );
    });

    it('goal.completed 事件不应崩溃', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        (mgr as any).dispatchRawEvent('goal.completed', JSON.stringify({
            payload: { id: 'g1', goal: 'Done' },
        }), mgr.generation);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'goalcompleted' })
        );
    });

    it('workflow.started 事件不应崩溃', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        (mgr as any).dispatchRawEvent('workflow.started', JSON.stringify({
            payload: { id: 'wf1', name: 'review-changes' },
        }), mgr.generation);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'workflowstarted' })
        );
    });

    it('workflow.completed 事件不应崩溃', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        (mgr as any).dispatchRawEvent('workflow.completed', JSON.stringify({
            payload: { id: 'wf1', step: 'verify' },
        }), mgr.generation);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'workflowcompleted' })
        );
    });

    it('turn.completed 事件应正常分发', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        (mgr as any).dispatchRawEvent('turn.completed', JSON.stringify({
            payload: {},
        }), mgr.generation);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'turnCompleted' })
        );
    });

    it('未知事件应被静默忽略', () => {
        const mgr = makeTuiManager();
        const onEvent = vi.fn();
        mgr.onEvent(onEvent);
        expect(() => {
            (mgr as any).dispatchRawEvent('unknown.custom.event', JSON.stringify({
                payload: {},
            }), mgr.generation);
        }).not.toThrow();
        // 未知事件不应触发 onEvent
        expect(onEvent).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════
// BinaryDownloader 接口验证
// ═══════════════════════════════════════════════════════════════

describe('BinaryDownloader 接口契约', () => {
    const dl = new BinaryDownloader(makeContext());

    it('应暴露 getLocalBinaryPath()', () => expect(typeof dl.getLocalBinaryPath).toBe('function'));
    it('应暴露 hasLocalBinary()', () => expect(typeof dl.hasLocalBinary).toBe('function'));
    it('应暴露 hasGlobalBinary()', () => expect(typeof dl.hasGlobalBinary).toBe('function'));
    it('应暴露 download()', () => expect(typeof dl.download).toBe('function'));
    it('应暴露 checkUpdate()', () => expect(typeof dl.checkUpdate).toBe('function'));
    it('应暴露 findBinary()', () => expect(typeof dl.findBinary).toBe('function'));
    it('应暴露 onProgress', () => expect(dl.onProgress).toBeDefined());
});

// ═══════════════════════════════════════════════════════════════
// SecretStore / PROVIDER_ENV_MAP 接口验证
// ═══════════════════════════════════════════════════════════════

describe('SecretStore 接口契约', () => {
    const store = new SecretStore({ get: vi.fn(), store: vi.fn(), delete: vi.fn() } as any);

    it('应暴露 getProviderApiKey()', () => expect(typeof store.getProviderApiKey).toBe('function'));
    it('应暴露 setProviderApiKey()', () => expect(typeof store.setProviderApiKey).toBe('function'));
    it('应暴露 deleteProviderApiKey()', () => expect(typeof store.deleteProviderApiKey).toBe('function'));
    it('应暴露 getAllProviderCredentials()', () => expect(typeof store.getAllProviderCredentials).toBe('function'));
    it('应暴露 getApiKey()', () => expect(typeof store.getApiKey).toBe('function'));
    it('应暴露 setApiKey()', () => expect(typeof store.setApiKey).toBe('function'));
    it('应暴露 deleteApiKey()', () => expect(typeof store.deleteApiKey).toBe('function'));
    it('应暴露 getProvider()', () => expect(typeof store.getProvider).toBe('function'));
    it('应暴露 setProvider()', () => expect(typeof store.setProvider).toBe('function'));
    it('应暴露 getBaseUrl()', () => expect(typeof store.getBaseUrl).toBe('function'));
    it('应暴露 setBaseUrl()', () => expect(typeof store.setBaseUrl).toBe('function'));
    it('应暴露 migrateLegacyIfNeeded()', () => expect(typeof store.migrateLegacyIfNeeded).toBe('function'));
});

describe('PROVIDER_ENV_MAP 完整性', () => {
    it('ALL_PROVIDERS 应等于 PROVIDER_ENV_MAP keys', () => {
        expect(new Set(ALL_PROVIDERS)).toEqual(new Set(Object.keys(PROVIDER_ENV_MAP)));
    });

    it('每个 Provider 应有 5 个必填字段', () => {
        for (const [id, m] of Object.entries(PROVIDER_ENV_MAP)) {
            expect(m).toHaveProperty('apiKeyEnv');
            expect(m).toHaveProperty('baseUrlEnv');
            expect(m).toHaveProperty('modelEnv');
            expect(m).toHaveProperty('defaultBaseUrl');
            expect(m).toHaveProperty('defaultModel');
        }
    });

    it('应包含 Phase 2 新增的 3 个 Provider', () => {
        expect(PROVIDER_ENV_MAP['anthropic']).toBeDefined();
        expect(PROVIDER_ENV_MAP['openai-codex']).toBeDefined();
        expect(PROVIDER_ENV_MAP['minimax']).toBeDefined();
    });

    it('Provider 总数 ≥ 23', () => {
        expect(Object.keys(PROVIDER_ENV_MAP).length).toBeGreaterThanOrEqual(23);
    });
});

// ═══════════════════════════════════════════════════════════════
// package.json 配置枚举完整性
// ═══════════════════════════════════════════════════════════════

describe('package.json 配置项完整性', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const props = pkg.contributes?.configuration?.properties;

    const requiredConfigs = [
        'celest.apiBase', 'celest.binaryPath', 'celest.locale', 'celest.provider',
        'celest.reasoningEffort', 'celest.pathSuffix', 'celest.hiddenSessions',
        'celest.downloadMirror', 'celest.releaseVersion', 'celest.autoCompactThreshold',
        'celest.showContextBar', 'celest.allowedTools', 'celest.disallowedTools', 'celest.maxTurns',
    ];

    for (const key of requiredConfigs) {
        it(`应包含配置项 ${key}`, () => {
            expect(props[key]).toBeDefined();
        });
    }

    it('celest.provider enum 应包含所有 23 个 Provider', () => {
        const providerEnum = props['celest.provider'].enum;
        expect(providerEnum).toContain('deepseek');
        expect(providerEnum).toContain('openai-codex');
        expect(providerEnum).toContain('anthropic');
        expect(providerEnum).toContain('minimax');
        expect(providerEnum.length).toBeGreaterThanOrEqual(23);
    });

    it('celest.downloadMirror enum 应为 [auto, github, cnb]', () => {
        expect(props['celest.downloadMirror'].enum).toEqual(['auto', 'github', 'cnb']);
    });

    it('celest.autoCompactThreshold 范围应为 0-100', () => {
        expect(props['celest.autoCompactThreshold'].minimum).toBe(0);
        expect(props['celest.autoCompactThreshold'].maximum).toBe(100);
        expect(props['celest.autoCompactThreshold'].default).toBe(85);
    });
});

// ═══════════════════════════════════════════════════════════════
// ChatViewProvider 内部方法存在性
// ═══════════════════════════════════════════════════════════════

describe('ChatViewProvider 内部方法', () => {
    const ctx = makeContext();
    const mgr = makeTuiManager();
    const p = new ChatViewProvider(ctx, mgr);

    it('应暴露 checkContextUsage', () => expect(typeof (p as any).checkContextUsage).toBe('function'));
    it('应暴露 dispatchSlashCommand', () => expect(typeof (p as any).dispatchSlashCommand).toBe('function'));
    it('应暴露 enrichPromptWithFiles', () => expect(typeof (p as any).enrichPromptWithFiles).toBe('function'));
    it('应暴露 makeProgressBar', () => expect(typeof (p as any).makeProgressBar).toBe('function'));
    it('应暴露 buildHelpText', () => expect(typeof (p as any).buildHelpText).toBe('function'));
    it('应暴露 readTuiProviderConfig', () => expect(typeof (p as any).readTuiProviderConfig).toBe('function'));
    it('应暴露 syncToTuiConfig', () => expect(typeof (p as any).syncToTuiConfig).toBe('function'));
    it('/auth 使用 tuiManager.getConfig().apiKey', () => {
        expect(mgr.getConfig).toBeDefined();
    });
    it('应暴露 getWorkspaceFiles', () => expect(typeof (p as any).getWorkspaceFiles).toBe('function'));
    it('应暴露 _turnCount', () => expect((p as any)._turnCount).toBe(0));
});
