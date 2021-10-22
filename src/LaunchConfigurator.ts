/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

'use strict';
import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { posix, join, parse, normalize } from 'path';
import { existsSync } from 'fs';

const debugConfig = {
  comments: [
    "Full launch.json configuration details can be found here:",
    "https://code.visualstudio.com/docs/cpp/launch-json-reference"
],
  name: '(gdb-oneapi) ${workspaceFolderBasename} Launch',
  type: 'cppdbg',
  request: 'launch',
  preLaunchTask: '',
  postDebugTask: '',
  program: '',
  args: [] as string[],
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

  async makeLaunchFile(): Promise<boolean> {
    if (process.platform === 'win32') {
      vscode.window.showInformationMessage('This function cannot be used for Windows as a target platform. Generating configurations for debugging is only possible for use on Linux.', { modal: true });
      return false;
    }
    const workspaceFolder = await getworkspaceFolder();
    if (!workspaceFolder) {
      return false; // for unit tests
    }
    const projectRootDir = `${workspaceFolder?.uri.fsPath}`;
    let buildSystem = '';
    let makeFileName = undefined;
    if (existsSync(`${projectRootDir}/Makefile`)) {
      makeFileName = 'Makefile';
    } else if (existsSync(`${projectRootDir}/makefile`)) {
      makeFileName = 'makefile';
    }
    if (makeFileName !== undefined) {
      buildSystem = 'make';
    }
    if (existsSync(`${projectRootDir}/CMakeLists.txt`)) {
      buildSystem = 'cmake';
    }
    if (buildSystem === '') {
      vscode.window.showErrorMessage('Generating launch configurations failed. The project does not contain CMakeLists.txt or MakeFile.', { modal: true });
      return false;
    }
    let execFiles: string[] = [];
    let execFile;
    switch (buildSystem) {
      case 'make': {
        execFiles = await this.findExecutables(projectRootDir);
        break;
      }
      case 'cmake': {
        execFiles = await this.findExecutables(projectRootDir);
        if (execFiles.length === 0) {
          const execNames = await this.getExecNameFromCmake(projectRootDir);
          execNames.forEach(async (name: string) => {
            execFiles.push(join(`${projectRootDir}`, 'build', 'src', name));
          });
          if (execFiles.length !== 0) {
            vscode.window.showInformationMessage('Could not find executable files.\nThe name of the executable will be taken from CMakeLists.txt, and the executable is expected to be located in /build/src.');
          }
        }

        break;
      }
      default: {
        break;
      }
    }
    execFiles.push('Leave it empty');
    execFiles.push('Provide path to the executable file manually');
    let isContinue = true;
    const options: vscode.InputBoxOptions = {
      placeHolder: 'Select the executable you want to debug. Press ESC to exit or if done creating debug config.'
    };
    do {
      let selection = await vscode.window.showQuickPick(execFiles, options);
      if (!selection) {
        isContinue = false;
        break;
      }
      if (selection === 'Leave it empty') {
        selection = '';
        await vscode.window.showInformationMessage('Note: Launch template cannot be launched immediately after creation.\nPlease edit the launch.json file according to your needs before run.', { modal: true });
      }
      if (selection === 'Provide path to the executable file manually') {
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false
        };
        const pathToExecFile = await vscode.window.showOpenDialog(options);
        if (pathToExecFile && pathToExecFile[0]) {
          execFile = pathToExecFile[0].fsPath;
        } else {
          await vscode.window.showErrorMessage('Path to the executable file invalid.\nPlease check path and name and try again.', { modal: true });
          return false;
        }
      } else {
        execFile = selection;
      }

      const stopAtEntrySelection = await vscode.window.showQuickPick(['yes', 'no'], {
        placeHolder: 'Automatically break on main'
      });

      if (!stopAtEntrySelection) {
        isContinue = false;
        break;
      }

      let argument: string | undefined;
      const args = [];

      do {
        argument = await vscode.window.showInputBox({
          placeHolder: 'Argument',
          title: 'Type new command-line argument or press ENTER with empty string to skip'
        });
        if (argument?.trim().length) {
          args.push(argument);
        }
      } while (argument?.trim().length);

      const launchConfig = vscode.workspace.getConfiguration('launch');
      const configurations = launchConfig.configurations;

      debugConfig.stopAtEntry = stopAtEntrySelection === 'yes' ? true : false;
      debugConfig.args = [...args];
      debugConfig.name = selection === ''
        ? 'Launch_template'
        : `(gdb-oneapi) ${parse(execFile).base} Launch`;
      debugConfig.program = `${execFile}`.split(/[\\/]/g).join(posix.sep);
      await this.addTasksToLaunchConfig();
      const isUniq: boolean = await this.checkLaunchItem(configurations, debugConfig);
      if (isUniq) {
        configurations.push(debugConfig);
        launchConfig.update('configurations', configurations, false);
        vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program}" was added`);
      } else {
        vscode.window.showInformationMessage(`Launch configuration "${debugConfig.name}" for "${debugConfig.program}" was skipped as duplicate`);
        return false;
      }
    } while (isContinue);
    return true;
  }
  async checkGdb(): Promise<void> {
    if (!process.env.SETVARS_COMPLETED) {
      if (this.checkEnvConfigurator()) {
        const default_env = "default environment";
        const custom_env = "custom environment using SETVARS_CONFIG";
        const selection = await vscode.window.showInformationMessage(`oneAPI environment is not configured.\
         Configure your development environment using "Environment Configurator for Intel oneAPI Toolkits".`,
          default_env, custom_env);
        if (selection === default_env) {
          await vscode.commands.executeCommand('intel-corporation.oneapi-environment-configurator.initializeEnvironment');
        }
        if (selection === custom_env) {
          await vscode.commands.executeCommand('intel-corporation.oneapi-environment-configurator.initializeEnvironmentConfig');
        }
      }
    }
    if (!this.isGdbInPath()) {
      vscode.window.showInformationMessage(`Unable to locate the gdb-oneapi debugger in the PATH.\
        If you use setvars_config file make sure it includes a debugger`);
    }
  }
  private checkEnvConfigurator(): boolean {
    const tsExtension = vscode.extensions.getExtension('intel-corporation.oneapi-environment-configurator');
    if (!tsExtension) {
      const GoToInstall = 'Environment Configurator for Intel oneAPI Toolkits';
      vscode.window.showInformationMessage(`Please install the "Environment Configurator for Intel oneAPI Toolkits" to configured your development environment.`, GoToInstall)
        .then((selection) => {
          if (selection === GoToInstall) {
            vscode.commands.executeCommand('workbench.extensions.installExtension', 'intel-corporation.oneapi-environment-configurator');
          }
        });
      return false;
    }
    return true;
  }

  private isGdbInPath(): boolean {
    if (process.env.PATH) {
      const path = /oneAPI[\/\\]debugger[\/\\].+[\/\\]gdb[\/\\]intel64[\/\\]bin/gi;
      const index = process.env.PATH.search(path);
      if (index !== -1) {
        return true;
      }
    }
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async checkLaunchItem(listItems: any, newItem: any): Promise<boolean> {
    if (listItems.length === 0) {
      return true; // for tests
    }

    const existItem = listItems.find((item: { label: any; }) => item.label === newItem.label);
    const dialogOptions: string[] = ['Cancel', 'Rename configuration'];

    if (existItem) {
      const options: vscode.InputBoxOptions = {
        placeHolder: `A debug launch config already exists with this name. Do you want to rename this config or cancel?`
      };
      const selection = await vscode.window.showQuickPick(dialogOptions, options);
      if (!selection || selection === 'Cancel ') {
        return false;
      } else {
        const inputBoxText: vscode.InputBoxOptions = {
          placeHolder: 'Please provide new configuration name:'
        };
        const inputName = await vscode.window.showInputBox(inputBoxText);
        newItem.name = inputName;
      }
    }
    return true;
  }

  private async addTasksToLaunchConfig(): Promise<boolean> {
    const taskConfig = vscode.workspace.getConfiguration('tasks');
    const existTasks = taskConfig.tasks;
    const tasksList: string[] = [];
    for (const task in existTasks) {
      tasksList.push(existTasks[task].label);
    }
    tasksList.push('Skip adding preLaunchTask');
    const preLaunchTaskOptions: vscode.InputBoxOptions = {
      placeHolder: 'Choose a task to run before starting the debugger'
    };
    const preLaunchTask = await vscode.window.showQuickPick(tasksList, preLaunchTaskOptions);
    if (preLaunchTask && preLaunchTask !== 'Skip adding preLaunchTask') {
      debugConfig.preLaunchTask = preLaunchTask;
    }
    tasksList.pop();
    const postDebugTaskOptions: vscode.InputBoxOptions = {
      placeHolder: 'Choose a task to run after starting the debugger'
    };
    tasksList.push('Skip adding postDebugTask');
    const postDebugTask = await vscode.window.showQuickPick(tasksList, postDebugTaskOptions);
    if (postDebugTask && postDebugTask !== 'Skip adding postDebugTask') {
      debugConfig.postDebugTask = postDebugTask;
    }
    return true;
  }

  private async findExecutables(projectRootDir: string): Promise<string[]> {
    try {
      const cmd = process.platform === 'win32'
        ? `pwsh -command "Get-ChildItem '${projectRootDir}' -recurse -Depth 3 -include '*.exe' -Name | ForEach-Object -Process {$execPath='${projectRootDir}' +'\\'+ $_;echo $execPath}"`
        : `find ${projectRootDir} -maxdepth 3 -exec file {} \\; | grep -i elf | cut -f1 -d ':'`;
      const pathsToExecutables = execSync(cmd).toString().split('\n');
      pathsToExecutables.pop();
      pathsToExecutables.forEach(async function (onePath, index, execList) {
        // This is the only known way to replace \\ with /
        execList[index] = posix.normalize(onePath.replace('\r', '')).split(/[\\/]/g).join(posix.sep);
      });
      return pathsToExecutables;
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  private async getExecNameFromCmake(projectRootDir: string): Promise<string[]> {
    try {
      let execNames: string[] = [];
      const cmd = process.platform === 'win32'
        ? `where /r ${projectRootDir} CMakeLists.txt`
        : `find ${projectRootDir} -name 'CMakeLists.txt'`;
      const pathsToCmakeLists = execSync(cmd).toString().split('\n');
      pathsToCmakeLists.pop();
      pathsToCmakeLists.forEach(async (onePath) => {
        const normalizedPath = normalize(onePath.replace('\r', '')).split(/[\\/]/g).join(posix.sep);
        const cmd = process.platform === 'win32'
          ? `pwsh -Command "$execNames=(gc ${normalizedPath}) | Select-String -Pattern '\\s*add_executable\\s*\\(\\s*(\\w*)' ; $execNames.Matches | ForEach-Object -Process {echo $_.Groups[1].Value} | Select-Object -Unique | ? {$_.trim() -ne '' } "`
          : `awk '/^ *add_executable *\\( *[^$]/' ${normalizedPath} | sed -e's/add_executable *(/ /; s/\\r/ /' | awk '{print $1}' | uniq`;
        execNames = execNames.concat(execSync(cmd, { cwd: projectRootDir }).toString().split('\n'));
        execNames.pop();
        execNames.forEach(async function (oneExec, index, execList) {
          execList[index] = normalize(oneExec.replace('\r', '')).split(/[\\/]/g).join(posix.sep);
        });
      });

      return execNames;
    } catch (err) {
      console.error(err);
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
    vscode.window.showErrorMessage("Cannot find the working directory!", { modal: true });
    vscode.window.showInformationMessage("Please add one or more working directories and try again.");
    return undefined; // for unit tests
  }
  return selection;
}
