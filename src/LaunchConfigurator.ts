/**
 * Copyright (c) 2021-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

"use strict";
import * as vscode from "vscode";
import { execSync } from "child_process";
import { posix, parse } from "path";

const debugConfigTemplate = {
    name: "(gdb-oneapi) ${workspaceFolderBasename} Launch",
    miDebuggerPath: "gdb-oneapi",
    MIMode: "gdb",
    type: "cppdbg",
    request: "launch",
    preLaunchTask: "",
    postDebugTask: "",
    stopAtEntry: true,
    program: "${workspaceFolder}/src/array-transform",
    cwd: "${workspaceFolder}/build",
    args: [] as string[],
    environment: [
        { name: "ZET_ENABLE_PROGRAM_DEBUGGING", value: "1" },
        { name: "IGC_EnableGTLocationDebugging", value: "1" },
    ],
    externalConsole: false,
    setupCommands: [
        { description: "Disable MI-async", text: "set mi-async off", ignoreFailures: true },
        { description: "Enable auto-load for all paths. Considered a security risk. See link for details: https://sourceware.org/gdb/current/onlinedocs/gdb.html/Auto_002dloading-safe-path.html", text: "set auto-load safe-path /", ignoreFailures: true },
        { description: "Enable pretty-printing for gdb", text: "set print pretty on", ignoreFailures: true },
        { description: "Set Disassembly Flavor to Intel", text: "set disassembly intel", ignoreFailures: true },
        { description: "Do not display function arguments when printing a stack frame", text: "set print frame-arguments none", ignoreFailures: true }
    ]
};

export class LaunchConfigurator {
    private _disableGDBCheck: boolean = false;
    private _disableENVCheck: boolean = false;

    public set disableGDBCheck(flag: boolean | undefined) {
        this._disableGDBCheck = flag ?? false;
    }

    public set disableENVCheck(flag: boolean | undefined) {
        this._disableENVCheck = flag ?? false;
    }

    async makeLaunchFile(): Promise<boolean> {
        if (process.platform === "win32") {
            vscode.window.showInformationMessage("This function cannot be used for Windows as a target platform. Generating configurations for debugging is only possible for use on Linux.", { modal: true });
            return false;
        }

        const workspaceFolder = await getWorkspaceFolder();
        if (!workspaceFolder) return false; // for unit tests

        const projectRootDir = workspaceFolder.uri.fsPath;
        let execFiles = await this.findExecutables(projectRootDir);
        execFiles.push("Leave it empty", "Provide path to the executable file manually");

        const selection = await vscode.window.showQuickPick(execFiles, {
            placeHolder: "Select the executable you want to debug. Press ESC to exit or if done creating debug configuration."
        });

        if (!selection) return false;

        let execFile: string | undefined;
        if (selection === "Leave it empty") {
            execFile = "";
            await vscode.window.showInformationMessage("Note: Launch template cannot be launched immediately after creation.\nPlease edit the launch.json file according to your needs before running.", { modal: true });
        } else if (selection === "Provide path to the executable file manually") {
            const pathToExecFile = await vscode.window.showOpenDialog({ canSelectMany: false });
            if (pathToExecFile && pathToExecFile[0]) {
                execFile = pathToExecFile[0].fsPath;
            } else {
                await vscode.window.showErrorMessage("Path to the executable file invalid.\nPlease check path and name and try again.", { modal: true });
                return false;
            }
        } else {
            execFile = selection;
        }

        const stopAtEntrySelection = await vscode.window.showQuickPick(["yes", "no"], {
            placeHolder: "Automatically break on main?"
        });

        if (!stopAtEntrySelection) return false;

        const args: string[] = [];
        let argument: string | undefined;
        do {
            argument = await vscode.window.showInputBox({
                placeHolder: "Argument",
                title: "Type new command-line argument or press ENTER with empty string to skip"
            });
            if (argument?.trim().length) args.push(argument);
        } while (argument?.trim().length);

        const oneApiDeviceSelectorSelection = await vscode.window.showQuickPick(["yes", "no"], {
            placeHolder: "Include ONEAPI_DEVICE_SELECTOR environment variable?"
        });

        let newEnvironment = [...debugConfigTemplate.environment];

        if (oneApiDeviceSelectorSelection === "yes") {
            const oneApiDeviceArgument = await vscode.window.showInputBox({
                placeHolder: "ONEAPI_DEVICE_SELECTOR Argument",
                title: "Type ONEAPI_DEVICE_SELECTOR argument (Example: *:gpu) or press ENTER to skip"
            });

            if (oneApiDeviceArgument?.trim().length) {
                newEnvironment = newEnvironment.filter(env => env.name !== "ONEAPI_DEVICE_SELECTOR");
                newEnvironment.push({
                    name: "ONEAPI_DEVICE_SELECTOR",
                    value: oneApiDeviceArgument
                });
            }
        }

        const debugConfig = {
            ...debugConfigTemplate,
            stopAtEntry: stopAtEntrySelection === "yes",
            args,
            program: execFile?.split(/[\\/]/g).join(posix.sep),
            environment: newEnvironment
        };

        debugConfig.name = execFile === "" ? "Launch_template" : `(gdb-oneapi) ${parse(execFile).base} Launch`;

        await this.addTasksToLaunchConfig(debugConfig);

        const launchConfig = vscode.workspace.getConfiguration("launch");
        const configurations = launchConfig.configurations;
        const isUniq = await this.checkLaunchItem(configurations, debugConfig);

        if (isUniq) {
            configurations.push(debugConfig);
            await launchConfig.update("configurations", configurations, false);
            vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program || "empty path"}" was added`);
        } else {
            vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program || "empty path"}" was skipped as duplicate`);
            return false;
        }

        return true;
    }

    async checkLaunchConfig(): Promise<void> {
        if (!await this.isThereDebugConfig()) {
            const selection = await vscode.window.showInformationMessage("Unable to identify oneAPI C++ launch configuration in your launch.json file. Would you like to create a debug launch configuration now?", "Yes", "No");

            if (selection === "Yes") {
                await vscode.commands.executeCommand("intelOneAPI.launchConfigurator.generateLaunchJson");
            }
        }
    }

    async isThereDebugConfig(): Promise<boolean> {
        for (const folder of vscode.workspace.workspaceFolders || []) {
            const launchConfig = vscode.workspace.getConfiguration("launch", folder.uri);
            const configs = launchConfig.configurations;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (configs.some((cfg: any) => cfg.type === "cppdbg" && cfg.miDebuggerPath === "gdb-oneapi")) {
                return true;
            }
        }
        return false;
    }

    async checkGdb(): Promise<void> {
        if (!this._disableENVCheck && !process.env.SETVARS_COMPLETED) {
            if (await this.checkEnvConfigurator()) {
                const selection = await vscode.window.showInformationMessage("oneAPI environment is not configured. Configure your development environment using \"Environment Configurator for Intel oneAPI Toolkits\".", "Default environment", "Using SETVARS_CONFIG", "Do not show this message again");

                if (selection === "Default environment") {
                    await vscode.commands.executeCommand("intel-corporation.oneapi-environment-configurator.initializeEnvironment");
                } else if (selection === "Using SETVARS_CONFIG") {
                    await vscode.commands.executeCommand("intel-corporation.oneapi-environment-configurator.initializeEnvironmentConfig");
                } else if (selection === "Do not show this message again") {
                    const configuration = vscode.workspace.getConfiguration("intelOneAPI.debug");
                    await configuration.update("DISABLE_ONEAPI_ENV_NOTIFICATION", true, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage("Environment notification is disabled.");
                }
            }
        }

        if (!this._disableGDBCheck) {
            const paths = this.getGdbPaths();
            const disable_ntf = "Do not show this message again";
            const close = "Close";
            let selection;

            if (paths.length === 0) {
                selection = await vscode.window.showWarningMessage("gdb-oneapi not found.", disable_ntf, close);

            } else if (paths.length === 1) {
                selection = await vscode.window.showInformationMessage(`gdb-oneapi found at: ${paths[0]}`, disable_ntf, close);

            } else {
                selection = await vscode.window.showInformationMessage(`gdb-oneapi found at multiple locations:
                                                        \n${paths.map((path, index) => `${index + 1}. ${path}`).join("\n")}
                                                        \nThe first one will be used: ${paths[0]}`, { modal: true }, disable_ntf);
            }
            if (selection === disable_ntf) {
                const configuration = vscode.workspace.getConfiguration("intelOneAPI.debug");

                configuration.update("DISABLE_ONEAPI_GDB_PATH_NOTIFICATION", true, vscode.ConfigurationTarget.Global)
                    .then(() => vscode.window.showInformationMessage("gdb-oneapi check is disabled."),
                        (error) => vscode.window.showErrorMessage(`Error disabling gdb-oneapi check notification: : ${error}`));
            }
        }
    }

    private async checkEnvConfigurator(): Promise<boolean> {
        const tsExtension = vscode.extensions.getExtension("intel-corporation.oneapi-environment-configurator");
        if (!tsExtension) {
            const selection = await vscode.window.showInformationMessage("Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.", "Environment Configurator for Intel oneAPI Toolkits");
            if (selection === "Environment Configurator for Intel oneAPI Toolkits") {
                await vscode.commands.executeCommand("workbench.extensions.installExtension", "intel-corporation.oneapi-environment-configurator");
            }
            return false;
        }
        return true;
    }

    private getGdbPaths(): string[] {
        try {
            const command = process.platform === "win32" ? "where" : "which -a ";
            const result = execSync(`${command} gdb-oneapi`, { encoding: "utf8" });
            return result.split("\n").filter(path => path);
        } catch (error) {
            return [];
        }
    }

    private async checkLaunchItem(listItems: { label: string }[], newItem: any): Promise<boolean> {
        if (listItems.length === 0) return true; // for tests

        const existItem = listItems.find(item => item.label === newItem.label);
        if (existItem) {
            const selection = await vscode.window.showQuickPick(["Cancel", "Rename configuration"], {
                placeHolder: "A debug launch configuration already exists with this name. Do you want to rename this configuration or cancel?"
            });

            if (!selection || selection === "Cancel") return false;

            const inputName = await vscode.window.showInputBox({
                placeHolder: "Please provide new configuration name:"
            });

            if (!inputName) return false;
            newItem.name = inputName;
        }
        return true;
    }

    private async addTasksToLaunchConfig(newDebugConfig: any): Promise<boolean> {
        const taskConfig = vscode.workspace.getConfiguration("tasks");
        const existTasks = taskConfig.tasks;
        const tasksList: string[] = [];

        for (const task in existTasks) {
            tasksList.push(existTasks[task].label);
        }
        tasksList.push("Skip adding preLaunchTask");
        const preLaunchTaskOptions: vscode.InputBoxOptions = {
            placeHolder: "Choose a task to run before starting the debugger"
        };
        const preLaunchTask = await vscode.window.showQuickPick(tasksList, preLaunchTaskOptions);

        if (preLaunchTask && preLaunchTask !== "Skip adding preLaunchTask") {
            newDebugConfig.preLaunchTask = preLaunchTask;
        }
        tasksList.pop();
        const postDebugTaskOptions: vscode.InputBoxOptions = {
            placeHolder: "Choose a task to run after starting the debugger"
        };

        tasksList.push("Skip adding postDebugTask");
        const postDebugTask = await vscode.window.showQuickPick(tasksList, postDebugTaskOptions);

        if (postDebugTask && postDebugTask !== "Skip adding postDebugTask") {
            newDebugConfig.postDebugTask = postDebugTask;
        }
        return true;
    }

    private async findExecutables(projectRootDir: string): Promise<string[]> {
        try {
            const cmd = process.platform === "win32"
                ? `pwsh -command "Get-ChildItem '${projectRootDir}' -recurse -Depth 3 -include '*.exe' -Name | ForEach-Object -Process {$execPath='${projectRootDir}' +'\\'+ $_;echo $execPath}"`
                : `find ${projectRootDir} -maxdepth 3 -exec file {} \\; | grep -i elf | cut -f1 -d ':'`;
            const pathsToExecutables = execSync(cmd).toString().split("\n").filter(path => path);
            return pathsToExecutables.map(onePath => posix.normalize(onePath.replace("\r", "")).split(/[\\/]/g).join(posix.sep));
        } catch (error) {
            console.error(error);
            return [];
        }
    }
}

async function getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    if (vscode.workspace.workspaceFolders?.length === 1) {
        return vscode.workspace.workspaceFolders[0];
    }
    const selection = await vscode.window.showWorkspaceFolderPick();

    if (!selection) {
        vscode.window.showErrorMessage("Cannot find the working directory.", { modal: true });
        vscode.window.showInformationMessage("Please add one or more working directories and try again.");
        return undefined; // for unit tests
    }
    return selection;
}
 