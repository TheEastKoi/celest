import { describe, it, expect, vi } from 'vitest';
import { SessionsTreeProvider } from '../src/sessionsTreeProvider';
import { TuiProcessManager } from '../src/tuiProcessManager';
import vscode from 'vscode';
import { logger } from '../src/logger';

const mockListThreads = vi.fn();
const mockPort = 8000;

// Create a mock TuiProcessManager
function createMockManager() {
    return {
        port: mockPort,
        connected: true,
        listThreads: mockListThreads,
    } as unknown as TuiProcessManager;
}

describe('SessionsTreeProvider', () => {
    // Suppress logger output
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    it('should return placeholder when no sessions', async () => {
        mockListThreads.mockResolvedValue([]);
        const mgr = createMockManager();
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(1);
        expect((items[0] as vscode.TreeItem).label?.toString()).toContain('No sessions yet');
    });

    it('should return session items when listThreads returns data', async () => {
        mockListThreads.mockResolvedValue([
            {
                id: 'thread-001',
                title: 'Project Discussion',
                created_at: '2026-05-21T10:00:00Z',
                updated_at: '2026-05-21T14:30:00Z',
                model: 'deepseek-v4-flash',
                mode: 'agent',
            },
            {
                id: 'thread-002',
                title: undefined,
                created_at: '2026-05-21T09:00:00Z',
                updated_at: '2026-05-21T14:00:00Z',
                model: 'deepseek-v4-pro',
                mode: 'plan',
            },
        ]);
        const mgr = createMockManager();
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(2);

        // First item should show title
        const item1 = items[0] as vscode.TreeItem;
        expect(item1.label).toBe('Project Discussion');
        expect(item1.tooltip).toContain('deepseek-v4-flash');
        expect(item1.tooltip).toContain('agent');

        // Second item should fallback to Thread prefix (no title)
        const item2 = items[1] as vscode.TreeItem;
        expect(item2.label).toBe('Thread thread-00');
    });

    it('should handle listThreads error', async () => {
        mockListThreads.mockRejectedValue(new Error('Connection refused'));
        const mgr = createMockManager();
        const provider = new SessionsTreeProvider(mgr);
        const items = await provider.getChildren();
        expect(items).toHaveLength(1);
        expect((items[0] as vscode.TreeItem).label?.toString()).toContain('Connection refused');
    });

    it('should fire tree data change event on refresh', () => {
        const mgr = createMockManager();
        const provider = new SessionsTreeProvider(mgr);
        let fired = false;
        provider.onDidChangeTreeData(() => { fired = true; });
        provider.refresh();
        expect(fired).toBe(true);
    });
});
