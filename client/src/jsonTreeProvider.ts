import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class JsonTreeProvider implements vscode.TreeDataProvider<JsonTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JsonTreeItem | undefined | void> = new vscode.EventEmitter<JsonTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<JsonTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private jsonData: any;
    private jsonFilePath: string;

    constructor(private workspaceRoot: string | undefined) {
        this.jsonFilePath = path.join(this.workspaceRoot!, 'dfx.json');
        this.refresh();
    }

    refresh(): void {
        if (this.workspaceRoot) {
            if (fs.existsSync(this.jsonFilePath)) {
                const fileContent = fs.readFileSync(this.jsonFilePath, 'utf-8');
                this.jsonData = JSON.parse(fileContent);
            } else {
                this.jsonData = null;
            }
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JsonTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: JsonTreeItem): Thenable<JsonTreeItem[]> {
        if (!this.jsonData) {
            return Promise.resolve([new JsonTreeItem('No dfx.json file found in the root directory.', {}, vscode.TreeItemCollapsibleState.None)]);
        }

        if (!element) {
            // Top-level: show 'canisters'
            return Promise.resolve([
                new JsonTreeItem('canisters', this.jsonData.canisters, vscode.TreeItemCollapsibleState.Collapsed, undefined, 'canisterGroup')
            ]);
        }

        if (element.contextValue === 'canisterGroup') {
            return Promise.resolve(this.getJsonTreeItems(this.jsonData.canisters, true));
        }

        if (element.contextValue === 'canister') {
            return Promise.resolve(this.getJsonTreeItems(element.value, false));
        }

        return Promise.resolve([]);
    }
    private getJsonTreeItems(obj: any, isCanisterGroup: boolean, parentKey: string = ''): JsonTreeItem[] {
        return Object.keys(obj).map(key => {
            const value = obj[key];
            const fullPath = parentKey ? `${parentKey}.${key}` : key;
            const collapsibleState = typeof value === 'object' && !Array.isArray(value) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            const command = !isCanisterGroup && (typeof value !== 'object' || Array.isArray(value)) ? {
                command: 'jsonTree.openJson',
                title: 'Open JSON',
                arguments: [this.jsonFilePath, fullPath, value]
            } : undefined;
            const contextValue = Array.isArray(value) ? 'jsonArray' : isCanisterGroup ? 'canister' : 'jsonItem';
            return new JsonTreeItem(key, value, collapsibleState, command, contextValue);
        });
    }
}

export class JsonTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly value: any,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.getDescription(value);
        this.command = command;
        this.contextValue = contextValue || 'jsonTreeItem';
    }

    private getDescription(value: any): string {
        if (Array.isArray(value)) {
            return '[Array]';
        }
        return value;
    }
}
