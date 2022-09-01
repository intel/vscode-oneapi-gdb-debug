/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
"use strict";
import * as vscode from "vscode";
import { LaunchConfigurator } from "./LaunchConfigurator";
import { DebuggerCommandsPanel, getWebviewOptions, UserHelp } from "./UserHelp";
import { SimdProvider } from "./SimdProvider";
import { SIMDViewProvider } from "./viewProviders/SIMDViewProvider";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
    // Checking for outdated versions of extensions in the VS Code environment
    checkExtensionsConflict();

    if (process.platform !== "linux") {
        vscode.window.showWarningMessage("The Windows and macOS operating systems are not currently supported by the \"GDB GPU Support for Intel® oneAPI Toolkits\" extension. Debugging remote Linux systems from a Windows and macOS host is supported when using the various Microsoft \"Remote\" extensions.");
    }

    const provider = new SIMDViewProvider(context.extensionUri);
    const simdViewDisposable = vscode.window.registerWebviewViewProvider(
        SIMDViewProvider.viewType,
        provider
    );

    context.subscriptions.push(simdViewDisposable);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const simd = new SimdProvider(context, provider);
    // Register the commands that will interact with the user and write the launcher scripts.

    const launchConfigurator = new LaunchConfigurator();

    launchConfigurator.checkGdb();
    if (vscode.workspace.workspaceFolders) {
        launchConfigurator.checkLaunchConfig();
    }
    context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.launchConfigurator.generateLaunchJson", () => launchConfigurator.makeLaunchFile()));

    // Register commands that will let user search through documentation easily
    const userHelp = new UserHelp();

    context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.userHelp.openOnlineDocumentation", () => userHelp.openOnlineDocumentation()));

    context.subscriptions.push(
        vscode.commands.registerCommand("intelOneAPI.userHelp.displayDebuggerCommands", () => {
            DebuggerCommandsPanel.createOrShow(context.extensionUri);
        })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const session = vscode.debug.activeDebugSession;

    vscode.debug.registerDebugAdapterTrackerFactory("*", {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        createDebugAdapterTracker(session) {
            return {
                onDidSendMessage: m => {
                    if (JSON.stringify(m, undefined, 2).indexOf("Target Id") !== -1){
                        const body = m.body.output;
                        const threadsNumber = (body).match(/[+-]?([0-9]*[.])?[0-9]:\[[0-9]-[0-9]]/g);
                        const threadsResult = [];

                        for (const prop in threadsNumber) {
                            let second;

                            if (+prop === threadsNumber.length-1) {
                                second = body.length;
                            } else {
                                second = body.indexOf(threadsNumber[+prop+1]);
                            }
                            const first = body.indexOf(threadsNumber[prop]);
                            const threadInfo = body.substring(first, second);
                            const nameTemplate = threadInfo.match(/(?<=Thread)(.*)(?=main::)/g)?.[0];
                            const firstQuotes = nameTemplate.indexOf("\"");
                            const lastQuotes = nameTemplate.lastIndexOf("\"");
                            const name = ( firstQuotes !== -1 && lastQuotes !== -1 ) ? nameTemplate.substring(firstQuotes + 1, lastQuotes) : "";

                            threadsResult.push({
                                index: +prop,
                                threadId: +threadsNumber[prop],
                                name
                            });
                        }
                        simd.threadsInfo = threadsResult;
                    }
                }
            };
        }
    });

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
