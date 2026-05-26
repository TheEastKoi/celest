import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

describe('TuiProcessManager', () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    function makeContext() { return { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any; }

    it('should construct without error', () => {
        const ctx = makeContext();
        expect(() => new TuiProcessManager(ctx)).not.toThrow();
    });

    it('should expose port=0 before start', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.port).toBe(0);
    });

    it('should throw when sending prompt without connection', async () => {
        const mgr = new TuiProcessManager(makeContext());
        await expect(mgr.sendPrompt('hello')).rejects.toThrow('TUI not yet connected');
    });

    it('cancel() should not throw when not connected', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(() => mgr.cancel()).not.toThrow();
    });

    it('dispose() should not throw', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(() => mgr.dispose()).not.toThrow();
    });

    it('listThreads() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        const threads = await mgr.listThreads();
        expect(threads).toEqual([]);
    });

    it('listThreads() should handle fetch errors gracefully', async () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        (mgr as any)._port = 19999; // bad port
        const threads = await mgr.listThreads();
        expect(Array.isArray(threads)).toBe(true);
    });

    // ── Phase 6.1: Skills ──

    it('listSkills() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listSkills()).toBeNull();
    });

    it('listSkills() should handle fetch errors gracefully', async () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        (mgr as any)._port = 19999;
        expect(await mgr.listSkills()).toBeNull();
    });

    it('setSkillEnabled() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.setSkillEnabled('test-skill', true)).toBe(false);
    });

    it('setSkillEnabled() should handle fetch errors gracefully', async () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        (mgr as any)._port = 19999;
        expect(await mgr.setSkillEnabled('test-skill', true)).toBe(false);
    });

    // ── Phase 6.1: Workspace / Usage / Compact ──

    it('getWorkspaceStatus() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getWorkspaceStatus()).toBeNull();
    });

    it('getUsage() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getUsage()).toBeNull();
    });

    it('getUsage() should accept query params gracefully on bad port', async () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        (mgr as any)._port = 19999;
        expect(await mgr.getUsage({ group_by: 'day' })).toBeNull();
    });

    it('compactThread() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.compactThread('thr_123')).toBe(false);
    });

    // ── Phase 6.2: Sessions ──

    it('listSessions() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listSessions()).toEqual([]);
    });

    it('getSession() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getSession('sess_1')).toBeNull();
    });

    it('deleteSession() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.deleteSession('sess_1')).toBe(false);
    });

    it('resumeSessionThread() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.resumeSessionThread('sess_1')).toBeNull();
    });

    it('resumeSessionThread() should handle bad port', async () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        (mgr as any)._port = 19999;
        expect(await mgr.resumeSessionThread('sess_1', 'deepseek-v4-flash', 'agent')).toBeNull();
    });

    // ── Phase 6.2: Threads ──

    it('getThread() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getThread('thr_1')).toBeNull();
    });

    it('getThreadSummary() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getThreadSummary()).toEqual([]);
    });

    it('resumeThread() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.resumeThread('thr_1')).toBeNull();
    });

    // ── Phase 6.2: Tasks ──

    it('createTask() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.createTask({ prompt: 'do something' })).toBeNull();
    });

    it('getTask() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getTask('task_1')).toBeNull();
    });

    it('cancelTask() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.cancelTask('task_1')).toBe(false);
    });

    // ── Phase 6.2: Steer ──

    it('steerTurn() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.steerTurn('thr_1', 'turn_1', 'do it differently')).toBe(false);
    });

    // ── Phase 6.3: MCP ──

    it('listMcpServers() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listMcpServers()).toEqual([]);
    });

    it('listMcpTools() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listMcpTools()).toEqual([]);
    });

    // ── Phase 5: Runtime info / Config ──

    it('getRuntimeInfo() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getRuntimeInfo()).toBeNull();
    });

    it('setConfig() should merge config values', () => {
        const mgr = new TuiProcessManager(makeContext());
        mgr.setConfig({ model: 'deepseek-v4-pro', mode: 'plan' });
        const cfg = mgr.getConfig();
        expect(cfg.model).toBe('deepseek-v4-pro');
        expect(cfg.mode).toBe('plan');
    });

    it('setConfig() partial update should preserve existing values', () => {
        const mgr = new TuiProcessManager(makeContext());
        mgr.setConfig({ model: 'custom-model', apiKey: 'sk-test' });
        mgr.setConfig({ mode: 'yolo' });
        const cfg = mgr.getConfig();
        expect(cfg.model).toBe('custom-model');
        expect(cfg.apiKey).toBe('sk-test');
        expect(cfg.mode).toBe('yolo');
    });

    // ── Phase 5: updateThreadConfig ──

    it('updateThreadConfig() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.updateThreadConfig('thr_1', { model: 'deepseek-v4-pro' })).toBe(false);
    });

    // ── Phase 6.3+: Automations ──

    it('listAutomations() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listAutomations()).toEqual([]);
    });

    it('getAutomation() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.getAutomation('auto_1')).toBeNull();
    });

    it('listAutomationRuns() should return empty array when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.listAutomationRuns('auto_1')).toEqual([]);
    });

    it('createAutomation() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.createAutomation({ name: 'test', prompt: 'do', rrule: '0 0 * * *' })).toBeNull();
    });

    it('updateAutomation() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.updateAutomation('auto_1', { name: 'renamed' })).toBeNull();
    });

    it('deleteAutomation() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.deleteAutomation('auto_1')).toBe(false);
    });

    it('runAutomation() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.runAutomation('auto_1')).toBe(false);
    });

    it('pauseAutomation() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.pauseAutomation('auto_1')).toBe(false);
    });

    it('resumeAutomation() should return false when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.resumeAutomation('auto_1')).toBe(false);
    });

    // ── Phase 6.3+: Fork ──

    it('forkThread() should return null when not connected', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.forkThread('thr_1')).toBeNull();
    });

    // ── autoApprove / connected ──

    it('autoApprove should default to false', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.autoApprove).toBe(false);
    });

    it('autoApprove setter should work', () => {
        const mgr = new TuiProcessManager(makeContext());
        mgr.autoApprove = true;
        expect(mgr.autoApprove).toBe(true);
        mgr.autoApprove = false;
        expect(mgr.autoApprove).toBe(false);
    });

    it('connected should be false when not started', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.connected).toBe(false);
    });
});
