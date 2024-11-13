/**
 * Copyright (c) 2021-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */
"use strict";
import * as vscode from "vscode";
import { LaunchConfigurator } from "./LaunchConfigurator";
import { DebuggerCommandsPanel, getWebviewOptions, UserHelp } from "./UserHelp";
import { SimdProvider } from "./SimdProvider";
import { SIMDWatchProvider } from "./SimdWatchProvider";
import { SIMDViewProvider } from "./viewProviders/SIMDViewProvider";
import { ThreadInfoViewProvider } from "./viewProviders/threadInfoViewProvider"
import { DeviceViewProvider } from "./viewProviders/deviceViewProvider";
import { SelectedLaneViewProvider } from "./viewProviders/selectedLaneViewProvider";
import { SIMDWatchViewProvider } from "./viewProviders/SIMDWatchViewProvider";
import { SchedulerLocking } from "./SchedulerLocking";
import { SyscheckViewProvider } from "./viewProviders/syschecksTreeViewProvider";

function checkExtensionsConflict() {
    // The function of generating a launcher configuration from an deprecated extension conflicts with the same function from the current one.
    const deprecatedExtension = vscode.extensions.getExtension("intel-corporation.oneapi-launch-configurator");
    const actualExtension = vscode.extensions.getExtension("intel-corporation.oneapi-analysis-configurator"); // if only the deprecated version is installed, otherwise the new version will solve this problem and no action is required.
 
    if (actualExtension === undefined && deprecatedExtension !== undefined) {
        if (deprecatedExtension) {
            const Update = "Update";
            const deprExtName = deprecatedExtension.packageJSON.displayName;
 
            vscode.window.showInformationMessage(`${deprExtName} is a deprecated version. This may lead to the unavailability of overlapping functions.`, Update, "Ignore")
                .then((selection) => {
                    if (selection === Update) {
                        vscode.commands.executeCommand("workbench.extensions.uninstallExtension", deprecatedExtension.id).then(function() {
                            vscode.window.showErrorMessage(`Completed uninstalling ${deprExtName} extension.`);
                            vscode.commands.executeCommand("workbench.extensions.installExtension", "intel-corporation.oneapi-analysis-configurator").then(function() {
                                const actualExtension = vscode.extensions.getExtension("intel-corporation.oneapi-analysis-configurator");
 
                                if (actualExtension) {
                                    const Reload = "Reload";
 
                                    vscode.window.showInformationMessage("Extension update completed. Please reload Visual Studio Code.", Reload)
                                        .then((selection) => {
                                            if (selection === Reload) {
                                                vscode.commands.executeCommand("workbench.action.reloadWindow");
                                            }
                                        });
                                } else {
                                    vscode.window.showErrorMessage("Extension could not be installed.");
                                }
                            });
                        });
                    }
                });
        }
    }
}


function checkExtensionsConflict() {
    // The function of generating a launcher configuration from an deprecated extension conflicts with the same function from the current one.
    const deprecatedExtension = vscode.extensions.getExtension("intel-corporation.oneapi-launch-configurator");
    const actualExtension = vscode.extensions.getExtension("intel-corporation.oneapi-analysis-configurator"); // if only the deprecated version is installed, otherwise the new version will solve this problem and no action is required.

    if (actualExtension === undefined && deprecatedExtension !== undefined) {
        if (deprecatedExtension) {
            const Update = "Update";
            const deprExtName = deprecatedExtension.packageJSON.displayName;

            vscode.window.showInformationMessage(`${deprExtName} is a deprecated version. This may lead to the unavailability of overlapping functions.`, Update, "Ignore")
                .then((selection) => {
                    if (selection === Update) {
                        vscode.commands.executeCommand("workbench.extensions.uninstallExtension", deprecatedExtension.id).then(function () {
                            vscode.window.showErrorMessage(`Completed uninstalling ${deprExtName} extension.`);
                            vscode.commands.executeCommand("workbench.extensions.installExtension", "intel-corporation.oneapi-analysis-configurator").then(function () {
                                const actualExtension = vscode.extensions.getExtension("intel-corporation.oneapi-analysis-configurator");

                                if (actualExtension) {
                                    const Reload = "Reload";

                                    vscode.window.showInformationMessage("Extension update completed. Please reload Visual Studio Code.", Reload)
                                        .then((selection) => {
                                            if (selection === Reload) {
                                                vscode.commands.executeCommand("workbench.action.reloadWindow");
                                            }
                                        });
                                } else {
                                    vscode.window.showErrorMessage("Extension could not be installed.");
                                }
                            });
                        });
                    }
                });
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
    const schedulerLocking = new SchedulerLocking(context);

    context.globalState.update("ThreadFilter", undefined);
    const syscheckProvider = new SyscheckViewProvider(context);
    vscode.window.registerTreeDataProvider("intelOneAPI.syscheckView", syscheckProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("intelOneAPI.syscheckView.refresh", () => syscheckProvider.refresh())
    );

    // Add the status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = "intelOneAPI.syscheckView.focusAndRun";
    statusBarItem.text = "$(syscheck-icon)";
    statusBarItem.tooltip = "Focus on Debugger Healths Checks for oneAPI and Run";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand("intelOneAPI.syscheckView.focusAndRun", async () => {
            // Focus the Explorer view
            await vscode.commands.executeCommand("workbench.view.explorer");

            // Reveal the specific tree view
            await vscode.commands.executeCommand("workbench.view.extension.intelOneAPI_syscheckView");

            // Run the syscheckView command
            await vscode.commands.executeCommand("intelOneAPI.syscheckView.run");
        })
    );

    // Checking for outdated versions of extensions in the VS Code environment
    checkExtensionsConflict();

    if (process.platform !== "linux") {
        vscode.window.showWarningMessage("The Windows and macOS operating systems are not currently supported by the \"GDB GPU Support for Intel® oneAPI Toolkits\" extension. Debugging remote Linux systems from a Windows and macOS host is supported when using the various Microsoft \"Remote\" extensions.");
    }

    const simdWatchViewProvider = new SIMDWatchViewProvider(context.extensionUri, context);
    const simdWatchViewDisposable = vscode.window.registerWebviewViewProvider(
        SIMDWatchViewProvider.viewType,
        simdWatchViewProvider
    );

    context.subscriptions.push(simdWatchViewDisposable);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const simdWatchProvider = new SIMDWatchProvider(context, simdWatchViewProvider);
    const threadInfoViewProvider = new ThreadInfoViewProvider(context.extensionUri);
    const threadInfoViewDisposable = vscode.window.registerWebviewViewProvider(
        ThreadInfoViewProvider.viewType,
        threadInfoViewProvider
    );

    context.subscriptions.push(threadInfoViewDisposable);

    const selectedLaneViewProvider = new SelectedLaneViewProvider(context.extensionUri);
    const selectedLaneViewDisposable = vscode.window.registerWebviewViewProvider(
        SelectedLaneViewProvider.viewType,
        selectedLaneViewProvider
    );

    // Init SimdWatch panel
    simdWatchProvider.fetchSimdWatchPanel();

    context.subscriptions.push(selectedLaneViewDisposable);

    const simdViewProvider = new SIMDViewProvider(context, threadInfoViewProvider, selectedLaneViewProvider);
    const simdViewDisposable = vscode.window.registerWebviewViewProvider(
        SIMDViewProvider.viewType,
        simdViewProvider
    );

    simdViewProvider.activeLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("ACTIVE_LANE_SYMBOL");
    simdViewProvider.inactiveLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("INACTIVE_LANE_SYMBOL");

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.ACTIVE_LANE_SYMBOL")) {
            simdViewProvider.activeLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("ACTIVE_LANE_SYMBOL");
        }
        if (e.affectsConfiguration("intelOneAPI.debug.INACTIVE_LANE_SYMBOL")) {
            simdViewProvider.inactiveLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("INACTIVE_LANE_SYMBOL");
        }
    }));

    context.subscriptions.push(simdViewDisposable);

    const deviceViewProvider = new DeviceViewProvider(context.extensionUri);
    const deviceViewDisposable = vscode.window.registerWebviewViewProvider(
        DeviceViewProvider.viewType,
        deviceViewProvider
    );

    context.subscriptions.push(deviceViewDisposable);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const simd = new SimdProvider(context, simdViewProvider, deviceViewProvider, simdWatchProvider);

    simd.showInactiveThreads = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("SHOW_ALL");

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.SHOW_ALL")) {
            simd.showInactiveThreads = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("SHOW_ALL");
        }
    }));

    // Register the commands that will interact with the user and write the launcher scripts.

    const simdViewProvider = new SIMDViewProvider(context.extensionUri, selectedLaneViewProvider);
    const simdViewDisposable = vscode.window.registerWebviewViewProvider(
        SIMDViewProvider.viewType,
        simdViewProvider
    );

    simdViewProvider.activeLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("ACTIVE_LANE_SYMBOL");
    simdViewProvider.inactiveLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("INACTIVE_LANE_SYMBOL");

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.ACTIVE_LANE_SYMBOL")) {
            simdViewProvider.activeLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("ACTIVE_LANE_SYMBOL");
        }
        if (e.affectsConfiguration("intelOneAPI.debug.INACTIVE_LANE_SYMBOL")) {
            simdViewProvider.inactiveLaneSymbol = vscode.workspace.getConfiguration("intelOneAPI.debug").get<string>("INACTIVE_LANE_SYMBOL");
        }
    }));
 
    context.subscriptions.push(simdViewDisposable);
 
    const deviceViewProvider = new DeviceViewProvider(context.extensionUri);
    const deviceViewDisposable = vscode.window.registerWebviewViewProvider(
        DeviceViewProvider.viewType,
        deviceViewProvider
    );
 
    context.subscriptions.push(deviceViewDisposable);
 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const simd = new SimdProvider(context, simdViewProvider, deviceViewProvider);

    simd.showInactiveThreads = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("SHOW_ALL");

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.SHOW_ALL")) {
            simd.showInactiveThreads = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("SHOW_ALL");
        }
    }));

    // Register the commands that will interact with the user and write the launcher scripts.
 
    const launchConfigurator = new LaunchConfigurator();

    launchConfigurator.disableGDBCheck = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("DISABLE_ONEAPI_GDB_PATH_NOTIFICATION");
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.DISABLE_ONEAPI_GDB_PATH_NOTIFICATION")) {
            launchConfigurator.disableGDBCheck = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("DISABLE_ONEAPI_GDB_PATH_NOTIFICATION");
        }
    }));

    launchConfigurator.disableENVCheck = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("DISABLE_ONEAPI_ENV_NOTIFICATION");
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("intelOneAPI.debug.DISABLE_ONEAPI_ENV_NOTIFICATION")) {
            launchConfigurator.disableGDBCheck = vscode.workspace.getConfiguration("intelOneAPI.debug").get<boolean>("DISABLE_ONEAPI_ENV_NOTIFICATION");
        }
    }));

    launchConfigurator.checkGdb();
    if (vscode.workspace.workspaceFolders) {
        launchConfigurator.checkLaunchConfig();
    }
    context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.launchConfigurator.generateLaunchJson", () => launchConfigurator.makeLaunchFile()));
    context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.debug.makeBreak", () => simd.addSimdBreakPointsFromEditor()));

    // Register commands that will let user search through documentation easily
    const userHelp = new UserHelp();

    context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.userHelp.openOnlineDocumentation", () => userHelp.openOnlineDocumentation()));

    context.subscriptions.push(
        vscode.commands.registerCommand("intelOneAPI.userHelp.displayDebuggerCommands", () => {
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

    const tsExtension = vscode.extensions.getExtension("ms-vscode.cpptools");

    if (!tsExtension) {
        const GoToInstall = "Install C/C++ Extension";

        vscode.window.showInformationMessage("No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.", GoToInstall)
            .then((selection) => {
                if (selection === GoToInstall) {
                    vscode.commands.executeCommand("workbench.extensions.installExtension", "ms-vscode.cpptools");
                }
            });
    }
}
 