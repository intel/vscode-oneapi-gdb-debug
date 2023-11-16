import * as fs from "fs";
import * as util from "util";
import { assert } from "chai";
import { ActivityBar, By, DebugConsoleView, DebugToolbar, DebugView, EditorView, ExtensionsViewSection, InputBox, NotificationType, QuickOpenBox, SideBarView, TerminalView, TextEditor, VSBrowser, WebDriver, WebElement, WebView, Workbench } from "vscode-extension-tester";
import { ConsoleLogger, ILogger, LoggerAggregator } from "./Logger";
import { exec } from "child_process";
import axios from "axios";
import { IVsCodeTask, ICcppConfiguration, INotification } from "./Interfaces";
import { ThreadProperties } from "./Consts";

const execAsync = util.promisify(exec);
const logger: ILogger = new LoggerAggregator([new ConsoleLogger()]);
const dotVscodePath = "../array-transform/.vscode";
const ccppPropertiesFilePath = `${dotVscodePath}/c_cpp_properties.json`;
const tasksJsonFilePath = `${dotVscodePath}/tasks.json`;
const launchJsonPath = `${dotVscodePath}/launch.json`;

/**
 * Generates launch task by given @param taskName
 * @param taskName Task name to generate.
 */
export async function GenerateTaskTest(taskName: string) : Promise<void> {
    logger.Info(`Generate '${taskName}' task`);
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
    logger.Info("Generate debug launch configuration");
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    await LaunchSequence();
    await SetBreakpoint("array-transform.cpp", 54);
    await StartDebugging();
    assert.isTrue(
        await CheckIfBreakpointHasBeenHit(breakpoint.fileName, breakpoint.lineNumber),
        `Breakpoint ${breakpoint.fileName}:${breakpoint.lineNumber} has not been hit`);
    logger.Pass(`Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has been hit.`);
    assert.isTrue(
        await CheckIfTaskWasExecuted("preTask", "simple preTask"),
        "Task 'preTask' was not executed");
    logger.Pass("Task 'preTask' was executed");
    const bar = await DebugToolbar.create();

    await bar.stop();
    assert.isTrue(
        await CheckIfTaskWasExecuted("postTask", "simple postTask"),
        "Task 'postTask' was not executed");
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

/** 
 * Checks if online documentation has been opened on notification button click.
 */
export async function CheckOnlineHelpTest() : Promise<void> {
    const onlineHelpNotification: INotification = {
        name: "Online help notification",
        message: "Open online documentation",
        installButton: "Open"
    };

    logger.Info("Check online help page");
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    input = await ClearInputText(input);
    await SetInputText(input, "> Intel oneAPI: Open gdb-oneapi debugger online documentation (help)");
    const center = await workbench.openNotificationsCenter();

    logger.Info("Get all notifications");
    const notifications = await center.getNotifications(NotificationType.Any);

    for (const notification of notifications) {
        const message = await notification.getMessage();

        logger.Info(`Message: ${message}`);
        if (message === onlineHelpNotification.message) {
            const actions = await notification.getActions();

            logger.Info("Count firefox processes");
            const initCount = await ProcessStart("ps aux | grep firefox | wc -l");
            const title = await actions[0].getTitle();

            logger.Info("Check if open button exists");
            assert.equal(title, onlineHelpNotification.installButton, "Open button doesn't exists");
            logger.Pass("Open button exists");
            logger.Info("Open online help by clicking notification button");
            await notification.takeAction(onlineHelpNotification.installButton);
            await Wait(2 * 1000);

            logger.Info("Get 'Trusted domains' popup");
            const popupOpenButton = await workbench.getDriver().switchTo().activeElement();
            const popup = await popupOpenButton.findElement(By.xpath("./../../.."));

            logger.Info("Get documentation url");
            const linkWebElement = await popup.findElement(By.id("monaco-dialog-message-detail"));
            const link = await linkWebElement.getText();

            assert.isTrue(link && link.startsWith("https:"), "Documentation url has not been found");
            logger.Pass(`Documentation url has been found. Url: ${link}`);
            await popupOpenButton.click();
            await Wait(2 * 1000);
            logger.Info("Count firefox processes");
            const currentCount = await ProcessStart("ps aux | grep firefox | wc -l");
            const { status } = await axios.get(link, {
                proxy: {
                    protocol: "http",
                    host: "proxy-chain.intel.com",
                    port: 911
                }
            });

            await ProcessStart("pkill -f firefox");
            assert.isAbove(Number(currentCount), Number(initCount), "Online documentation hasn't been opened");
            logger.Pass("Online documentation has been opened");
            assert.equal(status, 200, `Online documentation responded with '${status}' status code. Actual: ${status} | Expected: 200 | Url: ${link}`);
            logger.Pass(`Online documentation responded with 200. Url: ${link}`);
            break;
        }
    }
}

/**
 * Checks if offline documentation displays desired contnent.
 */
export async function CheckOfflineHelpPageTest() : Promise<void> {
    try {
        logger.Info("Check offline help page");
        const workbench = new Workbench();
        let input = await workbench.openCommandPrompt();

        input = await ClearInputText(input);
        await SetInputText(input, "> Intel oneAPI: List gdb-oneapi debugger unique commands (help)");
        await Wait(2 * 1000);
        logger.Pass("Tab 'Debugger Commands' has been found");
        await Wait(1 * 1000);
        const offlineHelpReference = JSON.parse(fs.readFileSync("media/userHelp/content.json", "utf-8"));

        logger.Info("Get all nested values");
        const values = GetAllNestedValues(offlineHelpReference);
        const webView = new WebView();

        logger.Info("Switch to frame");
        await webView.switchToFrame();
        logger.Info("Get current frame page source");
        const offlineHelpBody = await webView.getDriver().getPageSource();

        logger.Info("Switch back from frame");
        await webView.switchBack();
        for (const value of values) {
            const parsed = value.replace(/\s>\s+/g, " &gt; ").replace("<oneapiExt>", "<span class=\"oneapi-ext\">").replace("</oneapiExt>", "</span>").replace("</br>", "<br>");

            assert.isTrue(offlineHelpBody.includes(parsed), `Can't find desired line.\nExpected original: '${value}'\nExpected parsed: '${parsed}'\n`);
        }
    } catch (e) {
        logger.Exception(e);
        throw e;
    } finally {
        const editorView = new EditorView();

        logger.Info("Close all editors");
        await editorView.closeAllEditors();
    }
}

/**
 * Uninstalls all extensions installed during testing.
 */
export async function UninstallAllExtensions(): Promise<void> {
    const extensionsToUninstall = [
        "Analysis Configurator for Intel® oneAPI Toolkits",
        "Code Sample Browser for Intel® oneAPI Toolkits",
        "Environment Configurator for Intel® oneAPI Toolkits",
        "C/C++",
        "CMake Tools",
    ];

    for await (const extension of extensionsToUninstall) {
        await UninstallExtension(extension);
    }
}

/**
 * Executes 'Refresh SIMD data' command and checks if debug views data' 
 */
export async function RefreshSimdDataTest(): Promise<void> {
    logger.Info("Refresh SIMD data");
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    await LaunchSequence();
    await SetBreakpoint(breakpoint.fileName, breakpoint.lineNumber);
    try {
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(breakpoint.fileName, breakpoint.lineNumber),
            `Breakpoint ${breakpoint.fileName}:${breakpoint.lineNumber} has not been hit`);
        logger.Pass(`Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has been hit.`);
        assert.isTrue(
            await CheckIfTaskWasExecuted("preTask", "simple preTask"),
            "Task 'preTask' was not executed");
        logger.Pass("Task 'preTask' was executed");
        const consoleOutput = (await GetDebugConsoleOutput()).filter(x =>
            x.includes("[Switching to Thread") || x.includes(`at ${breakpoint.fileName}:${breakpoint.lineNumber}`)).join(" ");
        const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
        let gpuThreadsViewContent = [""], hwInfoViewContent = [""], selectedLaneViewContent = [""];
        const workbench = new Workbench();
        const input = await workbench.openCommandPrompt();

        await ClearInputText(input);
        await SetInputText(input, "> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");

        await gpuThreadsView?.click();
        await ExecuteInIFrame(null, async() => {
            await ExecuteInIFrame(null, async driver => {
                gpuThreadsViewContent = (await driver.findElement(By.id("simd-view")).getText()).split("\n");
            });
        });
        await gpuThreadsView?.click();
        const hwInfo = await GetDebugPane("Hardware Info Section");
        
        await hwInfo?.click();
        await ExecuteInIFrame(null, async() => {
            await ExecuteInIFrame(null, async driver => {
                hwInfoViewContent = (await driver.findElement(By.className("content")).getText()).split("\n");
            });
        });
        await hwInfo?.click();
        const selectedLane = await GetDebugPane("Selected Lane Section");

        await selectedLane?.click();
        await ExecuteInIFrame(null, async() => {
            await ExecuteInIFrame(null, async driver => {
                selectedLaneViewContent = (await driver.findElement(By.css("tbody")).getText()).split("\n");
            });
        });
        const currentThreadId = GetStringBetweenStrings(consoleOutput, ".", " lane");
        const currentThreadLane = GetStringBetweenStrings(consoleOutput, "lane ", "]");
        const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");
        const currentgpuThread = gpuThreadsViewContent[gpuThreadsViewContent.indexOf("⇨") - 1];

        logger.Info("Check if 'HARDWARE INFO' view contains expected info");
        assert.isTrue(hwInfoViewContent?.includes(`Name: ${deviceName}`),
            "Device name doesn't match");
        logger.Info("Check if 'SELECTED LANE' view contains expected info");
        assert.isTrue(selectedLaneViewContent?.includes(`Lane Number: ${currentThreadLane}`),
            "Lane number doesn't match");
        logger.Info("Check if 'ONEAPI GPU THREADS' view contains expected info");
        assert.isTrue(currentgpuThread.includes(`.${currentThreadId}`),
            "Current thread doesn't match");
    } catch (e) {
        logger.Exception(e);
    } finally {
        logger.Info("Get 'DebugToolbar' handle");
        const bar = await DebugToolbar.create();

        logger.Info("Stop debugging");
        await bar.stop();
    }
}

/**
 * Checks if current thread is the same in debug console and oneapi gpu threads window.
 */
export async function ValidateOneApiGpuThreadsTest(threadProperty: ThreadProperties) {
    logger.Info(`Validate OneAPI GPU Threads - Check threads ${threadProperty.toString()}`);
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    await LaunchSequence();
    await SetBreakpoint(breakpoint.fileName, breakpoint.lineNumber);
    try {
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(breakpoint.fileName, breakpoint.lineNumber),
            `Breakpoint ${breakpoint.fileName}:${breakpoint.lineNumber} has not been hit`);
        logger.Pass(`Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has been hit.`);
        assert.isTrue(
            await CheckIfTaskWasExecuted("preTask", "simple preTask"),
            "Task 'preTask' was not executed");
        logger.Pass("Task 'preTask' was executed");
        const workbench = new Workbench();
        const input = await workbench.openCommandPrompt();

        await ClearInputText(input);
        await SetInputText(input, "> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const getRefreshButton = async(gpuThreadsView: WebElement) => {
            const buttons = await gpuThreadsView.findElements(By.xpath("//*/div[3]/div/div/ul/li/a"));

            for (const button of buttons) {
                const value = await button.getAttribute("aria-label");
            
                if (value === "Intel oneAPI: Refresh SIMD Data") {
                    return button;
                }
            }
        };
        const getThreads = async() => {
            let gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");
            const gpuThreadsViewClass = await gpuThreadsView?.getAttribute("class");

            if (!gpuThreadsViewClass?.includes("expanded")) {
                await gpuThreadsView?.click();
            }
            gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");
            await Wait(3 * 1000);
            const refreshButton = await getRefreshButton(gpuThreadsView as WebElement);

            await refreshButton?.click();
            await Wait(3 * 1000);
            const gpuThreadsParsed: string[][] = [];

            await ExecuteInIFrame(null, async() => {
                await ExecuteInIFrame(null, async driver => {
                    const gpuThreads = await driver.findElement(By.id("simd-view"));
                    const gpuThreadsRows = await gpuThreads.findElements(By.css("#simd-view > tbody > tr"));
        
                    for (const row of gpuThreadsRows) {
                        const rowData = await row.findElements(By.css("td"));
                        const rowParsed = [];
        
                        for (const data of rowData) {
                            const rowDataText = await data.getText();
        
                            if (rowDataText) {rowParsed.push(rowDataText);}
                        }
                        gpuThreadsParsed.push(rowParsed);
                    }
                });
            });

            return gpuThreadsParsed;
        };

        let linesPrev: string | string[] = [];
        const threadsNumber = (await getThreads()).length;
        let currentIteration = 1;

        while (currentIteration < threadsNumber) {
            logger.Info(`Iteration ${currentIteration}`);
            const gpuThreadsParsed = await getThreads();
            const consoleOutput = await GetDebugConsoleOutput();
            const linesNext = consoleOutput.filter(x => x.includes(`at ${breakpoint.fileName}:${breakpoint.lineNumber}`));
            const currentBpInfo = linesNext.filter(x => !linesPrev.includes(x))[0];
            const currentThread = gpuThreadsParsed.reduce((x, y) => x.length > y.length ? x : y, []);
            let result = false;

            switch (threadProperty) {
            case ThreadProperties.Id:
                result = currentBpInfo.includes(`${parseInt(currentThread[0]) - 2}`);
                break;
            case ThreadProperties.Location:
                result = currentBpInfo.includes(currentThread[2]);
                break;
            }
            logger.Info(`Current thread in gpu threads view: ${currentThread}`);
            logger.Info(`Current thread in debug console view: ${currentBpInfo}`);
            logger.Info(`Check if thread ${threadProperty} is the same in debug console and gpu threads view.`);
            assert.isTrue(result, "Threads are different");
            logger.Pass(`Thread ${threadProperty} is the same in debug console and gpu threads view`);
            const bar = await DebugToolbar.create();
        
            await bar.continue();

            linesPrev = linesNext;
            currentIteration++;
        }
    } finally {
        const bar = await DebugToolbar.create();
    
        await bar.stop();
    }
}

/**
 * Installs required extensions.
 */
export async function InstallRequiredExtensions(): Promise<void> {
    logger.Info("Check if required extensions are installed");
    const requiredExtensions = [
        "Analysis Configurator for Intel® oneAPI Toolkits",
        "Code Sample Browser for Intel® oneAPI Toolkits",
        "Environment Configurator for Intel® oneAPI Toolkits",
        "C/C++",
        "CMake Tools",
    ];

    for await (const requiredExtension of requiredExtensions) {
        const isExtensionInstalled = await IsExtensionInstalled(requiredExtension);

        if (!isExtensionInstalled) {
            await InstallExtension(requiredExtension);
        }
    }
    await Wait(3 * 1000);
}

function GetStringBetweenStrings(str: string, startStr: string, endStr: string) {
    const pos = str.indexOf(startStr) + startStr.length;
    
    return str.substring(pos, str.indexOf(endStr, pos));
}

async function GetDebugPane(paneToFind: string): Promise<WebElement | undefined> {
    const debugView = await GetDebugView();
    const debugPanes = await debugView.findElements(By.className("pane-header"));

    for (const pane of debugPanes) {
        const value = await pane.getAttribute("aria-label");

        if (value === paneToFind) {
            return pane;
        }
    }
}

async function ExecuteInIFrame(frame: number | WebElement | null, body: (driver: WebDriver) => unknown): Promise<void> {
    const workbench = new Workbench();
    const driver = await workbench.getDriver();

    if (!frame) {
        frame = await driver.findElement(By.css("iframe"));
    }
    await driver.switchTo().frame(frame);
    await body(driver);
    await driver.switchTo().parentFrame();
}

async function GetDebugConsoleOutput(): Promise<string[]> {
    const workbench = new Workbench();
    const bp = await workbench.findElement(By.id("workbench.parts.panel"));
    const outputButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[3]"));

    await outputButton.click();
    const debugOutputWindow = new DebugConsoleView();
    const debugOutput = await debugOutputWindow.getText();
    const lines = debugOutput.split("\n");

    return lines;
}

async function StartDebugging() {
    const configurationName = await GenerateLaunchConfigurations();

    await Wait(5 * 1000);
    const debugView = await GetDebugView();

    logger.Info(`Select '${configurationName}' launch configuration`);
    await debugView.selectLaunchConfiguration(configurationName);
    logger.Info("Start debugging");
    await debugView.start();
    await Wait(5 * 1000);
    await CloseAllNotifications();
}

async function LaunchSequence() {
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
}

function GetAllNestedValues(jsonObject: unknown): string[] {
    if (typeof jsonObject !== "object") {
        return jsonObject as never;
    }
    let values: string[] = [];

    for (const key in jsonObject) {
        const value: unknown = jsonObject[key as keyof object];

        if (Array.isArray(value)) {
            for (const arrValue of value) {
                values = values.concat(GetAllNestedValues(arrValue));
            }
            continue;
        }
        values = values.concat(GetAllNestedValues(value));
    }
    return values;
}

async function UninstallExtension(extensionName: string): Promise<void> {
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
        logger.Exception(e);
        await Wait(2 * 1000);
        return;
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
    logger.Info("Set command palette text to '> Tasks: Run Task'");
    await input.setText("> Tasks: Run Task");
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

function AddTask(task: IVsCodeTask): void {
    const emptyTasks = { "tasks": [] };

    logger.Info(`Check if '${dotVscodePath}' exists`);
    if (!fs.existsSync(dotVscodePath)) {
        fs.mkdirSync(dotVscodePath);
    }
    logger.Info(`Check if '${tasksJsonFilePath}' exists`);
    if (!fs.existsSync(tasksJsonFilePath)) {
        logger.Info(`File '${tasksJsonFilePath}' doesn't exist`);
        logger.Info(`Create '${tasksJsonFilePath}' file`);
        fs.writeFileSync(tasksJsonFilePath, JSON.stringify(emptyTasks));
    }
    logger.Info(`Load '${tasksJsonFilePath}' file`);
    const tasksObj = JSON.parse(fs.readFileSync(tasksJsonFilePath, "utf-8"));

    logger.Info(`Check if ${task} exists`);
    const exists = (tasksObj.tasks as Array<IVsCodeTask>).some(x => x.label === task.label);
    
    if (!exists) {
        logger.Info(`Add ${task} task to '${tasksJsonFilePath}' file`);
        tasksObj.tasks.push(task);
    }
    logger.Info(`Save '${tasksJsonFilePath}' file`);
    fs.writeFileSync(tasksJsonFilePath, JSON.stringify(tasksObj));
}

function CreateCCppPropertiesFile(): void {
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
            } as unknown as ICcppConfiguration,
        ],
        "version": 4
    };

    logger.Info(`Check if '${dotVscodePath}' exists`);
    if (!fs.existsSync(dotVscodePath)) {
        fs.mkdirSync(dotVscodePath);
    }
    logger.Info(`Check if '${ccppPropertiesFilePath}' exists`);
    if (!fs.existsSync(ccppPropertiesFilePath)) {
        logger.Info(`File '${ccppPropertiesFilePath}' doesn't exist`);
        logger.Info(`Create '${ccppPropertiesFilePath}' file`);
        fs.writeFileSync(ccppPropertiesFilePath, JSON.stringify(ccppProperties));
        return;
    }

    logger.Info(`Load '${ccppPropertiesFilePath}' file`);
    const ccppPropertiesFileContent: {configurations: Array<ICcppConfiguration>} = JSON.parse(fs.readFileSync(ccppPropertiesFilePath, "utf-8"));

    const exists = ccppPropertiesFileContent.configurations.some((x: ICcppConfiguration) => x === ccppProperties.configurations[0]);

    if (!exists) {
        ccppPropertiesFileContent.configurations.push(ccppProperties.configurations[0]);
    }
}

async function CloseAllNotifications(): Promise<void> {
    logger.Info("Open notification center");
    const workbench = new Workbench();
    const center = await workbench.openNotificationsCenter();

    logger.Info("Clear all notifications");
    await center.clearAllNotifications();
    await center.close();
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
    await CloseAllNotifications();
    const workbench = new Workbench();
    let input: InputBox | QuickOpenBox | undefined = new InputBox();

    await Wait(3 * 1000);
    input = await Retry(async() => {
        let input = await workbench.openCommandPrompt();

        input = await ClearInputText(input);
        return input;
    }, 10 * 1000);

    logger.Info("Set command palette text to '> Terminal: Create New Terminal'");

    await SetInputText(input, "> Terminal: Create New Terminal");
    const innerText = await GetTerminalOutput(taskName);

    logger.Info(`'${taskName}' task output: ${innerText}`);
    const result = innerText?.includes(expectedOutput);

    return result as boolean;
}

async function GetTerminalOutput(terminalName: string): Promise<string | undefined> {
    const workbench = new Workbench();
    const bp = await workbench.findElement(By.id("workbench.parts.panel"));
    const terminalButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[4]"));

    await terminalButton.click();
    const terminals = await bp.findElements(By.className("monaco-list-row"));
    let terminalFound = null;

    for (const terminal of terminals) {
        const name = await terminal.getAttribute("aria-label");

        if (name.includes(terminalName)) {terminalFound = terminal;}
    }
    const taskLabel = terminalFound?.findElement(By.className("label-name"));

    await taskLabel?.click();
    const terminal = new TerminalView();

    logger.Info(`Get '${terminalName}' terminal text`);
    const innerText = await Retry(async() => await terminal.getText(), 5 * 1000);

    return innerText;
}

async function CheckIfBreakpointHasBeenHit(fileName: string, lineNumber: number): Promise<boolean> {
    const breakpoint = `${fileName}:${lineNumber}`;
    
    await CloseAllNotifications();
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    input = await ClearInputText(input);
    logger.Info("Set command palette text to '> Terminal: Create New Terminal'");

    await SetInputText(input, "> Terminal: Create New Terminal");
    const bp = await workbench.findElement(By.id("workbench.parts.panel"));
    const outputButton = await bp.findElement(By.xpath("//*[@id=\"workbench.parts.panel\"]/div[1]/div[1]/div/div/ul/li[3]"));

    await outputButton.click();
    const debugOutputWindow = new DebugConsoleView();
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

async function SetInputText(input: QuickOpenBox | InputBox | undefined, command: string): Promise<QuickOpenBox | InputBox> {
    if (input === undefined){
        const workbench = new Workbench();

        input = await workbench.openCommandPrompt();
    }
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

async function SetBreakpoint(fileName: string, lineNumber: number): Promise<boolean> {
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
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input,"> Debug: Inline Breakpoint");
    await Wait(1 * 1000);
    const bpIcons = await textEditor.getDriver().findElements(By.className("codicon-debug-breakpoint"));
    const bpset = bpIcons.find(async x => await x.findElement(By.xpath("./..")).findElement(By.className("line-numbers")).getText() === lineNumber.toString());
    const bpSetOrRemoved = bpset ? "set" : "removed";

    logger.Info(`Breakpoint at line ${lineNumber} has been ${bpSetOrRemoved}`);
    return bpset ? true : false;
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
    let sectionToReturn;

    for await (const section of availableSections) {
        const title = await section.getTitle();

        try {
            await (section as ExtensionsViewSection).clearSearch();
        } catch (e) {
            logger.Exception(e);
        }

        logger.Info(title);
        if (title === sectionName) {
            sectionToReturn = section;
        }
    }
    return sectionToReturn as ExtensionsViewSection;
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

async function IsExtensionInstalled(extensionName: string) : Promise<boolean | undefined> {
    const result = await Retry(async() => {
        const extensionsView = await GetExtensionsSection("Installed");

        await extensionsView.clearSearch();
        const extensionsList = await extensionsView.getText();
        const isInstalled = extensionsList.includes(extensionName);

        logger.Info(isInstalled ? `Extension: '${extensionName}' is installed` : `Extension: '${extensionName}' is not installed`);
        return isInstalled;
    }, 5 * 1000);

    return result;
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

async function InitDefaultEnvironment(): Promise<void> {
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    await SetInputText(input, "> Intel oneAPI: Initialize default environment variables");
    await Wait(3 * 1000);
}

async function GenerateLaunchConfigurations(): Promise<string> {
    logger.Info("Check if debug launch configuration already exists");
    // const dotVscodePath = "../array-transform/.vscode";
    const workbench = new Workbench();
    let input = await workbench.openCommandPrompt();

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

    return configurationName;
}

export * as TestFunctions from "./TestFunctions";