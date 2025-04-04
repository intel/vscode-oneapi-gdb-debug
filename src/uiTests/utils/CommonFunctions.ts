/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ActivityBar, By, DebugConsoleView, DebugView, ExtensionsViewSection, InputBox, Key, Notification, NotificationType, QuickOpenBox, QuickPickItem, Setting, SettingsEditor, SideBarView, StatusBar, TerminalView, TextEditor, VSBrowser, ViewControl, WebDriver, WebElement, Workbench } from "vscode-extension-tester";
import { VSCODE_PATH, TASKS_JSON_PATH, DEFAULT_BREAKPOINT } from "./Consts";
import { CustomExtensionSection, DebugPane, ExtensionSection, FsOptions, OneApiDebugPaneFrameTitle, TestOptions, VsCodeTask } from "./Types";
import { Breakpoint, ConditionalBreakpoint } from "./Debugging/Types";
import { RemoveAllBreakpoints } from "./Debugging/Debugging";
import { LoggerAggregator as logger } from "./Logger";
import { execSync } from "child_process";
import { assert } from "chai";
import { FileExistsAsync, LoadAndParseJsonFile, MkdirAsync, ReadFileAsync, WriteFileAsync } from "./FileSystem";

type ViewControlName = "Run" | "Extensions";
type SetInputTextOptions = {
    input?: QuickOpenBox | InputBox | undefined;
    confirmCommand?: boolean;
};

/**
 * Waits specified number of mulliseconds. 
 * @param duration The number of milliseconds to wait.
 */
export async function Wait(duration: number): Promise<void> {
    logger.Info(`Wait ${duration} milliseconds`);
    await new Promise(f => setTimeout(f, duration));
}

/**
 * 
 * @param fn The function to retry.
 * @param timeout Timeout in milliseconds.
 * @param throwOnTimeout Throws an exception on `timeout` when set to true. Default is `false`.
 * @returns Result of `fn` function.
 */
export async function Retry<TResult>(fn: () => TResult, timeout: number, throwOnTimeout: boolean = false): Promise<TResult | undefined> {
    const startTime = Date.now();
    let currentTime = startTime;
    let result: TResult | undefined;
    let eleapsed = currentTime - startTime;
    let iteration = 1;

    while (eleapsed < timeout) {
        logger.Info(`Retry iteration ${iteration} | Elapsed ${eleapsed} ms`);
        eleapsed = currentTime - startTime;
        try {
            result = await fn();
            break;
        } catch (e) {
            logger.Error(e);
            iteration++;
            currentTime = Date.now();
            eleapsed = currentTime - startTime;
            if ((eleapsed >= timeout) && throwOnTimeout) {
                throw e;
            }
        }
    }
    logger.Info(`Elapsed ${eleapsed} ms`);
    return result;
}

/**
 * Gets section of 'Extensions' view.
 * @param sectionName Name of the section to find.
 * @returns Section of 'Extensions' view.
 */
export async function GetExtensionsSection(sectionName: ExtensionSection): Promise<ExtensionsViewSection> {
    const extensionsViewControl = await GetViewControl("Extensions");
    const extensionsSideBarView = await extensionsViewControl?.openView() as SideBarView;
    const extensionsViewContent = extensionsSideBarView.getContent();
    const availableSections = await extensionsViewContent.getSections();
    const customSectionName: string | undefined = (sectionName as CustomExtensionSection).customName;
    let sectionToReturn;

    for await (const section of availableSections) {
        const title = await section.getTitle();

        try {
            await (section as ExtensionsViewSection).clearSearch();
        } catch (e) {
            logger.Error(e);
        }

        logger.Info(title);
        if (customSectionName ? title === customSectionName : title === sectionName) {
            await Retry(async() => await (section as ExtensionsViewSection).expand(), 5000);
            sectionToReturn = section;
        } else {
            await Retry(async() => await (section as ExtensionsViewSection).collapse(), 5000);
        }
    }
    return sectionToReturn as ExtensionsViewSection;
}

/**
 * Stops debugging session and kills all opened terminals.
 */
export async function CleanUp(): Promise<void> {
    await StopDebugging(false);
    await SetInputText("> Terminal: Kill All Terminals");
    await SetInputText("> Developer: Reload WIndow");
    await Wait(3 * 1000);
}

/**
 * Stops debugging session.
 * @param throwOnException Default is `true`. When set to `true`, throws an exception when the button is not found.
 */
export async function StopDebugging(throwOnException: boolean = true): Promise<void> {
    try {
        logger.Info("Stop debugging");
        const driver = new Workbench().getDriver();
        const stopButton = await driver.findElement(By.css("a.action-label.codicon.codicon-debug-stop"));

        await stopButton.click();
    } catch (e) {
        logger.Error(e);
        if (throwOnException) {throw e;}
    }
}

/**
 * Sets passed `command` inside the Input box and performs it.
 * @param command Command to be set.
 * @param input Input to set the command in.
 * @param confirmCommand Confirms / enters passed command if set to `true`. Default is `true`.
 * @returns Input box handle.
 */
export async function SetInputText(command: string, options?: SetInputTextOptions): Promise<QuickOpenBox | InputBox> {
    const confirmCommand = options?.confirmCommand ?? true;
    const input = options?.input ?? await new Workbench().openCommandPrompt();

    logger.Info(`Set command palette text to '${command}'`);
    await input.setText(command);
    await Wait(1 * 1000);
    if (confirmCommand) {
        await input.sendKeys(Key.ENTER);
    }
    return input;
}

/**
 * Gets 'Run and Debug' view
 * @returns DebugView
 */
export async function GetDebugView(): Promise<DebugView> {
    const runViewControl = await GetViewControl("Run");
    const debugView = await runViewControl?.openView() as DebugView;

    return debugView;
}

/**
 * Uninstalls given extension.
 * @param extensionName Extension name to uninstall
 */
export async function UninstallExtensionViaMarketplace(extensionName: string): Promise<void> {
    let extensionsView: ExtensionsViewSection | undefined;

    logger.Info(`Uninstall '${extensionName}' extension`);
    try {
        extensionsView = await GetExtensionsSection("Installed");

        await extensionsView.clearSearch();
        const extension = await extensionsView.findItem(extensionName);
        const menu = await extension?.manage();

        await Wait(1000);
        await menu?.select("Uninstall");
        await Wait(2 * 1000);
        await extensionsView.clearSearch();
    } catch (e) {
        logger.Info(`Extension '${extensionName}' is not installed. SKIP`);
        logger.Error(e);
        await Wait(2 * 1000);
        return;
    }
}

/**
 * Gets all notifications of given type.
 * @param type Type of the notification.
 * @returns Array of notifications of given.
 */
export async function GetNotifications(type: NotificationType): Promise<Notification[]> {
    logger.Info(`Get notifications of type '${type}'`);
    const workbench = new Workbench();
    const center = await workbench.openNotificationsCenter();
    const notifications = await center.getNotifications(type);

    return notifications;
}

/**
 * Gets all actions related to given notifiaction object.
 * @param notification Notification to get actions from
 * @returns Actions as an array of WebElements.
 */
export async function GetNotificationActions(notification: Notification): Promise<WebElement[]> {
    return await notification.findElement(By.className("notification-list-item-buttons-container")).findElements(By.className("monaco-button monaco-text-button"));
}

/**
 * Performs action on fiven notification.
 * @param notification Notification to perform action on.
 * @param actionToTake Action to perform.
 */
export async function TakeNotificationAction(notification: Notification, actionToTake: string): Promise<void> {
    const actions = await GetNotificationActions(notification);

    for (const action of actions) {
        const title = await action.getText();

        if (title === actionToTake) {
            await action.click();
            return;
        }
    }

    throw new Error(`Can't find '${actionToTake}' action`);
}

/**
 * 
 * @param body Function to execute inside given iframe.
 * @param frame Frame to switch to
 * @returns Result of given Function 
 */
export async function ExecuteInIFrame<TResult>(body: (driver: WebDriver) => Promise<TResult>, frame?: number | WebElement | undefined): Promise<TResult> {
    const driver = VSBrowser.instance.driver;
    let result;

    if (!frame) {
        frame = await driver.findElement(By.css("iframe"));
    }
    await driver.switchTo().frame(frame);
    
    try {
        result = await body(driver);
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await driver.switchTo().parentFrame();
    }

    return result;
}

/**
 * Prepares environment and launches debugging session.
 */
export async function LaunchSequence(options: FsOptions): Promise<void> {
    await CreateCCppPropertiesFile(options);
    await InitDefaultEnvironment();
    await AddTask({
        "label": "preTask",
        "command": "source /opt/intel/oneapi/setvars.sh --force && mkdir -p build && cd build && cmake .. && make && echo simple preTask",
        "type": "shell",
        "problemMatcher": []
    }, options);
    await AddTask({
        "label": "postTask",
        "command": "echo simple postTask",
        "type": "shell"
    }, options);
    await RunTask("preTask", "[100%] Built target array-transform");
    await RemoveAllBreakpoints();
    await SetBreakpoint(DEFAULT_BREAKPOINT);
    await StartDebugging(options);
    await CheckIfBreakpointHasBeenHit(DEFAULT_BREAKPOINT);
    await CheckIfTaskWasExecuted("preTask", "simple preTask");
}

/**
 * Selects given quick pick.
 * @param indexOrText Index (number) or text (string) of the item to search by.
 * @param input Input box to perform selecting on.
 * @returns Input box handle.
 */
export async function SelectQuickPick(indexOrText: string | number, input: QuickOpenBox | InputBox): Promise<QuickOpenBox | InputBox> {
    logger.Info(`Select '${indexOrText}' quick pick`);
    await input.selectQuickPick(indexOrText);

    return input;
}

/**
 * Checks if task was executed.
 * @param taskName Task name to check.
 * @param expectedOutput Expected task output.
 * @returns True if task was executed. False otherwise. 
 */
export async function CheckIfTaskWasExecuted(taskName: string, expectedOutput: string): Promise<boolean> {
    await CloseAllNotifications();
    const innerText = await GetTerminalOutput(taskName);
    const result = innerText?.includes(expectedOutput);

    assert.isTrue(result, `Task '${taskName}' was not executed. Actual '${result}' | Expected: 'true'`);
    logger.Pass(`Task '${taskName}' was executed. Actual '${result}' | Expected: 'true'`);
    return result as boolean;
}

/**
 * Closes all opened notifications.
 */
export async function CloseAllNotifications(): Promise<void> {
    try {
        await SetInputText("> Notifications: Clear All Notifications");
    } catch (e) {
        logger.Error(e);
    }
}

/**
 * Sets a breakpoint.
 * @param param0 Breakpoint to set.
 * @returns True if breakpoint has been set.
 */
export async function SetBreakpoint({ fileName, lineNumber }: Breakpoint): Promise<boolean> {
    const input = await SetInputText("> Go to File...");

    await Wait(1 * 1000);
    await SetInputText(fileName, { input: input });
    logger.Info(`Open text editor with: ${fileName}`);

    await Wait(1 * 1000);
    logger.Info(`Go to line: ${lineNumber}`);
    await SetInputText(`:${lineNumber}`);
    await Wait(1 * 1000);
    await SetInputText("> Debug: Inline Breakpoint");
    const res = await CheckIfBreakpointHasBeenSet({ fileName, lineNumber });
    const bpSetOrRemoved = res ? "set" : "removed";

    logger.Info(`Breakpoint at line ${lineNumber} has been ${bpSetOrRemoved}`);
    return res;
}

/**
 * Starts debugging session.
 */
export async function StartDebugging(options: FsOptions): Promise<void> {
    const configurationName = await GenerateLaunchConfigurations(options);
    
    await SetInputText(`debug ${configurationName}`);
}

/**
 * Checks if breakpoint has been hit.
 * @param breakpoint Breakpoint to check.
 */
export async function CheckIfBreakpointHasBeenHit(breakpoint: Breakpoint | ConditionalBreakpoint): Promise<void> {
    const breakpointStr = `${breakpoint.fileName}:${breakpoint.lineNumber}`;
    const line = await Retry(async() => {
        await Wait(1000);
        const result = (await GetDebugConsoleOutput()).find(x => x.includes(breakpointStr));

        if (!result) {throw new Error();}
        return result;
    }, 60 * 1000);

    assert.exists(line, `Breakpoint ${breakpointStr} has not been hit`);
    logger.Pass(`Breakpoint '${breakpointStr}' has been hit.`);
}

/**
 * 
 * @param input Input to perform clear on.
 * @returns Input box handle.
 */
export async function ClearInputText(input: QuickOpenBox | InputBox): Promise<QuickOpenBox | InputBox> {
    try {
        logger.Info("Clear input box text");
        await input.clear();
    } catch (e) {
        logger.Error(e);
    }

    return input;
}

/**
 * Gets debug pane.
 * @param paneToFind Pane to find.
 * @returns Debug pane as WebElement.
 */
export async function GetDebugPane(paneToFind: DebugPane): Promise<WebElement | undefined> {
    const debugView = await GetDebugView();
    const debugPanes = await debugView.findElements(By.className("pane-header"));

    for (const pane of debugPanes) {
        const value = await pane.getAttribute("aria-label");

        if (value === paneToFind) {
            return pane;
        }
    }
}

/**
 * Gets terminal output.
 * @param terminalName Terminal name to get an output from.
 * @returns Teminal output as string
 */
export async function GetTerminalOutput(terminalName: string): Promise<string | undefined> {
    const input = await SetInputText("> Terminal: Switch Active Terminal");
    const qps = await input.getQuickPicks();

    for (const qp of qps) {
        const text = await qp.getText();

        if (text.includes(terminalName)) {
            await qp.select();
            break;
        }
    }

    const terminal = new TerminalView();

    logger.Info(`Get '${terminalName}' terminal text`);
    const innerText = await Retry(async() => await terminal.getText(), 5 * 1000);

    return innerText;
}

/**
 * Gets debug console output.
 * @returns Debug console output as array of strings.
 */
export async function GetDebugConsoleOutput(): Promise<string[]> {
    const lines = await Retry(async() => {
        await SetInputText("> Debug Console: Focus on Debug Console View");
        await Wait(2000);
        const view = new DebugConsoleView();

        if (!view) {throw new Error();}
        return (await view.getText()).split("\n");
    }, 60 * 1000);

    return lines ?? [];
}

/**
 * Checks if breakpoint has been set.
 * @param param0 Breakpoint to check if has been set.
 * @returns True if breakpoint has been set.
 */
export async function CheckIfBreakpointHasBeenSet({ fileName, lineNumber }: Breakpoint): Promise<boolean> {
    const breakpointsPaneHeader = await GetDebugPane("Breakpoints Section");
    const breakpointsPane = await breakpointsPaneHeader?.findElement(By.xpath("./../div[2]"));
    const breakpoints = await breakpointsPane?.findElements(By.className("monaco-list-row")) as WebElement[];
    const breakpointsParsed = await Promise.all(breakpoints?.map(async x => {
        return {
            Enabled: await x.getAttribute("aria-checked"),
            Details: await x.getAttribute("aria-label")
        };
    }));
    const matches = breakpointsParsed?.filter(x => Boolean(x.Enabled) && x.Details.includes(`${fileName} ${lineNumber}`));
    
    assert.notEqual(matches?.length, 0, `Breakpoint '${fileName}:${lineNumber}' has not been set.`);
    logger.Pass(`Breakpoint '${fileName}:${lineNumber}' has been set`);
    return matches?.length !== 0;
}

export async function InstallExtension(id: string, options: TestOptions) {
    const cmd = `--install-extension ${id}`;
    let output: string = "";

    if (options.remoteTests) {
        await (await options.ssh).execCommand(`/home/${options.remoteUser}/.vscode-server/cli/servers/*/server/bin/code-server ${cmd}`, {
            onStdout: (chunk) => output = chunk.toString(),
            onStderr: (chunk) => output = chunk.toString(),
        });
    } else {
        output = execSync(`$(which code) ${cmd}`).toString();
    }
    logger.Info(output.toString());
}

export async function UninstallExtension(id: string, options: TestOptions) {
    const cmd = `--uninstall-extension ${id}`;
    let output: string = "";

    if (options.remoteTests) {
        await (await options.ssh).execCommand(`/home/${options.remoteUser}/.vscode-server/cli/servers/*/server/bin/code-server ${cmd}`, {
            onStdout: (chunk) => output = chunk.toString(),
            onStderr: (chunk) => output = chunk.toString(),
        });
    } else {
        output = execSync(`$(which code) ${cmd}`).toString();
    }
    logger.Info(output.toString());
}

/**
 * 
 * @param body Function body to execute inside the given frame.
 * @param frame Name of a frame to look for.
 * @returns TResult of a provided body.
 */
export async function ExecuteInOneApiDebugPaneFrame<TResult>(body: (driver: WebDriver) => Promise<TResult>, frame: OneApiDebugPaneFrameTitle): Promise<TResult> {
    const outerFrames = await VSBrowser.instance.driver.findElements(By.css("iframe"));
    let result;

    for (const outerFrame of outerFrames) {
        result = await ExecuteInIFrame(async driver => {
            try {
                const innerFrame = await driver.findElement(By.css("#active-frame"));
                const frameTitle = await innerFrame.getAttribute("title");

                if (frameTitle !== frame) { return; }
                return await ExecuteInIFrame(body, innerFrame);
            } catch {
                return;
            }
        }, outerFrame);

        if (result) {break;}
    }

    return result as TResult;
}

/**
 * 
 * @param str Core string.
 * @param startStr Start string.
 * @param endStr End string.
 * @returns String between start and end strings.
 */
export function GetStringBetweenStrings(str: string, startStr: string, endStr: string) {
    const pos = str.indexOf(startStr) + startStr.length;

    return str.substring(pos, str.indexOf(endStr, pos));
}

export async function PerformContextMenuAction(element: WebElement, action: string) {
    const driver = new Workbench().getDriver();

    await driver.actions({ async: true, bridge: undefined }).contextClick(element).perform();
    const actions = await driver.findElements(By.className("action-label"));

    for (const menuAction of actions) {
        const text = await menuAction.getText();

        if (text === action) {
            menuAction.click();
            await Wait(3 * 1000);
            break;
        }
    }
}

export async function GetLineNumberWebElement(lineNumber: number) {
    const textEditor = new TextEditor();
    const lineNumbers = await textEditor.findElements(By.className("line-numbers lh-odd"));

    return await (async() => {
        for (const line of lineNumbers) {
            const elementText = await line.getText();

            if (elementText === `${lineNumber}`) { return line; }
        }
    })();
}

export function GetRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

export async function GetExceptionPopupMessage(): Promise<string | undefined> {
    return await Retry(async() => {
        const exceptionPopup = await new Workbench().getDriver().findElement(By.className("zone-widget-container exception-widget"));

        assert.notEqual(exceptionPopup, undefined, "Cannot find 'breakpoint hit' exception popup");
        return await exceptionPopup.findElement(By.className("description")).getText();
    }, 10 * 1000);
}

/**
 * Changes given setting to a given value.
 * @param setting Setting to change.
 * @param newValue New value to be set.
 */
export async function ChangeLocalVsCodeSettings(setting: string, newValue: unknown) {
    logger.Info(`Change VsCode setting '${setting}' to '${newValue}'`);
    const vsCodeSettingsPath = "test-resources/settings/User/settings.json";

    if (!await FileExistsAsync(vsCodeSettingsPath, { remotePath: false })) {
        await WriteFileAsync(vsCodeSettingsPath, "{}", { remotePath: false });
    }
    const settings = JSON.parse(await ReadFileAsync(vsCodeSettingsPath, "utf-8", { remotePath: false }));

    settings[setting] = newValue;
    await WriteFileAsync(vsCodeSettingsPath, JSON.stringify(settings), { remotePath: false });
}

/**
 * Replaces given string with new string in given file.
 * @param replaceString String to replace.
 * @param withString String to use as a replacement.
 * @param resources File where to find a replaceString
 */
export async function ReplaceStringInFile(replaceString: string, withString: string, file: string, options: FsOptions): Promise<boolean> {
    if (!await FileExistsAsync(file, options)) {
        return false;
    }

    const arrayTransform = await ReadFileAsync(file, "utf-8", options);

    let arraytransformLines = arrayTransform.split("\n");

    arraytransformLines = arraytransformLines.map(x => x.includes(replaceString) ? withString : x);
    await WriteFileAsync(file, arraytransformLines.join("\n"), options);

    return true;
}

/**
 * Gets setting by its id.
 * @param id Setting id.
 * @param settingsEditor Settings page object.
 * @returns Setting object.
 */
export async function GetSettingById(id: string, settingsEditor?: SettingsEditor): Promise<Setting> {
    logger.Info(`Get setting by id: '${id}'`);
    settingsEditor = settingsEditor ?? await new Workbench().openSettings();
    return await settingsEditor.findSettingByID(id);
}

/**
 * Sets given value to given setting id.
 * @param settingId Setting id.
 * @param newValue Value to be set.
 * @param settingsEditor Settings page object.
 */
export async function SetSettingValue(settingId: string, newValue: string, settingsEditor?: SettingsEditor) {
    const ACTIVE_LANE_SYMBOL = await GetSettingById(settingId, settingsEditor);

    logger.Info(`Set '${settingId}' to '${newValue}'`);
    await ACTIVE_LANE_SYMBOL.setValue(newValue);
}

export function MapTestOptions(options: TestOptions): FsOptions {
    return options.remoteTests ? {
        remotePath: options.remoteTests,
        ssh: options.ssh,
    } : { remotePath: false };
}

export async function WaitForConnection(ip: string, timeout: number) {
    await Retry(async() => {
        const statusbar = new StatusBar();
        const status = await statusbar.getItem(`remote  SSH: ${ip}`);

        if (status) { return; }
        await Wait(5 * 1000);
        throw new Error();
    }, timeout, true);
}

/**
 * Gets view control.
 * @param viewControl View constrol name to get.
 * @returns View control as ViewControl.
 */
async function GetViewControl(viewControl: ViewControlName): Promise<ViewControl | undefined> {
    return await Retry(async() => {

        logger.Info(`Get '${viewControl}' view control from Activity bar`);
        const activityBar = new ActivityBar();
        const result = await activityBar.getViewControl(viewControl);

        return result;
    }, 60 * 1000);
}

/**
 * Creates c/c++ properties file.
 */
async function CreateCCppPropertiesFile(options: FsOptions): Promise<void> {
    type CcppConfiguration = {
        name: string;
        includePath: [];
        defines: [];
        compilerPath: string;
        cStandard: string;
        cppStandard: string;
        intelliSenseMode: string;
    };
    const ccppProperties = {
        "configurations": [
            {
                "name": "Linux",
                "includePath": [
                    "${workspaceFolder}/**",
                    "/opt/intel/oneapi/compiler/latest/linux/include",
                    "/opt/intel/oneapi/compiler/latest/linux/include/sycl",
                    "/opt/intel/oneapi/dev-utilities/latest/include/",
                    "/opt/intel/oneapi/dev-utilities/latest/include"
                ],
                "defines": [],
                "compilerPath": "/usr/bin/gcc",
                "cStandard": "c17",
                "cppStandard": "gnu++17",
                "intelliSenseMode": "linux-gcc-x64"
            } as unknown as CcppConfiguration,
        ],
        "version": 4
    };
    const ccppPropertiesFilePath = `${VSCODE_PATH}/c_cpp_properties.json`;

    if (!await FileExistsAsync(VSCODE_PATH, options)) {
        await MkdirAsync(VSCODE_PATH, options);
    }
    if (!await FileExistsAsync(ccppPropertiesFilePath, options)) {
        await WriteFileAsync(ccppPropertiesFilePath, JSON.stringify(ccppProperties), options);
        return;
    }

    logger.Info(`Load '${ccppPropertiesFilePath}' file`);
    const ccppPropertiesFileContent = await LoadAndParseJsonFile<{ configurations: Array<CcppConfiguration> }>(ccppPropertiesFilePath, options);
    const exists = ccppPropertiesFileContent.configurations.some((x: CcppConfiguration) => x === ccppProperties.configurations[0]);

    if (!exists) {
        ccppPropertiesFileContent.configurations.push(ccppProperties.configurations[0]);
    }
}

/**
 * Initializates default oneAPI environment.
 */
async function InitDefaultEnvironment(): Promise<void> {
    const input = await Retry(async() => {
        const temp = await SetInputText("> Intel oneAPI: Initialize default environment variables");
        
        if (!temp) {throw Error();}
        return temp;
    }, 10 * 1000) as InputBox;
    
    await input.clear();
    const quickPick = await input.findQuickPick(0);

    await Wait(3 * 1000);
    const driver = new Workbench().getDriver();

    await driver.executeScript("arguments[0].click()", quickPick);
    await Wait(3 * 1000);
}

/**
 * Adds task to tasks.json
 * @param task Task to add.
 */
async function AddTask(task: VsCodeTask, options: FsOptions): Promise<void> {
    if (!await FileExistsAsync(VSCODE_PATH, options)) {
        await MkdirAsync(VSCODE_PATH, options);
    }
    if (!await FileExistsAsync(TASKS_JSON_PATH, options)) {
        await WriteFileAsync(TASKS_JSON_PATH, JSON.stringify({ "tasks": [] }), options);
    }
    const tasks = (await LoadAndParseJsonFile<{tasks: VsCodeTask[]}>(TASKS_JSON_PATH, options)).tasks;
    const exists = tasks.some(x => x.label === task.label);

    if (!exists) {
        tasks.push(task);
    }
    await WriteFileAsync(TASKS_JSON_PATH, JSON.stringify({ tasks: tasks }), options);
}

/**
 * Runs given task.
 * @param taskName Task to run.
 * @param expectedOutput Expected task output.
 */
async function RunTask(taskName: string, expectedOutput: string): Promise<void> {
    let input =  await SetInputText("> Tasks: Run Task", { confirmCommand: false });

    input = await SelectQuickPick("Tasks: Run Task", input);
    await SelectQuickPick(taskName, input);
    const wasExecuted = await Retry(async() => {
        const result = await CheckIfTaskWasExecuted(taskName, expectedOutput);

        return result;
    }, 10 * 1000);

    assert.isTrue(wasExecuted, `Error while running ${taskName} task. Actual: '${wasExecuted}' | Expected: 'true'`);
    logger.Pass(`Running ${taskName} task succeed. Actual: '${wasExecuted}' | Expected: 'true'`);
}

/**
 * Generates launch configuration.
 * @returns Generated configuration name.
 */
async function GenerateLaunchConfigurations(options: FsOptions): Promise<string> {
    const launchJsonPath = `${VSCODE_PATH}/launch.json`;

    if (await FileExistsAsync(launchJsonPath, options)) {
        const launchJson = await LoadAndParseJsonFile<{configurations: {miDebuggerPath: string; name: string}[]}>(launchJsonPath, options);
        const configurationName = launchJson.configurations[0].name;

        return configurationName;
    }
    let input = await SetInputText("> Intel oneAPI: Generate launch configurations");

    await Wait(5 * 1000);
    const picks = await input.getQuickPicks();
    const pick = picks.find(async x => (await x.getText()).includes("array-transform")) as QuickPickItem;

    logger.Info(`Select Quick pick: ${await pick?.getText()}`);
    await Wait(3 * 1000);
    const driver = new Workbench().getDriver();
    
    await driver.executeScript("arguments[0].click()", pick);
    input = await SelectQuickPick("no", input);
    await input.confirm();
    input = await SelectQuickPick("no", input);
    input = await SelectQuickPick("preTask", input);
    input = await SelectQuickPick("postTask", input);
    try { await input.cancel(); }
    catch { /* empty */ }
    await Wait(2000);
    const launchJson = await LoadAndParseJsonFile<{configurations: {miDebuggerPath: string; name: string}[]}>(launchJsonPath, options);

    assert.exists(launchJson.configurations[0], "[ERROR] Debug launch configuration hasn't been created!");
    logger.Pass("Debug launch configuration has been created and exists in 'launch.json'");
    launchJson.configurations[0].miDebuggerPath = "/opt/intel/oneapi/debugger/latest/bin/gdb-oneapi";
    const configurationName: string = launchJson.configurations[0].name;

    await WriteFileAsync(launchJsonPath, JSON.stringify(launchJson), options);

    return configurationName;
}