/**
 * Copyright (c) 2020 Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
import * as vscode from 'vscode';
import { LaunchConfigurator } from './LaunchConfigurator';
import { SimdProvider } from './SimdProvider';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const simd = new SimdProvider(context);
	if (process.platform !== 'win32') {
    	// Register the commands that will interact with the user and write the launcher scripts.

		const launchConfigurator = new LaunchConfigurator();
		context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.launchConfigurator.generateLaunchJson', () => launchConfigurator.makeLaunchFile()));
	}
}
