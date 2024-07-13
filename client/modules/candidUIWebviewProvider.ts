import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { JsonTreeItem } from './jsonTreeProvider';

const CANDID_CANISTER_NAME = 'didjs';
const CANISTER_DEPLOYMENT_ENVIRONMENT = 'local';

export class CandidUIWebviewProvider {
	private jsonData: any;
    private candidFileData: any;
    private jsonFilePath: string;
    private candidFilePath: string;
    private webViewPort: number;

	constructor (private workspaceRoot: string | undefined, private extensionPath : string, private port : number) {
        this.jsonFilePath = path.join(this.workspaceRoot!, '.dfx', 'local', 'canister_ids.json');
        this.candidFilePath = path.join(this.extensionPath!, 'tools', 'ui', '.dfx', 'local', 'canister_ids.json');
        this.webViewPort = port;
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
        if (fs.existsSync(this.candidFilePath)) {
            const candidFileContent = fs.readFileSync(this.candidFilePath, 'utf-8');
            this.candidFileData = JSON.parse(candidFileContent);
        } else {
            this.candidFileData = null;
        }
    }

    createWebViewPanel(item: JsonTreeItem) : void {
        let itemKey = item.label?.split(':')[0];
        if (!this.candidFileData) {
            this.showInformationMessage(`Could not acquire Candid UI canister file. Have you deployed Candid?`);
        }
        else if (!this.jsonData) {
            this.showInformationMessage(`Could not acquire deployed ${itemKey} canister file. Have you properly deployed the canister?`);
        }

        else {
            let canisterCandidUI = this.getCanisterId(this.candidFileData, CANDID_CANISTER_NAME);
            let canisterId = this.getCanisterId(this.jsonData, itemKey);
            if (canisterCandidUI && canisterId) {
                const panel = vscode.window.createWebviewPanel('dfx.candidUIPreview', 'Candid UI', vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        portMapping: [
                            { webviewPort: this.webViewPort, extensionHostPort: 8000}
                        ]
                    });

                panel.webview.html = this.getWebviewContent(canisterCandidUI, canisterId);
            }
            else {
                this.showInformationMessage(`Could not get proper configuration for opening Candid UI`);
            }
        }
        
    }

    private getWebviewContent(canisterCandidUI: any, canisterId: any) : string {
        return `<!DOCTYPE html>
                    <html lang="en"">
                    <head>
                        <meta charset="UTF-8">
                        <title>Candid UI</title>
                        <style>
                            html { width: 100%; height: 100%; min-height: 100%; display: flex; }
                            body { flex: 1; display: flex; }
                            iframe { flex: 1; border: none; background: white; }
                        </style>
                    </head>
                    <body>
                        <iframe src="http://localhost:${this.webViewPort}/?canisterId=${canisterCandidUI}&id=${canisterId}"></iframe>
                    </body>
                    </html>`
    }

    private getCanisterId(data: any, key: string) : any {
        if (data[key] && data[key][CANISTER_DEPLOYMENT_ENVIRONMENT]) {
            return data[key][CANISTER_DEPLOYMENT_ENVIRONMENT];
        }
        else {
            return undefined;
        }
    }

    private showInformationMessage(message: string) : void {
        vscode.window.showInformationMessage(message);
    }
}