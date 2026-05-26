import * as vscode from 'vscode';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';

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
        try {
            const threads = await this.tuiManager.getThreadSummary(50);
            if (threads.length === 0) {
                return [this.makePlaceholder('No sessions yet. Send a prompt to create one.')];
            }
            return threads.map(t => {
                // 使用 title，fallback 到 Thread ID 前 8 位
                const label = t.title || `Thread ${t.id.slice(0, 8)}`;
                // 解析 ISO 8601 时间为本地化显示
                const date = this.formatDate(t.updated_at);
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.id = t.id;
                item.tooltip = `${label}\nModel: ${t.model || 'unknown'}\nMode: ${t.mode || 'unknown'}\nUpdated: ${date}`;
                item.description = date;
                item.command = {
                    command: 'celest.focusInput',
                    title: 'Open Session',
                    arguments: [t.id],
                };
                item.contextValue = 'session';
                item.iconPath = new vscode.ThemeIcon('comment-discussion');
                return item;
            });
        } catch (err: any) {
            logger.error('Failed to list threads:', err.message);
            return [this.makePlaceholder(`Error loading sessions: ${err.message}`)];
        }
    }

    /** ISO 8601 → 本地化短日期 */
    private formatDate(iso: string): string {
        if (!iso) return 'unknown';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso.slice(0, 10); // fallback to date portion
            return d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return iso.slice(0, 10);
        }
    }

    private makePlaceholder(text: string): vscode.TreeItem {
        const item = new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None);
        item.tooltip = text;
        return item;
    }
}
