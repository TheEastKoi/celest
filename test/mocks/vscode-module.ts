// Mock vscode module for unit testing
// Provides minimal stubs needed by Celest extension code

const vscode = {
    window: {
        showErrorMessage: () => undefined,
        showWarningMessage: () => undefined,
        showInformationMessage: () => undefined,
        showQuickPick: () => undefined,
        activeTextEditor: undefined,
        registerWebviewViewProvider: () => ({ dispose: () => {} }),
        registerTreeDataProvider: () => ({ dispose: () => {} }),
        createOutputChannel: () => ({ appendLine: () => {} }),
        onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    },
    workspace: {
        getConfiguration: () => ({
            get: () => undefined,
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve(),
    },
    Disposable: { from: () => ({ dispose: () => {} }) },
    EventEmitter: class {
        private listeners: Function[] = [];
        event = (listener: Function) => {
            this.listeners.push(listener);
            return { dispose: () => {} };
        };
        fire = (...args: any[]) => {
            this.listeners.forEach(fn => fn(...args));
        };
    },
    TreeItem: class {
        id?: string;
        label?: string;
        collapsibleState = 0;
        tooltip?: string;
        command?: any;
        constructor(label: string, state?: number) {
            this.label = label;
            if (state !== undefined) this.collapsibleState = state;
        }
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class { constructor(public id: string) {} },
    Uri: {
        joinPath: (...args: string[]) => ({ path: args.join('/'), with: () => ({ path: '' }) }),
        parse: (s: string) => ({ fsPath: s, path: s }),
    },
    ExtensionContext: class {},
};

export = vscode;
