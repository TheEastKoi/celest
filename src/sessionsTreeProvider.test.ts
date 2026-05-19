import { describe, it, expect, vi } from 'vitest';
import { SessionsTreeProvider } from '../src/sessionsTreeProvider';
import { TuiProcessManager } from '../src/tuiProcessManager';

describe('SessionsTreeProvider', () => {
    it('should return placeholder sessions in Phase 0', async () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const tuiManager = new TuiProcessManager(context);
        const provider = new SessionsTreeProvider(tuiManager);

        const children = await provider.getChildren();
        expect(children).toHaveLength(2);
        expect((children[0] as any).id).toBe('session-1');
        expect((children[1] as any).id).toBe('session-2');
    });

    it('should fire tree data change event on refresh', () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const tuiManager = new TuiProcessManager(context);
        const provider = new SessionsTreeProvider(tuiManager);
        const listener = vi.fn();
        provider.onDidChangeTreeData(listener);
        provider.refresh();
        expect(listener).toHaveBeenCalled();
    });
});
