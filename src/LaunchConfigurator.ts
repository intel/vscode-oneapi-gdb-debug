/**
 * Copyright (c) 2021-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

"use strict";
import * as vscode from "vscode";
import { execSync } from "child_process";
import { posix, parse } from "path";

const debugConfig = {
    comments: [
        "Full launch.json configuration details can be found here:",
        "https://code.visualstudio.com/docs/cpp/launch-json-reference"
    ],
    name: "(gdb-oneapi) ${workspaceFolderBasename} Launch",
    type: "cppdbg",
    request: "launch",
    preLaunchTask: "",
    postDebugTask: "",
    program: "",
    args: [] as string[],
    stopAtEntry: false,
    cwd: "${workspaceFolder}",
    environment: [
        {
            name: "ZET_ENABLE_PROGRAM_DEBUGGING",
            value: "1"
        },
        {
            name: "IGC_EnableGTLocationDebugging",
            value: "1"
        }
    ],
    externalConsole: false,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MIMode: "gdb",
    miDebuggerPath: "gdb-oneapi",
    setupCommands:
        [
            {
                description: "Disable target async",
                text: "set target-async off",
                ignoreFailures: true
            },
            {
                description: "Do not display function arguments when printing a stack frame",
                text: "set print frame-arguments none",
                ignoreFailures: true
            }
        ]
};

export class LaunchConfigurator {
    private _disableGDBCheck: boolean | undefined;
    private _disableENVCheck: boolean | undefined;

    public set disableGDBCheck(flag: boolean | undefined) {
        this._disableGDBCheck = false;
        if (flag !== undefined) {
            this._disableGDBCheck = flag;
        }
    }

    public set disableENVCheck(flag: boolean | undefined) {
        this._disableENVCheck = false;
        if (flag !== undefined) {
            this._disableENVCheck = flag;
        }
    }
    async makeLaunchFile(): Promise<boolean> {
        if (process.platform === "win32") {
            vscode.window.showInformationMessage("This function cannot be used for Windows as a target platform. Generating configurations for debugging is only possible for use on Linux.", { modal: true });
            return false;
        }
        const workspaceFolder = await getworkspaceFolder();

        if (!workspaceFolder) {
            return false; // for unit tests
        }
        const projectRootDir = `${workspaceFolder?.uri.fsPath}`;
        let execFiles: string[] = [];
        let execFile;

        execFiles = await this.findExecutables(projectRootDir);
        execFiles.push("Leave it empty");
        execFiles.push("Provide path to the executable file manually");
        let isContinue = true;
        const options: vscode.InputBoxOptions = {
            placeHolder: "Select the executable you want to debug. Press ESC to exit or if done creating debug configuration."
        };

        do {
            let selection = await vscode.window.showQuickPick(execFiles, options);

            if (!selection) {
                isContinue = false;
                break;
            }
            if (selection === "Leave it empty") {
                selection = "";
                await vscode.window.showInformationMessage("Note: Launch template cannot be launched immediately after creation.\nPlease edit the launch.json file according to your needs before running.", { modal: true });
            }
            if (selection === "Provide path to the executable file manually") {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false
                };
                const pathToExecFile = await vscode.window.showOpenDialog(options);

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

            if (!stopAtEntrySelection) {
                isContinue = false;
                break;
            }

            let argument: string | undefined;
            const args = [];

            do {
                argument = await vscode.window.showInputBox({
                    placeHolder: "Argument",
                    title: "Type new command-line argument or press ENTER with empty string to skip"
                });
                if (argument?.trim().length) {
                    args.push(argument);
                }
            } while (argument?.trim().length);

            const launchConfig = vscode.workspace.getConfiguration("launch");
            const configurations = launchConfig.configurations;

            debugConfig.stopAtEntry = stopAtEntrySelection === "yes" ? true : false;
            debugConfig.args = [...args];
            debugConfig.name = selection === ""
                ? "Launch_template"
                : `(gdb-oneapi) ${parse(execFile).base} Launch`;
            debugConfig.program = `${execFile}`.split(/[\\/]/g).join(posix.sep);
            await this.addTasksToLaunchConfig();
            const isUniq: boolean = await this.checkLaunchItem(configurations, debugConfig);

            if (isUniq) {
                configurations.push(debugConfig);
                launchConfig.update("configurations", configurations, false);
                vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program || "empty path"}" was added`);
            } else {
                vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program || "empty path"}" was skipped as duplicate`);
                return false;
            }
        } while (isContinue);
        return true;
    }
    async checkLaunchConfig(): Promise<void> {
        if (!await this.isThereDebugConfig()) {
            const yes = "Yes";
            const no = "No";
            const selection = await vscode.window.showInformationMessage("Unable to identify oneAPI C++ launch configuration in your launch.json file.\
        Would you like to create a debug launch configuration now?", yes, no);
            if (selection === yes) {
                await vscode.commands.executeCommand("intelOneAPI.launchConfigurator.generateLaunchJson");
                return;
            }
            if (selection === no) {
                return;
            }
        }
    }

    async isThereDebugConfig(): Promise<boolean> {
        const launchConfig = vscode.workspace.getConfiguration("launch");
        const configs = launchConfig.configurations;

        for (const cfg of configs) {
            if (cfg.type === "cppdbg" && cfg.miDebuggerPath === "gdb-oneapi") {
                return true;
            }
        }
        return false;
    }

    async checkGdb(): Promise<void> {
        if (!this._disableENVCheck && !process.env.SETVARS_COMPLETED ) {
            if (await this.checkEnvConfigurator()) {
                const default_env = "Default environment";
                const custom_env = "Using SETVARS_CONFIG";
                const disable_ntf = "Do not show this message again";
                const selection = await vscode.window.showInformationMessage("oneAPI environment is not configured.\
          Configure your development environment using \"Environment Configurator for Intel oneAPI Toolkits\".",
                default_env, custom_env, disable_ntf);
 
                if (selection === default_env) {
                    await vscode.commands.executeCommand("intel-corporation.oneapi-environment-configurator.initializeEnvironment");
                }
                if (selection === custom_env) {
                    await vscode.commands.executeCommand("intel-corporation.oneapi-environment-configurator.initializeEnvironmentConfig");
                }
                if (selection === disable_ntf) {
                    const configuration = vscode.workspace.getConfiguration("intelOneAPI.debug");

                    configuration.update("DISABLE_ONEAPI_ENV_NOTIFICATION", true, vscode.ConfigurationTarget.Global) 
                        .then(() => vscode.window.showInformationMessage("Environment notification is disabled."),
                            (error) => vscode.window.showErrorMessage(`Error disabling oneAPI environment extension notification: ${error}`));
                }
            }
        }
        if (!this._disableGDBCheck) {
            const paths = this.getGdbPaths();
            const disable_ntf = "Do not show this message again";
            const close = "Close";
            let selection; 

            if (paths.length === 0) {
                selection = await vscode.window.showWarningMessage("gdb-oneapi not found.",disable_ntf,close);

            } else if (paths.length === 1) {
                selection = await vscode.window.showInformationMessage(`gdb-oneapi found at: ${paths[0]}`,disable_ntf,close);

            } else {
                selection = await vscode.window.showInformationMessage(`gdb-oneapi found at multiple locations:
                                                        \n${paths.map((path, index) => `${index + 1}. ${path}`).join("\n")}
                                                        \nThe first one will be used: ${paths[0]}`, { modal: true },disable_ntf);
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
            const GoToInstall = "Environment Configurator for Intel oneAPI Toolkits";
            const selection = await vscode.window.showInformationMessage("Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.", GoToInstall);

            if (selection === GoToInstall) {
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

            // Split the result by newline to get an array of paths
            const paths = result.split("\n");

            // Remove any empty strings resulting from trailing newlines
            return paths.filter(path => path);
        } catch (error) {
            return [];
        }
    }
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private async checkLaunchItem(listItems: { label: string }[], newItem: any): Promise<boolean> {
        if (listItems.length === 0) {
            return true; // for tests
        }
        const existItem = listItems.find((item: { label: string }) => item.label === newItem.label);
        const dialogOptions: string[] = ["Cancel", "Rename configuration"];

        if (existItem) {
            const options: vscode.InputBoxOptions = {
                placeHolder: "A debug launch configuration already exists with this name. Do you want to rename this configuration or cancel?"
            };
            const selection = await vscode.window.showQuickPick(dialogOptions, options);

            if (!selection || selection === "Cancel") {
                return false;
            } else {
                const inputBoxText: vscode.InputBoxOptions = {
                    placeHolder: "Please provide new configuration name:"
                };
                const inputName = await vscode.window.showInputBox(inputBoxText);

                if (!inputName) {
                    return false;
                }
                newItem.name = inputName;
            }
        }
        return true;
    }

    private async addTasksToLaunchConfig(): Promise<boolean> {
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
            debugConfig.preLaunchTask = preLaunchTask;
        }
        tasksList.pop();
        const postDebugTaskOptions: vscode.InputBoxOptions = {
            placeHolder: "Choose a task to run after starting the debugger"
        };

        tasksList.push("Skip adding postDebugTask");
        const postDebugTask = await vscode.window.showQuickPick(tasksList, postDebugTaskOptions);

        if (postDebugTask && postDebugTask !== "Skip adding postDebugTask") {
            debugConfig.postDebugTask = postDebugTask;
        }
        return true;
    }

    private async findExecutables(projectRootDir: string): Promise<string[]> {
        try {
            const cmd = process.platform === "win32"
                ? `pwsh -command "Get-ChildItem '${projectRootDir}' -recurse -Depth 3 -include '*.exe' -Name | ForEach-Object -Process {$execPath='${projectRootDir}' +'\\'+ $_;echo $execPath}"`
                : `find ${projectRootDir} -maxdepth 3 -exec file {} \\; | grep -i elf | cut -f1 -d ':'`;
            const pathsToExecutables = execSync(cmd).toString().split("\n");

            pathsToExecutables.pop();
            pathsToExecutables.forEach(async function(onePath, index, execList) {
                // This is the only known way to replace \\ with /
                execList[index] = posix.normalize(onePath.replace("\r", "")).split(/[\\/]/g).join(posix.sep);
            });
            return pathsToExecutables;
        } catch (err) {
            console.log(err);
            return [];
        }
    }
}

async function getworkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
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
