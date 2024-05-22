/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ActivityBar, By, DebugConsoleView, DebugView, EditorView, ExtensionsViewSection, InputBox, Notification, NotificationType, QuickOpenBox, QuickPickItem, SideBarView, TerminalView, TextEditor, VSBrowser, ViewControl, WebDriver, WebElement, Workbench } from "vscode-extension-tester";
import { Breakpoint, ConditionalBreakpoint, DebugPane, VsCodeTask } from "./Types";
import { VSCODE_PATH, TASKS_JSON_PATH, DEFAULT_BREAKPOINT } from "./Consts";
import { LoggerAggregator as logger } from "./Logger";
import { assert } from "chai";
import { FileExistsSync, MkdirSync, WriteFileSync, LoadAndParseJsonFile } from "./FileSystem";

type ExtensionSection = "Installed";
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
    let sectionToReturn;

    for await (const section of availableSections) {
        const title = await section.getTitle();

        try {
            await (section as ExtensionsViewSection).clearSearch();
        } catch (e) {
            logger.Error(e);
        }

        logger.Info(title);
        if (title === sectionName) {
            sectionToReturn = section;
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
    if (confirmCommand) { await input.confirm(); }
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
export async function UninstallExtension(extensionName: string): Promise<void> {
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
export async function LaunchSequence(): Promise<void> {
    CreateCCppPropertiesFile();
    await InitDefaultEnvironment();
    AddTask({
        "label": "preTask",
        "command": "source /opt/intel/oneapi/setvars.sh --force && mkdir -p build && cd build && cmake .. && make && echo simple preTask",
        "type": "shell",
        "problemMatcher": []
    });
    AddTask({
        "label": "postTask",
        "command": "echo simple postTask",
        "type": "shell"
    });
    await RunTask("preTask", "[100%] Built target array-transform");
    await RemoveAllBreakpoints();
    await SetBreakpoint(DEFAULT_BREAKPOINT);
    await StartDebugging();
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
    await SetInputText("> Terminal: Create New Terminal");
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
    const textEditor = new TextEditor(new EditorView());

    await Wait(1 * 1000);
    logger.Info(`Move cursor to [x: 1, y: ${lineNumber}]`);
    await textEditor.moveCursor(lineNumber, 1);
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
export async function StartDebugging(): Promise<void> {
    const configurationName = await GenerateLaunchConfigurations();

    await Retry(async() => {
        await Wait(5 * 1000);
        const debugView = await GetDebugView();
    
        logger.Info(`Select '${configurationName}' launch configuration`);
        await debugView.selectLaunchConfiguration(configurationName);
        logger.Info("Start debugging");
        await debugView.start();
        await Wait(5 * 1000);
        await CloseAllNotifications();
    }, 3 * 60 * 1000, true);
}

/**
 * Checks if breakpoint has been hit.
 * @param breakpoint Breakpoint to check.
 */
export async function CheckIfBreakpointHasBeenHit(breakpoint: Breakpoint | ConditionalBreakpoint): Promise<void> {
    const breakpointStr = `${breakpoint.fileName}:${breakpoint.lineNumber}`;

    await CloseAllNotifications();
    const workbench = new Workbench();
    const input = await workbench.openCommandPrompt();

    await ClearInputText(input);
    await Retry(async() => {
        const bp = await workbench.findElement(By.id("workbench.parts.panel"));
        const outputButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[3]"));
    
        await outputButton.click();
    }, 60 * 1000);
    const debugOutputWindow = new DebugConsoleView();
    const line = await Retry(async() => {
        await Wait(1000);
        return (await debugOutputWindow.getText()).split("\n").find(x => x.includes(breakpointStr));
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
    const workbench = new Workbench();
    const bp = await workbench.findElement(By.id("workbench.parts.panel"));
    const terminalButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[4]"));

    await terminalButton.click();
    const terminals = await bp.findElements(By.className("monaco-list-row"));
    let terminalFound = null;

    for (const terminal of terminals) {
        const name = await terminal.getAttribute("aria-label");

        if (name.includes(terminalName)) { terminalFound = terminal; }
    }
    const taskLabel = terminalFound?.findElement(By.className("label-name"));

    await taskLabel?.click();
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
    const workbench = new Workbench();
    const bp = await workbench.findElement(By.id("workbench.parts.panel"));
    const outputButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[3]"));

    await outputButton.click();
    const debugOutputWindow = new DebugConsoleView();
    const debugOutput = await debugOutputWindow.getText();
    const lines = debugOutput.split("\n");

    return lines;
}

/**
 * Removes all breakpoints.
 */
export async function RemoveAllBreakpoints(): Promise<void> {
    await SetInputText("> Remove All Breakpoints");
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
function CreateCCppPropertiesFile(): void {
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

    if (!FileExistsSync(VSCODE_PATH)) {
        MkdirSync(VSCODE_PATH);
    }
    if (!FileExistsSync(ccppPropertiesFilePath)) {
        WriteFileSync(ccppPropertiesFilePath, JSON.stringify(ccppProperties));
        return;
    }

    logger.Info(`Load '${ccppPropertiesFilePath}' file`);
    const ccppPropertiesFileContent = LoadAndParseJsonFile<{ configurations: Array<CcppConfiguration> }>(ccppPropertiesFilePath);
    const exists = ccppPropertiesFileContent.configurations.some((x: CcppConfiguration) => x === ccppProperties.configurations[0]);

    if (!exists) {
        ccppPropertiesFileContent.configurations.push(ccppProperties.configurations[0]);
    }
}

/**
 * Initializates default oneAPI environment.
 */
async function InitDefaultEnvironment(): Promise<void> {
    const input = await SetInputText("> Intel oneAPI: Initialize default environment variables");
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
function AddTask(task: VsCodeTask): void {
    if (!FileExistsSync(VSCODE_PATH)) {
        MkdirSync(VSCODE_PATH);
    }
    if (!FileExistsSync(TASKS_JSON_PATH)) {
        WriteFileSync(TASKS_JSON_PATH, JSON.stringify({ "tasks": [] }));
    }
    const tasks = LoadAndParseJsonFile<{tasks: VsCodeTask[]}>(TASKS_JSON_PATH).tasks;
    const exists = tasks.some(x => x.label === task.label);

    if (!exists) {
        tasks.push(task);
    }
    WriteFileSync(TASKS_JSON_PATH, JSON.stringify({ tasks: tasks }));
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
async function GenerateLaunchConfigurations(): Promise<string> {
    const launchJsonPath = `${VSCODE_PATH}/launch.json`;
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
    input = await SelectQuickPick("preTask", input);
    input = await SelectQuickPick("postTask", input);
    await input.cancel();
    const launchJson = LoadAndParseJsonFile<{configurations: {miDebuggerPath: string; name: string}[]}>(launchJsonPath);

    assert.exists(launchJson.configurations[0], "[ERROR] Debug launch configuration hasn't been created!");
    logger.Pass("Debug launch configuration has been created and exists in 'launch.json'");
    launchJson.configurations[0].miDebuggerPath = "/opt/intel/oneapi/debugger/latest/bin/gdb-oneapi";
    const configurationName: string = launchJson.configurations[0].name;

    WriteFileSync(launchJsonPath, JSON.stringify(launchJson));

    return configurationName;
}