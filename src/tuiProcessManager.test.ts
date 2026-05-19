import { describe, it, expect, vi } from 'vitest';

// Mock child_process before importing the module
vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

import { TuiProcessManager } from '../src/tuiProcessManager';
import * as cp from 'node:child_process';

describe('TuiProcessManager', () => {
    it('should initialize without error', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(manager).toBeDefined();
    });

    it('should expose sessionId as undefined before start', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(manager.sessionId).toBeUndefined();
    });

    it('should throw when sending prompt without connection', async () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        await expect(manager.sendPrompt('hello')).rejects.toThrow('not connected');
    });

    it('cancel() should not throw when not connected', async () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        await expect(manager.cancel()).resolves.toBeUndefined();
    });

    it('dispose() should not throw', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(() => manager.dispose()).not.toThrow();
    });
});
