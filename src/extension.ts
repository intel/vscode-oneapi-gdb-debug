/**
 * Copyright (c) 2020 Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { LaunchConfigurator } from './LaunchConfigurator';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {

	// Register the commands that will interact with the user and write the launcher scripts.
	if (process.platform !== 'win32') {
		const launchConfigurator = new LaunchConfigurator();
		context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.launchConfigurator.generateLaunchJson', () => launchConfigurator.makeLaunchFile()));
	}
}
