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

    it('should expose port as 0 before start', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(manager.port).toBe(0);
    });

    it('should throw when sending prompt without connection', async () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        await expect(manager.sendPrompt('hello')).rejects.toThrow('TUI not yet connected');
    });

    it('cancel() should not throw when not connected', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(() => manager.cancel()).not.toThrow();
    });

    it('dispose() should not throw', () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        expect(() => manager.dispose()).not.toThrow();
    });

    it('listThreads() should return empty array when not connected', async () => {
        const context = { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const manager = new TuiProcessManager(context);
        const threads = await manager.listThreads();
        expect(threads).toEqual([]);
    });
});
