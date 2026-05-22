import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

describe('TuiProcessManager', () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});

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
        // bypass _started check by setting process
        (mgr as any)._started = true;
        (mgr as any)._port = 19999; // bad port
        const threads = await mgr.listThreads();
        expect(Array.isArray(threads)).toBe(true);
    });
});
