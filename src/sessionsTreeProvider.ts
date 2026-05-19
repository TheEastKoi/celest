import * as vscode from 'vscode';
import { TuiProcessManager } from './tuiProcessManager';

interface SessionItem {
    id: string;
    preview: string;
    updatedAt: number;
}

/**
 * 会话列表 TreeView Provider。
 * 通过 TUI 的 thread/list RPC 获取数据。
 */
export class SessionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private tuiManager: TuiProcessManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        // Phase 1: 调用 tuiManager.send('thread/list') 获取真实数据
        // Phase 0: 返回占位列表
        return [
            this.makeItem('session-1', 'Example: Code refactor discussion', Date.now()),
            this.makeItem('session-2', 'Example: Debug API endpoint', Date.now() - 3600000),
        ];
    }

    private makeItem(id: string, preview: string, updatedAt: number): vscode.TreeItem {
        const item = new vscode.TreeItem(
            preview,
            vscode.TreeItemCollapsibleState.None,
        );
        item.id = id;
        item.tooltip = preview;
        item.command = {
            command: 'celest.focusInput',
            title: 'Open Session',
            arguments: [id],
        };
        return item;
    }
}
