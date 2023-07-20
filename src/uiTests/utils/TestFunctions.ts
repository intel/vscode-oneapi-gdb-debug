import * as fs from "fs";
import * as util from "util";
import { assert } from "chai";
import { ActivityBar, BottomBarPanel, By, DebugToolbar, DebugView, EditorView, ExtensionsViewSection, InputBox, NotificationType, QuickOpenBox, SideBarView, TextEditor, VSBrowser, Workbench } from "vscode-extension-tester";
import { ConsoleLogger, ILogger, LoggerAggregator } from "./Logger";
import { exec } from "child_process";

const execAsync = util.promisify(exec);
const logger: ILogger = new LoggerAggregator([new ConsoleLogger()]); 

/**
 * Generates launch task by given @param taskName
 * @param taskName Task name to generate.
 */
export async function GenerateTaskTest(taskName: string) : Promise<void> {
    logger.Info(`Generate '${taskName}' task`);
    logger.Info("Check if required extensions are installed");
    const requiredExtensions = [
        "Analysis Configurator for Intel® oneAPI Toolkits",
        "Code Sample Browser for Intel® oneAPI Toolkits",
        "Environment Configurator for Intel® oneAPI Toolkits",
        "C/C++",
        "CMake Tools",
    ];

    for await (const requiredExtension of requiredExtensions) {
        const isExtensionInstalled = await IsExtensionsInstalled(requiredExtension);

        if (!isExtensionInstalled) {
            await InstallExtension(requiredExtension);
        }
    }
    await Wait(3 * 1000);
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    input = await ClearInputText(input);
    input = await SetInputText(input, "> Intel oneapi: Generate tasks");
    logger.Info("Select 'Select a new target' quick pick");
    input = await ClearInputText(input);
    await input.selectQuickPick("Select a new target");
    input = await ClearInputText(input);
    logger.Info(`Select '${taskName}' quick pick`);
    await input.selectQuickPick(taskName);
    input = await ClearInputText(input);
    logger.Info("Select 'Close' quick pick");
    await input.selectQuickPick("Close");

    logger.Info(`Load 'tasks.json' file and look for created '${taskName}' task`);
    const tasks = JSON.parse(fs.readFileSync("../array-transform/.vscode/tasks.json", "utf-8"));
    const runCpuTask = tasks.tasks.find((task: { label: string }) => task.label === taskName);
    
    logger.Info(`Check if '${taskName}' has been created and exists in 'tasks.json'`);
    assert.exists(runCpuTask, `'${taskName}' task doesn't exists!`);
    logger.Pass(`Task: '${taskName}' has been created and exists in 'tasks.json'`);

    logger.Info(`Check if '${taskName}' task has correct label`);
    assert.strictEqual(runCpuTask.label, taskName, `'${taskName}' task has incorrect label`);
    logger.Pass(`Task: '${taskName}' has correct label`);

    logger.Info(`Check if '${taskName}' task has correct command`);
    assert.strictEqual(runCpuTask.command,
        `mkdir -p build && cmake  -S . -B build && cmake --build build && cmake --build build --target ${taskName}`,
        `'${taskName}' task has incorrect command`);
    logger.Pass(`Task: '${taskName}' has correct command`);
}

/**
 * Generates debug launch task by given
 */
export async function GenerateDebugLaunchConfigurationTest() : Promise<void> {
    const launchJsonPath = "../array-transform/.vscode/launch.json";
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    logger.Info("Generate debug launch configuration");
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

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
    CreateCCppPropertiesFile();
    await input.cancel();
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input, "> Intel oneAPI: Initialize default environment variables");
    await Wait(3 * 1000);
    await RunTask("preTask", "[100%] Built target array-transform");
    await Wait(3 * 1000);
    await RemoveAllBreakpoints();
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input, "> Intel oneAPI: Generate launch configurations");
    await Wait(5 * 1000);
    logger.Info("Get quick picks");
    const picks = await input.getQuickPicks();
    const pick = picks.find(async x => (await x.getText()).includes("array-transform"));

    logger.Info(`Select Quick pick: ${await pick?.getText()}`);
    await pick?.select();
    logger.Info("Select Quick pick: 'no'");
    await input.selectQuickPick("no");
    await Wait(3 * 1000);
    logger.Info("Confirm");
    await input.confirm();
    logger.Info("Select Quick pick: 'preTask'");
    await input.selectQuickPick("preTask");
    logger.Info("Select Quick pick: 'postTask'");
    await input.selectQuickPick("postTask");
    logger.Info("Cancel");
    await input.cancel();
    logger.Info(`Load '${launchJsonPath}' file`);
    const launchJson = JSON.parse(fs.readFileSync(launchJsonPath, "utf-8"));

    logger.Info("Check if debug launch configuration has been created and exists in 'launch.json'");
    assert.exists(launchJson.configurations[0], "[ERROR] Debug launch configuration hasn't been created!");
    logger.Pass("Debug launch configuration has been created and exists in 'launch.json'");
    launchJson.configurations[0].miDebuggerPath = "/opt/intel/oneapi/debugger/2023.1.0/gdb/intel64/bin/gdb-oneapi";
    const configurationName: string = launchJson.configurations[0].name;

    logger.Info(`Write '${launchJsonPath}' file`);
    fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson));
    await SetBreakpoint("array-transform.cpp", 54);
    await Wait(5 * 1000);
    const debugView = await GetDebugView();

    logger.Info(`Select '${configurationName}' launch configuration`);
    await debugView.selectLaunchConfiguration(configurationName);
    logger.Info("Start debugging");
    await debugView.start();
    await Wait(5 * 1000);
    await CloseAllNotifications();
    const isBreakpointHit = await CheckIfBreakpointHasBeenHit(breakpoint.fileName, breakpoint.lineNumber);

    assert.isTrue(isBreakpointHit, `Breakpoint ${breakpoint.fileName}:${breakpoint.lineNumber} has not been hit`);
    const wasPreTaskExecuted = await CheckIfTaskWasExecuted("preTask", "simple preTask");

    assert.isTrue(wasPreTaskExecuted, "Task 'preTask' was not executed");
    logger.Pass("Task 'preTask' was executed");
    const bar = await DebugToolbar.create();

    await bar.stop();
    const wasPostTaskExecuted = await CheckIfTaskWasExecuted("postTask", "simple postTask");

    assert.isTrue(wasPostTaskExecuted, "Task 'postTask' was not executed");
    logger.Pass("Task 'postTask' was executed");
}

/**
 * Installs given extension if its recomendation notification appeared.
 * @param expectedNotification Notification to expect on running clean VsCode.
 */
export async function InstallExtensionFromNotificationTest(expectedNotification: INotification) {
    logger.Info(`Install '${expectedNotification.name}' extension from notiification popup`);
    const workbench = new Workbench();
    const center = await workbench.openNotificationsCenter();

    let found = false;

    logger.Info("Get all notifications");
    const notifications = await center.getNotifications(NotificationType.Any);
    
    for (const notification of notifications){
        const message = await notification.getMessage();

        if (message === expectedNotification.message) {
            found = true;
            const actions = await notification.getActions();

            const title = await actions[0].getTitle();

            logger.Info("Check if install button exists");
            assert.equal(title, expectedNotification.installButton, "Install button doesn't exists");
            logger.Pass("Install button exists");
            logger.Info(`Install '${expectedNotification.name}' extension using notification install button`);
            await notification.takeAction(expectedNotification.installButton);
            await VSBrowser.instance.driver.sleep(5 * 1000);

            const extensionsView = await GetExtensionsSection("Installed");
            const installedExtensions = await extensionsView.getText();

            logger.Info(`Check if '${expectedNotification.name}' has been installed`);
            assert.include(installedExtensions, expectedNotification.name, `Extension: '${expectedNotification.name}' hasn't been installed`);
            logger.Pass(`Extension: '${expectedNotification.name}' has been installed`);
        }
    }

    if (!found) {
        const extensionsView = await GetExtensionsSection("Installed");
        const installedExtensions = await extensionsView.getText();

        logger.Info(`Check if '${expectedNotification.name}' is already installed`);
        assert.include(installedExtensions, expectedNotification.name, `Extension: '${expectedNotification.name}' is not installed`);
        logger.Pass(`Extension: '${expectedNotification.name}' is already installed`);
    }
}

async function ProcessStart(command: string): Promise<string | undefined | unknown> {
    let result: string | undefined | unknown;

    logger.Info(`Perform '${command}' command`);
    try {
        const { stdout } = await execAsync(command);
        
        result = stdout;
        logger.Info(`'${command}' command standard output: ${stdout}`);
    } catch (e) {
        result = e;
        logger.Exception(e);
    }

    return result;
}

async function RunTask(taskName: string, expectedOutput: string): Promise<void> {
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    input = await ClearInputText(input);
    // input = await SetInputText(input, "> Tasks: Run Task");
    logger.Info("Set command palette text to '> Tasks: Run Task'");
    await input.setText("> Tasks: Run Task");
    // await Wait(2 * 1000);
    logger.Info("Select Quick pick: 'Tasks: Run Task'");
    await input.selectQuickPick("Tasks: Run Task");
    logger.Info(`Select Quick pick: '${taskName}'`);
    await input.selectQuickPick(taskName);

    let result = false;

    await Retry(async() => {
        result = await CheckIfTaskWasExecuted(taskName, expectedOutput);
        if (!result) {throw new Error();}
    }, 10 * 1000);

    assert.isTrue(result, `Error while running ${taskName} task`);
    logger.Pass(`Running ${taskName} task succeed`);
}

function AddTask(task: object): void {
    const dotVscodePath = "../array-transform/.vscode";
    const filePath = `${dotVscodePath}/tasks.json`;
    const emptyTasks = { "tasks": [] };

    logger.Info(`Check if '${dotVscodePath}' exists`);
    if (!fs.existsSync(dotVscodePath)) {
        fs.mkdirSync(dotVscodePath);
    }
    logger.Info(`Check if '${filePath}' exists`);
    if (!fs.existsSync(filePath)) {
        logger.Info(`File '${filePath}' doesn't exist`);
        logger.Info(`Create '${filePath}' file`);
        fs.writeFileSync(filePath, JSON.stringify(emptyTasks));
    }
    logger.Info(`Load '${filePath}' file`);
    const tasksObj = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    logger.Info(`Add ${task} task to '${filePath}' file`);
    tasksObj.tasks.push(task);
    logger.Info(`Save '${filePath}' file`);
    fs.writeFileSync(filePath, JSON.stringify(tasksObj));
}

function CreateCCppPropertiesFile(): void {
    const ccppPropertiesFilePath = "../array-transform/.vscode/c_cpp_properties.json";
    const ccppProperties = {
        "configurations": [
            {
                "name": "Linux",
                "includePath": [
                    "${workspaceFolder}/**",
                    "/opt/intel/oneapi/compiler/2023.1.0/linux/include",
                    "/opt/intel/oneapi/compiler/2023.1.0/linux/include/sycl",
                    "/opt/intel/oneapi/dev-utilities/2021.9.0/include/",
                    "/opt/intel/oneapi/dev-utilities/2021.9.0/include"
                ],
                "defines": [],
                "compilerPath": "/usr/bin/gcc",
                "cStandard": "c17",
                "cppStandard": "gnu++17",
                "intelliSenseMode": "linux-gcc-x64"
            }
        ],
        "version": 4
    };

    fs.writeFileSync(ccppPropertiesFilePath, JSON.stringify(ccppProperties));
    // fs.writeFileSync()
}

async function CloseAllNotifications(): Promise<void> {
    logger.Info("Open notification center");
    const workbench = new Workbench();
    const center = await workbench.openNotificationsCenter();

    logger.Info("Clear all notifications");
    await center.clearAllNotifications();
}

async function Retry<TResult>(fn: () => TResult, timeout: number): Promise<TResult | undefined> {
    const startTime = Date.now();
    let currentTime = startTime;
    let result: TResult | undefined;

    logger.Info("Retry");
    while ((currentTime - startTime) < timeout) {
        currentTime = Date.now();
        try {
            result = await fn();
            break;
        } catch (e) {
            logger.Exception(e);
        }
    }

    currentTime = Date.now();
    logger.Info(`Elapsed ${currentTime - startTime} ms`);
    return result;
}

async function CheckIfTaskWasExecuted(taskName: string, expectedOutput: string): Promise<boolean> {
    logger.Info(`Get '${taskName}' task terminal`);
    const bp = new BottomBarPanel();

    await bp.openTerminalView();
    await CloseAllNotifications();
    const terminals = await bp.findElements(By.className("monaco-list-row"));
    const preTask = terminals.find(async x => (await x.getAttribute("aria-label")).includes(taskName));
    const taskLabel = preTask?.findElement(By.className("label-name"));

    await taskLabel?.click();
    const terminal = await bp.openTerminalView();

    logger.Info(`Get '${taskName}' task terminal text`);
    const innerText = await Retry(async() => await terminal.getText(), 5 * 1000);

    logger.Info(`'${taskName}' task output: ${innerText}`);
    const result = innerText?.includes(expectedOutput);

    return result as boolean;
}

async function CheckIfBreakpointHasBeenHit(fileName: string, lineNumber: number): Promise<boolean> {
    const breakpoint = `${fileName}:${lineNumber}`;
    const bp = new BottomBarPanel();
    const debugOutputWindow = await bp.openDebugConsoleView();

    let retries = 1;
    let line;

    while (retries <= 5 && !line) {
        logger.Info(`Check if breakpoint '${breakpoint}' has been hit. Attempt ${retries}`);
        await Wait(1000);
        const debugOutput = await debugOutputWindow.getText();
        const lines = debugOutput.split("\n");

        line = lines.find(x => x.includes(breakpoint));
        retries++;
    }
    logger.Info(`Breakpoint: ${breakpoint} ${line ? "has been hit" : "has not been hit"}`);
    return line !== undefined && line !== null;
}

async function SetInputText(input: QuickOpenBox | InputBox, command: string): Promise<QuickOpenBox | InputBox> {
    logger.Info(`Set command palette text to '${command}'`);
    await input.setText(command);
    logger.Info("Confirm");
    await input.confirm();
    return input;
}

async function ClearInputText(input: QuickOpenBox | InputBox): Promise<QuickOpenBox | InputBox> {
    try {
        logger.Info("Clear input box text");
        await input.clear();
    } catch (e) {
        logger.Exception(e);
    }

    return input;
}

async function SetBreakpoint(fileName: string, lineNumber: number): Promise<void> {
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    await input.cancel();
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input,"> Go to File...");
    await Wait(1 * 1000);
    input = await SetInputText(input, fileName);
    await Wait(2 * 1000);
    const editorView = new EditorView();

    await Wait(1 * 1000);
    logger.Info(`Open text editor with: ${fileName}`);
    const textEditor = new TextEditor(editorView);

    await Wait(1 * 1000);
    logger.Info(`Move cursor to [x: 1, y: ${lineNumber}]`);
    await textEditor.moveCursor(lineNumber, 1);
    await Wait(1 * 1000);
    logger.Info(`Toggle breakpoint at line ${lineNumber}`);
    const bpSetOrRemoved = await textEditor.toggleBreakpoint(lineNumber) ? "set" : "removed";

    logger.Info(`Breakpoint at line ${lineNumber} has been ${bpSetOrRemoved}`);
}

async function GetDebugView(): Promise<DebugView> {
    logger.Info("Get 'Run' view control from Activity bar");
    const activityBar = new ActivityBar();
    const runViewControl = await activityBar.getViewControl("Run");
    const debugView = await runViewControl?.openView() as DebugView;

    return debugView;
}

async function GetExtensionsSection(sectionName: string): Promise<ExtensionsViewSection> {
    const activityBar = new ActivityBar();

    logger.Info("Get 'Extensions' view control");
    const extensionsViewControl = await activityBar.getViewControl("Extensions");
    const extensionsSideBarView = await extensionsViewControl?.openView() as SideBarView;
    const extensionsViewContent = await extensionsSideBarView.getContent();
    const availableSections = await extensionsViewContent.getSections();

    for (const section of availableSections) {
        logger.Info(await section.getTitle());
    }
    return await extensionsViewContent.getSection(sectionName) as ExtensionsViewSection;
}

async function InstallExtension(extensionToInstall: string): Promise<void> {
    const extensionsView = await GetExtensionsSection("Installed");

    await extensionsView.clearSearch();
    const extension = await extensionsView.findItem(extensionToInstall);

    if (await extension?.isInstalled()) {
        logger.Info(`Extension '${extensionToInstall}' is already installed. SKIP`);
    }
    logger.Info(`Install '${extensionToInstall}' extension`);
    await extension?.install();
    assert.isTrue(await extension?.isInstalled(), `Installation of '${extensionToInstall}' failed`);
    logger.Pass(`Extensions ${extensionToInstall} has been installed`);
    await extensionsView.clearSearch();
}

async function IsExtensionsInstalled(extensionName: string) : Promise<boolean | undefined> {
    const extensionsView = await GetExtensionsSection("Installed");
    const extensionsList = await extensionsView.getText();
    const isInstalled = extensionsList.includes(extensionName);

    logger.Info(isInstalled ? `Extension: '${extensionName}' is installed` : `Extension: '${extensionName}' is not installed`);
    return isInstalled;
}

async function Wait(duration: number): Promise<void> {
    logger.Info(`Wait ${duration} ms`);
    await new Promise(f => setTimeout(f, duration));
    logger.Info(`Waited ${duration} ms`);
}

async function RemoveAllBreakpoints(): Promise<void> {
    logger.Info("RemoveAllBreakpoints function");
    logger.Info("Open command prompt");
    const workbench = new Workbench();
    const input = await workbench.openCommandPrompt();

    logger.Info("Perform '> Remove All Breakpoints' command");
    await input.setText("> Remove All Breakpoints");
    await input.confirm();
}

export * as TestFunctions from "./TestFunctions";