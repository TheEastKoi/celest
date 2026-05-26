import { describe, it, expect, vi } from 'vitest';
import { SessionsTreeProvider } from './sessionsTreeProvider';
import { logger } from './logger';

describe('SessionsTreeProvider', () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    function makeMockManager(listFn: () => Promise<any[]>) {
        return { getThreadSummary: listFn } as any;
    }

    it('should return placeholder when no sessions', async () => {
        const mgr = makeMockManager(async () => []);
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(1);
        expect(items[0].label).toContain('No sessions yet');
    });

    it('should return session items when listThreads returns data', async () => {
        const mgr = makeMockManager(async () => [
            { id: 't1', title: 'Project Discussion', created_at: '2026-05-21T10:00:00Z', updated_at: '2026-05-21T14:30:00Z', model: 'v4', mode: 'agent' },
            { id: 't2', title: undefined, created_at: '2026-05-21T09:00:00Z', updated_at: '2026-05-21T14:00:00Z', model: 'pro', mode: 'plan' },
        ]);
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(2);
        expect(items[0].label).toBe('Project Discussion');
        expect(items[1].label).toContain('Thread');
    });

    it('should handle listThreads error', async () => {
        const mgr = makeMockManager(async () => { throw new Error('Connection refused'); });
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(1);
        expect(items[0].label).toContain('Connection refused');
    });

    it('should fire tree data change event on refresh', () => {
        const mgr = makeMockManager(async () => []);
        const provider = new SessionsTreeProvider(mgr);
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });
        provider.refresh();
        expect(fired).toBe(true);
    });
});
