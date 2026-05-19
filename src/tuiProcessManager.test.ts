import { describe, it, expect, vi } from 'vitest';
import { TuiProcessManager } from '../src/tuiProcessManager';

describe('TuiProcessManager', () => {
    it('should initialize without error', () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const manager = new TuiProcessManager(context);
        expect(manager).toBeDefined();
    });

    it('start() should not throw (stub)', async () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const manager = new TuiProcessManager(context);
        await expect(manager.start()).resolves.toBeUndefined();
    });

    it('send() should throw when not connected', async () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const manager = new TuiProcessManager(context);
        await expect(manager.send('thread/list')).rejects.toThrow('not connected');
    });

    it('dispose() should not throw', () => {
        const context = {
            subscriptions: [],
            globalStorageUri: { fsPath: '/tmp/celest' },
        } as any;
        const manager = new TuiProcessManager(context);
        expect(() => manager.dispose()).not.toThrow();
    });
});
