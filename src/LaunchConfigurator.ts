/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

'use strict';
import * as vscode from 'vscode';

interface TaskConfigValue{
    label: string;
    command: string;
    type: string;
    options: {
        cwd: string;
    };
}

const debugConfig = {
    name: '(gdb-oneapi) ${workspaceFolderBasename} Launch',
    type: 'cppdbg',
    request: 'launch',
    preLaunchTask: '',
    postDebugTask: '',
    program: '',
    args: [],
    stopAtEntry: false,
    cwd: '${workspaceFolder}',
    environment: [],
    externalConsole: false,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MIMode: 'gdb',
    miDebuggerPath: 'gdb-oneapi',
    setupCommands:
        [
            {
                description: 'Enable pretty-printing for gdb',
                text: '-enable-pretty-printing',
                ignoreFailures: true
            },
            {
                description: 'Disable target async',
                text: 'set target-async off',
                ignoreFailures: true
            }
        ]
};
export class LaunchConfigurator {

    async makeTasksFile(): Promise<boolean> {
        return true;
    }

    async makeLaunchFile(): Promise<boolean> {
       return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async checkTaskItem(listItems: any, newItem: TaskConfigValue): Promise<boolean> {
        if (listItems.length === 0) {
            return true; // for tests
        }
        restartcheck:
        for (const existItem in listItems) {
            const dialogOptions: string[] = [`Skip target`, `Rename task`];
            if (newItem.label === listItems[existItem].label) {
                const options: vscode.InputBoxOptions = {
                    placeHolder: `Task for target "${newItem.label}" already exist. Do you want to rename current task or skip target?`
                };
                const selection = await vscode.window.showQuickPick(dialogOptions, options);
                if (!selection || selection === `Skip target`) {
                    return false;
                }
                else {
                    const inputBoxText: vscode.InputBoxOptions = {
                        placeHolder: "Please provide new task name:"
                    };
                    const inputLabel = await vscode.window.showInputBox(inputBoxText);
                    if (inputLabel) {
                        newItem.label = inputLabel;
                    }
                    continue restartcheck;
                }
            }
        }
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async checkLaunchItem(listItems: any, newItem: any): Promise<boolean> {
        if (listItems.length === 0) {
            return true; // for tests
        }
        restartcheck:
        for (const existItem in listItems) {
            const dialogOptions: string[] = [`Skip target`, `Rename configuration`];
            if (newItem.name === listItems[existItem].name) {
                const options: vscode.InputBoxOptions = {
                    placeHolder: `Launch configuration for target "${newItem.name}" already exist. Do you want to rename current configuration or skip target?`
                };
                const selection = await vscode.window.showQuickPick(dialogOptions, options);
                if (!selection || selection === `Skip target `) {
                    return false;
                }
                else {
                    const inputBoxText: vscode.InputBoxOptions = {
                        placeHolder: "Please provide new configuration name:"
                    };
                    const inputName = await vscode.window.showInputBox(inputBoxText);
                    newItem.name = inputName;
                    continue restartcheck;
                }
            }
        }
        return true;
    }

    private async addTasksToLaunchConfig(): Promise<boolean> {
        const taskConfig = vscode.workspace.getConfiguration('tasks');
        const existTasks = taskConfig['tasks'];
        const tasksList: string[] = [];
        for (const task in existTasks) {
            tasksList.push(existTasks[task].label);
        }
        tasksList.push('Skip adding preLaunchTask');
        const preLaunchTaskOptions: vscode.InputBoxOptions = {
            placeHolder: `Choose task for adding to preLaunchTask`
        };
        const preLaunchTask = await vscode.window.showQuickPick(tasksList, preLaunchTaskOptions);
        if (preLaunchTask && preLaunchTask !== 'Skip adding preLaunchTask') {
            debugConfig.preLaunchTask = preLaunchTask;
        }
        tasksList.pop();
        const postDebugTaskOptions: vscode.InputBoxOptions = {
            placeHolder: `Choose task for adding to postDebugTask`
        };
        tasksList.push('Skip adding postDebugTask');
        const postDebugTask = await vscode.window.showQuickPick(tasksList, postDebugTaskOptions);
        if (postDebugTask && postDebugTask !== 'Skip adding postDebugTask') {
            debugConfig.postDebugTask = postDebugTask;
        }
        return true;
    }
}

async function getworkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    if (vscode.workspace.workspaceFolders?.length === 1) {
        return vscode.workspace.workspaceFolders[0];
    }
    const selection = await vscode.window.showWorkspaceFolderPick();
    if (!selection) {
        vscode.window.showErrorMessage("Cannot find the working directory!", { modal: true });
        vscode.window.showInformationMessage("Please add one or more working directories and try again.");
        return undefined; // for unit tests
    }
    return selection;
}
