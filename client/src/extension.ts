/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { JsonTreeItem, JsonTreeProvider } from './jsonTreeProvider';
import { exec } from 'child_process';

let client: LanguageClient;
let dfxPath: string;

export function activate(context: vscode.ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', pattern: "**/dfx.json", language: 'json' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);

    // Start the client. This will also launch the server
    client.start();

    // jsonTree
    const rootPath = vscode.workspace.rootPath;
    const treeDataProvider = new JsonTreeProvider(rootPath);
    vscode.window.registerTreeDataProvider('jsonTree', treeDataProvider);

    const outputChannel = vscode.window.createOutputChannel("Motoko");
    context.subscriptions.push(outputChannel);

    vscode.commands.registerCommand('jsonTree.refreshEntry', () => treeDataProvider.refresh());
    vscode.commands.registerCommand('jsonTree.deployCanister', (item: JsonTreeItem) => {
        runCommand(`dfx deploy ${item.label.split(':')[0]} --network playground`, `Deploying canister: ${item.label}`);
    });
    vscode.commands.registerCommand('jsonTree.startReplica', () => {
        startReplica();
    });

    vscode.commands.registerCommand('jsonTree.deployCanisters', () => {
        runCommand('dfx deploy --network playground', 'Deploying canisters...');
    });

    vscode.commands.registerCommand('jsonTree.openJson', (filePath: string, keyPath: string, value: any) => {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc).then(editor => {
                const text = doc.getText();
                let regex;
                if (Array.isArray(value)) {
                    regex = new RegExp(`"${keyPath.replace(/\./g, '\\.').replace(/\[|\]/g, '\\$&')}"\\s*:\\s*\\[`, 'g');
                } else {
                    regex = new RegExp(`"${keyPath.replace(/\./g, '\\."')}"\\s*:\\s*${JSON.stringify(value).replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')}`, 'g');
                }
                const match = regex.exec(text);
                if (match) {
                    const position = doc.positionAt(match.index);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                }
            });
        });
    });


    vscode.commands.registerCommand('jsonTree.showCanisterGroupActions', async () => {
        const options = ['Start Replica', 'Deploy Canisters'];
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an action'
        });

        if (selection === 'Start Replica') {
            vscode.commands.executeCommand('jsonTree.startReplica');
        } else if (selection === 'Deploy Canisters') {
            vscode.commands.executeCommand('jsonTree.deployCanisters');
        }
    });

    vscode.commands.registerCommand('jsonTree.showCanisterActions', async (item: JsonTreeItem) => {
        const options = ['Deploy Canister'];
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an action'
        });

        if (selection === 'Deploy Canister') {
            vscode.commands.executeCommand('jsonTree.deployCanister', item);
        }
    });

    vscode.commands.registerCommand('jsonTree.showOptions', async () => {
        const options = [
            { label: 'Refresh', command: 'jsonTree.refreshEntry' },
            { label: 'Configure WSL DFX Path', command: 'jsonTree.configureDfxPath' },
        ];
        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an option'
        });

        if (selection) {
            vscode.commands.executeCommand(selection.command);
        }
    });

    vscode.commands.registerCommand('jsonTree.configureDfxPath', async () => {
        let newPath = await vscode.window.showInputBox({
            prompt: 'Enter the WSL path to dfx',
            placeHolder: '/home/user/.local/share/dfx/bin/'
        });

        if (newPath) {
            dfxPath = newPath;
            vscode.window.showInformationMessage(`WSL DFX path set to: ${dfxPath}`);
        }
    });

    function runCommand(command: string, infoMessage: string) {
        outputChannel.show(true);
        outputChannel.appendLine(infoMessage);

        const fullCommand = dfxPath ? `wsl ${dfxPath}${command}` : `${command}`;
    
        exec(fullCommand, { cwd: vscode.workspace.rootPath }, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                outputChannel.appendLine(stderr.toString());
                return;
            }
            outputChannel.appendLine(stdout.toString());
        });
    }

    function startReplica() {
        outputChannel.show(true);
        outputChannel.appendLine(`Starting replica...`);
        
        const command = dfxPath ? `wsl ${dfxPath}dfx start` : `dfx start`;
        const replicaProcess = exec(command, { cwd: vscode.workspace.rootPath });

        replicaProcess.stdout.on('data', (data) => {
            outputChannel.appendLine(data.toString());
        });

        replicaProcess.stderr.on('data', (data) => {
            outputChannel.appendLine(data.toString());
        });

        replicaProcess.on('close', (code) => {
            outputChannel.appendLine(`Replica process exited with code ${code}`);
        });

        
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
