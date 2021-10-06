/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { LaunchConfigurator } from './LaunchConfigurator';
import { UserHelp, DebuggerCommandsPanel, getWebviewOptions } from './UserHelp';
import { SimdProvider } from './SimdProvider';


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {

	if (process.platform !== 'linux') {
		vscode.window.showWarningMessage(`The Windows and macOS operating systems are \
		not currently supported by the "GDB GPU Support for Intel® oneAPI Toolkits" \
		extension. Debugging remote Linux systems from a Windows and macOS host is \
		supported when using the various Microsoft "Remote" extensions.`, { modal: true });
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const simd = new SimdProvider(context);
	// Register the commands that will interact with the user and write the launcher scripts.

	const launchConfigurator = new LaunchConfigurator();
	context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.launchConfigurator.generateLaunchJson', () => launchConfigurator.makeLaunchFile()));

	// Register commands that will let user search through documentation easily
	const userHelp = new UserHelp();
	context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.userHelp.openOnlineDocumentation', () => userHelp.openOnlineDocumentation()));

	context.subscriptions.push(
		vscode.commands.registerCommand('intelOneAPI.userHelp.displayDebuggerCommands', () => {
			DebuggerCommandsPanel.createOrShow(context.extensionUri);
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(DebuggerCommandsPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				DebuggerCommandsPanel.revive(webviewPanel, context.extensionUri);
			}
		});
	}
}
