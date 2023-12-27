import * as fs from "fs";
import * as util from "util";
import { assert } from "chai";
import { ActivityBar, By, DebugConsoleView, DebugView, EditorView, ExtensionsViewSection, InputBox, Key, NotificationType, QuickOpenBox, SideBarView, TerminalView, TextEditor, VSBrowser, WebDriver, WebElement, WebView, Workbench } from "vscode-extension-tester";
import { LoggerAggregator as logger } from "./Logger";
import { exec } from "child_process";
import axios from "axios";
import { IVsCodeTask, ICcppConfiguration, INotification, IThread, IBreakpoint, IConditionalBreakpoint } from "../models";
import { SimdLane, SimdLaneDetails } from "../models/IThread";
import { ThreadProperties, ConditionalBreakpointTypes, OneApiDebugPane } from "./Enums";

const execAsync = util.promisify(exec);
const dotVscodePath = "../array-transform/.vscode";
const ccppPropertiesFilePath = `${dotVscodePath}/c_cpp_properties.json`;
const tasksJsonFilePath = `${dotVscodePath}/tasks.json`;
const launchJsonPath = `${dotVscodePath}/launch.json`;

/**
 * Generates launch task by given @param taskName
 * @param taskName Task name to generate.
 */
export async function GenerateTaskTest(taskName: string): Promise<void> {
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
export async function GenerateDebugLaunchConfigurationTest(): Promise<void> {
    logger.Info("Generate debug launch configuration");
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    try {
        await LaunchSequence();
        await SetBreakpoint(breakpoint);
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(breakpoint),
            `Breakpoint ${breakpoint.fileName}:${breakpoint.lineNumber} has not been hit`);
        logger.Pass(`Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has been hit.`);
        assert.isTrue(
            await CheckIfTaskWasExecuted("preTask", "simple preTask"),
            "Task 'preTask' was not executed");
        logger.Pass("Task 'preTask' was executed");
        await StopDebugging();
        assert.isTrue(
            await CheckIfTaskWasExecuted("postTask", "simple postTask"),
            "Task 'postTask' was not executed");
        logger.Pass("Task 'postTask' was executed");
    } catch (e) {
        logger.Exception(e);
        throw e;
    } finally {
        await CleanUp();
    }
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

    for (const notification of notifications) {
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
export async function CheckOnlineHelpTest(): Promise<void> {
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
export async function CheckOfflineHelpPageTest(): Promise<void> {
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
    await SetBreakpoint(breakpoint);
    try {
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(breakpoint),
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
        await selectedLane?.click();
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
        throw e;
    } finally {
        await StopDebugging();
    }
}

/**
 * Checks if current thread is the same in debug console and oneapi gpu threads window.
 */
export async function ValidateOneApiGpuThreadsTest(threadProperty: ThreadProperties): Promise<void> {
    logger.Info(`Validate OneAPI GPU Threads - Check threads ${threadProperty.toString()}`);
    const breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

    await LaunchSequence();
    await SetBreakpoint(breakpoint);
    try {
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(breakpoint),
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
        let linesPrev: string | string[] = [];
        const threadsNumber = (await GetGpuThreads()).length;
        let currentIteration = 1;

        while (currentIteration < threadsNumber) {
            logger.Info(`Iteration ${currentIteration}`);
            const gpuThreadsParsed = await GetGpuThreads();
            const consoleOutput = await GetDebugConsoleOutput();
            const linesNext = consoleOutput.filter(x => x.includes(`at ${breakpoint.fileName}:${breakpoint.lineNumber}`));
            const currentBpInfo = linesNext.filter(x => !linesPrev.includes(x))[0];
            const currentThread = gpuThreadsParsed.find(x => x.simdLanes.find(y => y.current)) as IThread;
            let result = false;

            switch (threadProperty) {
            case ThreadProperties.Id:
                result = currentBpInfo.includes(`${currentThread.threadId - 2}`);
                break;
            case ThreadProperties.Location:
                result = currentBpInfo.includes(currentThread.location);
                break;
            }
            logger.Info(`Current thread in gpu threads view: ${currentThread}`);
            logger.Info(`Current thread in debug console view: ${currentBpInfo}`);
            logger.Info(`Check if thread ${threadProperty} is the same in debug console and gpu threads view.`);
            assert.isTrue(result, "Threads are different");
            logger.Pass(`Thread ${threadProperty} is the same in debug console and gpu threads view`);
            await ContinueDebugging();
            linesPrev = linesNext;
            currentIteration++;
        }
    } catch (e) {
        logger.Exception(e);
        throw e;
    } finally {
        await Retry(async() => {
            await Wait(2 * 1000);
            await StopDebugging();
        }, 10 * 1000, true);
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

/**
 * Sets conditional breakpoint and checks if has been hit on condition met.
 * @param breakpointType Breakpoint type to use.
 */
export async function SimdLaneConditionalBreakpointTest(testSuite: { breakpointType: ConditionalBreakpointTypes; paneToCheck: OneApiDebugPane } ): Promise<void> {
    const breakpointType = testSuite.breakpointType;
    const paneToCheck = testSuite.paneToCheck;

    logger.Info(`SimdLaneConditionalBreakpointTest | { breakpointType: '${breakpointType}'; paneToCheck: '${paneToCheck}' }`);
    const initialBreakpoint: IBreakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };
    const simdBreakpoint = breakpointType === ConditionalBreakpointTypes.SimdCommand || breakpointType === ConditionalBreakpointTypes.SimdGui;

    await LaunchSequence();
    await SetBreakpoint(initialBreakpoint);
    try {
        await StartDebugging();
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(initialBreakpoint),
            `Breakpoint ${initialBreakpoint.fileName}:${initialBreakpoint.lineNumber} has not been hit`);
        logger.Pass(`Breakpoint '${initialBreakpoint.fileName}:${initialBreakpoint.lineNumber}' has been hit.`);
        assert.isTrue(
            await CheckIfTaskWasExecuted("preTask", "simple preTask"),
            "Task 'preTask' was not executed");
        logger.Pass("Task 'preTask' was executed");

        await RemoveAllBreakpoints();
        const workbench = new Workbench();
        const input = await workbench.openCommandPrompt();

        await ClearInputText(input);
        await SetInputText(input, "> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const gpuThreads = await GetGpuThreads();
        const currentThread = gpuThreads.find(x => x.simdLanes.find(y => y.current)) as IThread;
        const gpuThreadExceptCurrent = gpuThreads.filter(x => x !== currentThread);
        const threadToSetBpOn = gpuThreadExceptCurrent[Math.floor(Math.random() * gpuThreadExceptCurrent.length)];
        const simdLaneId = GetRandomInt(1, 8); // Random SIMD lane between 1 and 7
        const conditions = (() => {
            let condition;

            return {
                SimdCommand: `${threadToSetBpOn.threadId}:${simdLaneId}`,
                SimdGui: `-break-insert -p ${threadToSetBpOn.threadId} -l ${simdLaneId}`,
                NativeCommand: (condition = `$_thread + 2 == ${threadToSetBpOn.threadId}`),
                NativeGui: condition,
            };
        })();
        const C_BP_61: IConditionalBreakpoint = { fileName: "array-transform.cpp", lineNumber: 61, type: breakpointType, condition: conditions[breakpointType] };

        await SetConditionalBreakpoint(C_BP_61);
        await ContinueDebugging();

        
        let exceptionDescription: string | unknown = undefined;
        let breakpointSignature: string | unknown = undefined;

        if (simdBreakpoint) {
            let exceptionPopup = null;

            await Retry(async() => {
                exceptionPopup = await workbench.getDriver().findElement(By.className("zone-widget-container exception-widget"));
                exceptionDescription = await exceptionPopup.findElement(By.className("description")).getText();
            }, 10 * 1000);

            assert.isTrue(exceptionPopup !== undefined, "Cannot find 'breakpoint hit' exception popup");
            logger.Pass("Exception popup found!");
            breakpointSignature = GetStringBetweenStrings(exceptionDescription as string, "Hit ", " at");
            breakpointSignature = `${(breakpointSignature as string)[0].toUpperCase()}${(breakpointSignature as string).slice(1)}`;
        }
        assert.isTrue(
            await CheckIfBreakpointHasBeenHit(C_BP_61),
            `Breakpoint ${C_BP_61.fileName}:${C_BP_61.lineNumber} has not been hit`);
        logger.Pass(`Breakpoint '${C_BP_61.fileName}:${C_BP_61.lineNumber}' has been hit.`);

        const gpuThreadsParsed = await GetGpuThreads();
        const gpuThreadsViewBpInfo = gpuThreadsParsed.find(x => x.simdLanes.find(y => y.current)) as IThread;
        const simdLane  = gpuThreadsViewBpInfo.simdLanes.find(x => x.current);
        const consoleOutput = await GetDebugConsoleOutput();
        const consoleBpInfo = consoleOutput.find(x => {
            return x.includes(`.${gpuThreadsViewBpInfo.threadId -2}`) &&
                simdBreakpoint ? x.includes(breakpointSignature as string) : true &&
                simdBreakpoint ? simdLaneId === (simdLane as SimdLane).laneId && x.includes(`SIMD lane ${(simdLane as SimdLane).laneId}`) : true &&
                x.includes(`at ${C_BP_61.fileName}:${C_BP_61.lineNumber}`);
        });

        assert.isTrue(consoleBpInfo !== undefined, "Cannot find breakpoint info");
        logger.Pass("Conditional BP has been hit!");
        logger.Info(`Breakpoint info: '${C_BP_61.fileName}:${C_BP_61.lineNumber}' | '${C_BP_61.condition}' | '${C_BP_61.type}'`);
        if (simdBreakpoint) { logger.Info(`Conditional BP exception message: '${exceptionDescription}'`); }
        logger.Pass(`Thread info: '${consoleBpInfo}'`);
        logger.Info(`Check if '${paneToCheck}' debug pane contains expected info`);

        switch (paneToCheck) {
        case OneApiDebugPane.HardwareInfo:
            await CheckIfHwInfoViewContainsExpectedInfo();
            break;
        case OneApiDebugPane.OneApiGpuThreads:
            const BP_62 = { fileName: "array-transform.cpp", lineNumber: 62 };

            await CheckIfGpuThreadsViewContainsExpectedInfo();
            await RemoveAllBreakpoints();
            await SetBreakpoint(BP_62);
            await SetInputText(undefined, "> View: Focus Active Editor Group");
            await ContinueDebugging();

            assert.isTrue(
                await CheckIfBreakpointHasBeenHit(BP_62),
                `Breakpoint ${BP_62.fileName}:${BP_62.lineNumber} has not been hit`);
            logger.Pass(`Breakpoint '${BP_62.fileName}:${BP_62.lineNumber}' has been hit.`);
            await CheckIfGpuThreadsViewContainsExpectedInfo();
            break;
        case OneApiDebugPane.SelectedLane:
            await CheckIfSelectedLaneViewContainsExpectedInfo(simdBreakpoint ? simdLaneId : 0);
            break;
        default:
            throw new Error(`Unrecognized member of ${typeof paneToCheck}. Member: ${paneToCheck}`);
        }
    } catch (e) {
        logger.Exception(e);
        throw e;
    } finally {
        await CleanUp();
    }
}

async function CleanUp(): Promise<void> {
    await StopDebugging(false);
    await SetInputText(undefined, "> Terminal: Kill All Terminals");
}

async function CheckIfSelectedLaneViewContainsExpectedInfo(expectedLaneID: number) {
    type LaneContainingPane = `${OneApiDebugPane.SelectedLane}` | `${OneApiDebugPane.OneApiGpuThreads}` | "DebugConsole";
    const getSelectedLaneViewContent = async(): Promise<string[]> => {
        let selectedLaneViewContent: string[] = [];
        const selectedLane = await GetDebugPane("Selected Lane Section");

        await selectedLane?.click();
        const workbench = new Workbench();
        const driver = workbench.getDriver();
        const outerFrames = await driver.findElements(By.css("iframe"));
    
        for (const outerFrame of outerFrames) {
            await ExecuteInIFrame(outerFrame, async driver => {
                const innerFrame = await driver.findElement(By.css("#active-frame"));
                const frameTitle = await innerFrame.getAttribute("title");
    
                logger.Info(`FRAME : ${frameTitle}`);
                if (frameTitle !== "Selected Lane") { return; }
                await ExecuteInIFrame(innerFrame, async driver => {
                    try {
                        selectedLaneViewContent = (await driver.findElement(By.css("tbody")).getText()).split("\n");
                    } catch (e) {
                        logger.Exception(e);
                    }
                });
            });
            if (selectedLaneViewContent.length >= 1) {break;}
        }
        await selectedLane?.click();
        return selectedLaneViewContent;
    };
    const checkIfSelectedLaneViewContainsExpectedLane = async(expectedLaneId: number): Promise<void> => {
        const actualLaneId = await getLaneNumberFromSelectedLaneView();

        logger.Info(`Check if expected lane number '${expectedLaneId}' match with one inside 'Selected lane view'`);
        assert.deepEqual(actualLaneId, expectedLaneId,
            `Expected lane number '${expectedLaneId}' doesn't match with one inside 'Selected lane view'. Expected: ${expectedLaneId} | Actual: ${actualLaneId}`);
        logger.Pass(`Expected lane number '${expectedLaneId}' match with one inside 'Selected lane view'`);
    };
    const getLaneNumberFromSelectedLaneView = async(): Promise<number> => {
        const laneNumber = await Retry(async() => {
            await Wait(3000);
            const selectedLaneViewContent = await getSelectedLaneViewContent();
            const laneNumber = selectedLaneViewContent.find(x => x.includes("Lane Number: "));
            const laneNumberParsed = Number(laneNumber?.split(" ")[2]);

            if (isNaN(laneNumberParsed)) { throw new Error("Fetching lane number from 'Selected Lane' view failed;"); };
            return laneNumberParsed;
        }, 60 * 1000, true);

        return laneNumber as number;
    };
    const getLaneNumberFromConsoleView = async(): Promise<number> => {
        const consoleOutput = await GetDebugConsoleOutput();

        return Number(GetStringBetweenStrings(consoleOutput.join("\n").match(/\[Switching to Thread \d+.\d+ lane \d+\]/gm)?.pop() as string, "lane ", "]"));
    };
    const getLaneNumberFromThreadView = async(): Promise<number> => {
        const currentThread = await getCurrentThread();

        return currentThread.simdLanes.find(x => x.current)?.laneId as number;
    };
    const getCurrentThread = async(): Promise<IThread> => {
        const gpuThreads = await GetGpuThreads();

        return gpuThreads.find(t => t.simdLanes.find(l => l.current)) as IThread;
    };
    const checkIfLaneIdMatchesLanesFromOtherViews = async(expectedLaneId: number, panes: LaneContainingPane[]): Promise<void> => {
        type Getter = { [key in LaneContainingPane]: () => Promise<number>; };
        type Lane = { pane: string; laneId: number };
        const getters: Getter = {
            "SelectedLane": getLaneNumberFromSelectedLaneView,
            "OneApiGpuThreads": getLaneNumberFromThreadView,
            "DebugConsole": getLaneNumberFromConsoleView
        };
        const lanes: Lane[] = [];
        
        for (const pane of panes) {
            const laneId = await getters[pane]();

            lanes.push({ pane: pane, laneId: laneId });
        };
        logger.Info(`Check if expected lane '${expectedLaneId}' is equal to\n${lanes.map(l => `${l.pane}ViewLaneNumber: ${l.laneId}`).join("\n")}`);
        assert.isTrue(lanes.every(x => x.laneId === expectedLaneId), "Lane Ids are not equal to each other");
        logger.Pass(`Expected lane '${expectedLaneId}' is equal to other lane ids`);
    };

    logger.Info("Check if selected lane shows currently selected lane id");
    await checkIfSelectedLaneViewContainsExpectedLane(expectedLaneID);
    await checkIfLaneIdMatchesLanesFromOtherViews(expectedLaneID, ["SelectedLane", "OneApiGpuThreads", "DebugConsole"]);

    logger.Info("Check if 'current' lane indicator is present '⇨'");
    const currentLane = (await getCurrentThread()).simdLanes.find(y => y.current) as SimdLane;

    logger.Info(`Check if current lane indicator '⇨' is present on current lane '${currentLane.laneId}'`);
    assert.strictEqual(currentLane.indicator, "⇨", `Current lane indicator '⇨' is not present on current lane '${currentLane.laneId}'`);
    logger.Info(`Current lane indicator '⇨' is present on current lane '${currentLane.laneId}'`);
    const randomLaneIdToSelect = Array(8).fill(0).map((_, i) => i).filter(x => x !== expectedLaneID && x !== 0)[GetRandomInt(0, 6)];

    logger.Info("Set simd lane from GUI and check if it changed in selected lane view");
    await SetSimdLaneFromGui(randomLaneIdToSelect);
    await checkIfSelectedLaneViewContainsExpectedLane(randomLaneIdToSelect);

    logger.Info("Refresh gpu thread view and check lanes again");
    await RefreshGpuThreadsView();
    await checkIfLaneIdMatchesLanesFromOtherViews(randomLaneIdToSelect, ["SelectedLane", "OneApiGpuThreads"]);
}

function GetRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

async function CheckIfGpuThreadsViewContainsExpectedInfo() {
    const consoleOutput = await GetDebugConsoleOutput();
    const breakpointHits = consoleOutput.join("\n").match(/Thread.*hit.*with SIMD lane.*at.*/gm) as string[];
    const lastLaneSwitch = consoleOutput.join("\n").match(/\[Switching to Thread \d+.\d+ lane \d+\]/gm)?.pop();
    const lastLaneSwitchId = GetStringBetweenStrings(lastLaneSwitch as string, "lane ", "]");
    const lastBreakpointHit = breakpointHits.pop() as string;
    const lineHit = (lastBreakpointHit.match(/(?<=lane )(\d)(?=,)|(?<=\[)(.*)(?=])/gm) as string[])[0];
    const elements = lineHit.split("-").map(x => Number(x));
    const laneIDs = elements.length === 2 ?
        Array.from({ length: (elements[1] - elements[0]) + 1 }, (_, index) => elements[0] + index) :
        [ elements[0] as number ];
    const threadId = Number((lastBreakpointHit.match(/(?<=\.)(.*)(?= hit)/gm) as string[])[0]) + 2;
    const gpuThreads = await GetGpuThreads();
    const currentThread = gpuThreads.find(x => x.threadId === threadId) as IThread;

    logger.Info("Check if current lane is marked as current in OneAPI GPU threads view");
    assert.strictEqual(currentThread.simdLanes.find(x => x.current)?.laneId, Number(lastLaneSwitchId), "Current lane is not marked as current in OneAPI GPU threads view");
    logger.Info("Current lane is marked as current in OneAPI GPU threads view");
    laneIDs.forEach((v) => {
        logger.Info(`Check if lane '${v}' of thread '${threadId}' is marked as 'Hit'`);
        assert.strictEqual(currentThread.simdLanes[v].state, "Hit", `Lane '${v}' of thread '${threadId}' isn't marked as 'Hit'`);
        logger.Pass(`Lane '${v}' of thread '${threadId}' is marked as 'Hit'`);
    });
}

async function CheckIfHwInfoViewContainsExpectedInfo() {
    let hwInfoViewContent: string[] = [];
    const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
    const hwInfo = await GetDebugPane("Hardware Info Section");

    await hwInfo?.click();
    const workbench = new Workbench();
    const driver = await workbench.getDriver();
    const outerFrames = await driver.findElements(By.css("iframe"));

    for (const outerFrame of outerFrames) {
        await ExecuteInIFrame(outerFrame, async driver => {
            const innerFrame = await driver.findElement(By.css("#active-frame"));
    
            await ExecuteInIFrame(innerFrame, async driver => {
                try {
                    hwInfoViewContent = (await driver.findElement(By.css("table.content")).getText()).split("\n");
                } catch (e) {
                    logger.Exception(e);
                }
            });
        });
        if (hwInfoViewContent.length >= 1) {break;}
    }
    await hwInfo?.click();
    const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");

    logger.Info("Check if 'HARDWARE INFO' view contains expected info");
    assert.isTrue(hwInfoViewContent?.includes(`Name: ${deviceName}`),
        `Device name doesn't match.\nExpected: ${deviceName}\nActual: ${hwInfoViewContent?.join(", ")}`);
    logger.Pass(`'HARDWARE INFO' view contains expected info.\nExpected: ${deviceName}\nActual: ${hwInfoViewContent?.join(", ")}`);
}

async function SetSimdLaneFromGui(laneToSet: number): Promise<void> {
    logger.Info(`SetSimdLaneFromGui | laneToSet: ${laneToSet}`);
    const gpuThreads = await GetGpuThreads();
    const currentThread = gpuThreads.find(x => x.simdLanes.find(x => x.current)) as IThread;
    const laneToSelect = currentThread.simdLanes.find(x => x.laneId === laneToSet) as SimdLane;

    const workbench = new Workbench();
    const driver = workbench.getDriver();
    const outerFrames = await driver.findElements(By.css("iframe"));
    
    for (const outerFrame of outerFrames) {
        await ExecuteInIFrame(outerFrame, async driver => {
            const innerFrame = await driver.findElement(By.css("#active-frame"));
            const frameTitle = await innerFrame.getAttribute("title");

            logger.Info(`FRAME : ${frameTitle}`);
            if (frameTitle !== "oneAPI GPU Threads") { return; }
            await ExecuteInIFrame(innerFrame, async() => {
                try {
                    await laneToSelect.handle.click();
                } catch (e) {
                    logger.Exception(e);
                }
            });
        });
    }
}

async function StopDebugging(throwOnException: boolean = true): Promise<void> {
    try {
        logger.Info("Stop debugging");
        const driver = new Workbench().getDriver();
        const stopButton = await driver.findElement(By.css("a.action-label.codicon.codicon-debug-stop"));

        await stopButton.click();
    } catch (e) {
        logger.Exception(e);
        if (throwOnException) {throw e;}
    }
}

async function ContinueDebugging(): Promise<void> {
    logger.Info("Continue debugging");
    const driver = new Workbench().getDriver();
    const stopButton = await driver.findElement(By.css("a.action-label.codicon.codicon-debug-continue"));

    await stopButton.click();
}

async function RefreshGpuThreadsView(): Promise<void> {
    logger.Info("Refresh gpu threads view");
    const gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section") as WebElement;

    await Wait(3 * 1000);
    const buttons = await gpuThreadsView.findElements(By.xpath("//*/div[3]/div/div/ul/li/a"));

    for (const button of buttons) {
        const value = await button.getAttribute("aria-label");

        if (value === "Intel oneAPI: Refresh SIMD Data") {
            await button.click();
            return;
        }
    }
}

async function GetGpuThreads(): Promise<IThread[]> {
    const gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");
    const gpuThreadsViewClass = await gpuThreadsView?.getAttribute("class");

    if (!gpuThreadsViewClass?.includes("expanded")) {
        await gpuThreadsView?.click();
    }
    await RefreshGpuThreadsView();
    await Wait(3 * 1000);
    const gpuThreadsObj: IThread[] = [];

    await ExecuteInIFrame(null, async() => {
        await ExecuteInIFrame(null, async driver => {
            const gpuThreads = await driver.findElement(By.id("simd-view"));
            const gpuThreadsRows = await gpuThreads.findElements(By.css("#simd-view > tbody > tr:not(:first-child)"));

            for (const row of gpuThreadsRows) {
                const rowData = await row.findElements(By.css("td"));
                const rowParsed = [];
                const simdLanes: SimdLane[] = [];

                for (const data of rowData) {
                    const rowClass = await data.getAttribute("class");
                    const rowId = await data.getAttribute("id");

                    if (rowId) {
                        const simdDetails = JSON.parse(rowId) as SimdLaneDetails;
                        const current = rowClass.includes("current");
                        const active = rowClass.includes("colored");
                        const hit = rowClass.includes("hitCell");
                        let indicator: string | undefined = undefined;

                        try { indicator = await (await data.findElement(By.css("span"))).getText();}
                        catch { /* empty */ }
                        
                        simdLanes.push({
                            laneId: simdDetails.lane,
                            current: current,
                            state: hit ? "Hit" : active ? "Active" : "Inactive",
                            details: simdDetails,
                            indicator: indicator,
                            handle: data
                        });
                        continue;
                    }
                    const rowDataText = await data.getText();
                    const index = rowData.indexOf(data);

                    if (index !== 4 ) { rowParsed.push(rowDataText); }
                }
                gpuThreadsObj.push({
                    threadId: parseInt(rowParsed[0]),
                    targetId: rowParsed[1],
                    location: rowParsed[2],
                    workGroup: rowParsed[3],
                    simdLanes: simdLanes
                });
            }
        });
    });

    return gpuThreadsObj;
}

async function CheckIfBreakpointHasBeenSet(breakpoint: IBreakpoint): Promise<boolean> {
    logger.Info(`Check if '${breakpoint.fileName}:${breakpoint.lineNumber}' breakpoint has been set`);
    const breakpointsPaneHeader = await GetDebugPane("Breakpoints Section");
    const breakpointsPane = await breakpointsPaneHeader?.findElement(By.xpath("./../div[2]"));
    const breakpoints = await breakpointsPane?.findElements(By.className("monaco-list-row")) as WebElement[];
    const breakpointsParsed = await Promise.all(breakpoints?.map(async x => {
        return {
            Enabled: await x.getAttribute("aria-checked"),
            Details: await x.getAttribute("aria-label")
        };
    }));
    const matches = breakpointsParsed?.filter(x => Boolean(x.Enabled) && x.Details.includes(`${breakpoint.fileName} ${breakpoint.lineNumber}`));
    
    logger.Info(matches.map(x => `Enabled: ${x.Enabled} | Details: ${x.Details}`).join("\n"));
    assert.isTrue(matches?.length !== 0, `Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has not been set`);
    logger.Pass(`Breakpoint '${breakpoint.fileName}:${breakpoint.lineNumber}' has been set`);
    return matches?.length !== 0;
}

async function GetConditionalBreakpointExpressionInput(lineNumber: number) {
    const textEditor = new TextEditor();
    const lineNumbers = await textEditor.findElements(By.className("line-numbers lh-odd"));
    let bpLine = undefined;

    for (const line of lineNumbers) {
        const elementText = await line.getText();

        if (elementText === `${lineNumber}`) {
            bpLine = line;
            break;
        }
    }
    await bpLine?.getDriver().actions().contextClick(bpLine).perform();
    const bpContextMenuItems = await textEditor.getDriver().findElements(By.className("action-label"));
    let addConBpButton: WebElement | undefined = undefined;

    for (const menuItem of bpContextMenuItems as WebElement[]) {
        const itemText = await menuItem.getText();

        if (itemText === "Add Conditional Breakpoint...") {
            addConBpButton = menuItem;
        }
    }
    await addConBpButton?.click();
    await Wait(3 * 1000);
    const conditionExpressionInputBox = await addConBpButton?.getDriver().findElement(By.css("div.inputContainer > div > div > textarea.inputarea.monaco-mouse-cursor-text"));

    if (conditionExpressionInputBox === undefined) { throw new Error("Cannot find conditional BP expression input box"); }
    return conditionExpressionInputBox;
}

async function SetConditionalBreakpoint(breakpoint: IConditionalBreakpoint) {
    logger.Info("Set conditional breakpoint");
    const workbench = new Workbench();
    const [fileName, lineNumber] = [breakpoint.fileName, breakpoint.lineNumber];
    let input = await workbench.openCommandPrompt();

    await input.cancel();
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input, "> Go to File...");
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
    logger.Info(`Toggle conditional breakpoint at '${breakpoint.fileName}:${breakpoint.lineNumber}'` +
        `with condition '${breakpoint.condition}' using '${breakpoint.type}'`);
    switch (breakpoint.type) {
    case ConditionalBreakpointTypes.SimdGui:
    case ConditionalBreakpointTypes.NativeGui: {
        let conditionExpressionInputBox: WebElement | undefined;

        await Retry(async() => {
            conditionExpressionInputBox = await GetConditionalBreakpointExpressionInput(breakpoint.lineNumber);
        }, 30 * 1000);
        
        await conditionExpressionInputBox?.sendKeys(breakpoint.condition);
        await conditionExpressionInputBox?.sendKeys(Key.ENTER);
        await textEditor.click();
        break; }
    case ConditionalBreakpointTypes.SimdCommand:
        input = await workbench.openCommandPrompt();
        input = await ClearInputText(input);
        input = await SetInputText(input, "> Intel oneAPI: Add SIMD lane conditional breakpoint");
        input = await SetInputText(input, breakpoint.condition);
        await textEditor.click();
        break;
    case ConditionalBreakpointTypes.NativeCommand:
        input = await workbench.openCommandPrompt();
        input = await ClearInputText(input);
        input = await SetInputText(input, "> Debug: Add Conditional Breakpoint...");
        const conditionExpressionInputBox = await input.getDriver().findElement(By.css("div.inputContainer > div > div > textarea.inputarea.monaco-mouse-cursor-text"));

        await conditionExpressionInputBox?.sendKeys(breakpoint.condition);
        await conditionExpressionInputBox?.sendKeys(Key.ENTER);
        await textEditor.click();
        break;
    default:
        const exception = new Error(`Unknown 'ConditionalBreakpointTypes' member of ${breakpoint.type}`);

        logger.Exception(exception);
        throw exception;
    }
    await Wait(1 * 1000);
    const res = await CheckIfBreakpointHasBeenSet(breakpoint);
    const bpSetOrRemoved = res ? "set" : "removed";

    logger.Info(`Breakpoint at line ${lineNumber} has been ${bpSetOrRemoved}`);
    return res;
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
        if (!result) { throw new Error(); }
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
    const ccppPropertiesFileContent: { configurations: Array<ICcppConfiguration> } = JSON.parse(fs.readFileSync(ccppPropertiesFilePath, "utf-8"));

    const exists = ccppPropertiesFileContent.configurations.some((x: ICcppConfiguration) => x === ccppProperties.configurations[0]);

    if (!exists) {
        ccppPropertiesFileContent.configurations.push(ccppProperties.configurations[0]);
    }
}

async function CloseAllNotifications(): Promise<void> {
    try {
        const workbench = new Workbench();
        const input = await workbench.openCommandPrompt();

        await SetInputText(input, "> Notifications: Clear All Notifications");
    } catch (e) {
        logger.Exception(e);
    }
}

async function Retry<TResult>(fn: () => TResult, timeout: number, throwOnTimeout: boolean = false): Promise<TResult | undefined> {
    const startTime = Date.now();
    let currentTime = startTime;
    let result: TResult | undefined;
    let eleapsed = currentTime - startTime;
    let iteration = 1;

    logger.Info("Retry");
    while (eleapsed < timeout) {
        logger.Info(`Iteration ${iteration} | Elapsed ${eleapsed} ms`);
        eleapsed = currentTime - startTime;
        try {
            result = await fn();
            break;
        } catch (e) {
            logger.Exception(e);
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

async function CheckIfTaskWasExecuted(taskName: string, expectedOutput: string): Promise<boolean> {
    logger.Info(`Get '${taskName}' task terminal`);
    await CloseAllNotifications();
    const workbench = new Workbench();
    let input: InputBox | QuickOpenBox | undefined = new InputBox();

    await Wait(3 * 1000);
    input = await Retry(async() => {
        input = await workbench.openCommandPrompt();

        input = await ClearInputText(input);
        return input;
    }, 10 * 1000);
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

        if (name.includes(terminalName)) { terminalFound = terminal; }
    }
    const taskLabel = terminalFound?.findElement(By.className("label-name"));

    await taskLabel?.click();
    const terminal = new TerminalView();

    logger.Info(`Get '${terminalName}' terminal text`);
    const innerText = await Retry(async() => await terminal.getText(), 5 * 1000);

    return innerText;
}

async function CheckIfBreakpointHasBeenHit(breakpoint: IBreakpoint | IConditionalBreakpoint): Promise<boolean> {
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
    let retries = 1;
    let line;

    while (retries <= 5 && !line) {
        logger.Info(`Check if breakpoint '${breakpointStr}' has been hit. Attempt ${retries}`);
        await Wait(1000);
        const debugOutput = await debugOutputWindow.getText();
        const lines = debugOutput.split("\n");

        line = lines.find(x => x.includes(breakpointStr));
        retries++;
    }
    logger.Info(`Breakpoint: ${breakpointStr} ${line ? "has been hit" : "has not been hit"}`);
    return line !== undefined && line !== null;
}

async function SetInputText(input: QuickOpenBox | InputBox | undefined, command: string): Promise<QuickOpenBox | InputBox> {
    if (input === undefined){
        const workbench = new Workbench();

        input = await workbench.openCommandPrompt();
    }
    logger.Info(`Set command palette text to '${command}'`);
    await input.setText(command);
    await Wait(1 * 1000);
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

async function SetBreakpoint(breakpoint: IBreakpoint): Promise<boolean> {
    const workbench = new Workbench();
    const [fileName, lineNumber] = [breakpoint.fileName, breakpoint.lineNumber];
    let input = await workbench.openCommandPrompt();

    await input.cancel();
    input = await workbench.openCommandPrompt();
    input = await ClearInputText(input);
    input = await SetInputText(input, "> Go to File...");
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
    input = await SetInputText(input, "> Debug: Inline Breakpoint");
    await Wait(1 * 1000);
    const res = await CheckIfBreakpointHasBeenSet(breakpoint);
    const bpSetOrRemoved = res ? "set" : "removed";

    logger.Info(`Breakpoint at line ${lineNumber} has been ${bpSetOrRemoved}`);
    return res;
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

async function IsExtensionInstalled(extensionName: string): Promise<boolean | undefined> {
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