/**
 * Mock VS Code API for unit testing.
 * Provides minimal stubs that pass through to vitest mocks.
 */
import { vi } from 'vitest';

export function createMockContext() {
    return {
        subscriptions: [] as { dispose(): void }[],
        globalStorageUri: { fsPath: '/tmp/celest-test' } as any,
        extensionUri: { 
            path: '/test',
            with: (_: any) => ({ path: '/test' } as any),
        } as any,
    };
}

export function createMockWebview() {
    return {
        options: {} as any,
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: (uri: any) => uri,
    };
}

export function createMockWebviewView() {
    return {
        webview: createMockWebview(),
        show: vi.fn(),
    };
}
