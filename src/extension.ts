/**
 * Copyright (c) 2020 Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { LaunchConfigurator } from './LaunchConfigurator';

// Return the uri corresponding to the base folder of the item currently selected in the explorer.
// If the node is not given, ask the user to select the base folder.
function getBaseUri(node: vscode.Uri): vscode.Uri | undefined {
	let baseUri: vscode.Uri | undefined;

	// If only one folder, just return its uri
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length === 1) {
		baseUri = folders[0].uri;
	}

	// Get the folder corresponding to the selected node
	if (node) {
		const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder(node);
		if (folder) {
			baseUri = folder.uri;
		}
	}

	return baseUri;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
	// Todo: The extension is currently activated at startup, as activationEvents in package.json uses '*'.
	// Find the viewID for explorer so it could be activated via 'onView:viewId'.

	// Register the commands that will interact with the user and write the launcher scripts.
	const launchConfigurator = new LaunchConfigurator();
	context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.launchConfigurator.generateLaunchJson', () => launchConfigurator.makeLaunchFile()));

	// Check that oneapi-environment-variables already installed
	const tsExtension = vscode.extensions.getExtension('intel-corporation.oneapi-environment-variables');
	if (!tsExtension) {
		const GoToInstall = 'Install';
		vscode.window.showInformationMessage('It is recommended to install Environment configurator for Intel oneAPI Toolkits to simplify oneAPI environment setup', GoToInstall)
			.then(selection => {
				if (selection === GoToInstall) {
					vscode.commands.executeCommand('workbench.extensions.installExtension', 'intel-corporation.oneapi-environment-variables');

				}
			});
		}
}
