/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { CheckIfBreakpointHasBeenHit, CheckIfBreakpointHasBeenSet, CleanUp, ExecuteInIFrame, GetDebugConsoleOutput, GetDebugPane, GetTerminalOutput,
    LaunchSequence, RemoveAllBreakpoints, Retry, SetBreakpoint, SetInputText, Wait } from "../utils/CommonFunctions";
import { By, EditorView, Key, TextEditor, VSBrowser, WebDriver, WebElement, Workbench } from "vscode-extension-tester";
import { LoggerAggregator as logger } from "../utils/Logger";
import { ConditionalBreakpoint, ConditionalBreakpointType, OneApiDebugPane } from "../utils/Types";
import { assert } from "chai";
import { DEFAULT_BREAKPOINT } from "../utils/Consts";

type Thread = {
    threadId: number;
    targetId: string;
    location: string;
    workGroup: string;
    simdLanes: SimdLane[];
};
type SimdLane = {
    laneId: number;
    current: boolean;
    state: "Active" | "Inactive" | "Hit";
    details: SimdLaneDetails;
    indicator: string | undefined;
    handle: WebElement;
};
type SimdLaneDetails =  {
    lane: number;
    name: string;
    threadId: number;
    executionMask: string;
    hitLanesMask: string;
    length: number;
};
type LaneContainingPane = `${OneApiDebugPane.SelectedLane}` | `${OneApiDebugPane.OneApiGpuThreads}` | "DebugConsole";
type ThreadProperty = "Id" | "Location";

export default function() {
    describe("Examine debugging functionality", () => {
        it("Refresh SIMD data", async function() {
            this.timeout(5 * this.test?.ctx?.defaultTimeout);
            await RefreshSimdDataTest(); 
        });
        for (const threadInfo of [
            "Id",
            "Location"
        ] as ThreadProperty[]) {
            it(`Check threads ${threadInfo}`, async function() {
                this.timeout(5 * this.test?.ctx?.defaultTimeout);
                await ValidateOneApiGpuThreadsTest(threadInfo); 
            });
        }
        for (const simdTestSuite of [
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.SelectedLane },
        ]) {
            it(`SIMD lane conditional breakpoint [${simdTestSuite.breakpointType}] [${simdTestSuite.paneToCheck}]`, async function() {
                this.timeout(5 * this.test?.ctx?.defaultTimeout);
                this.retries(1);
                await SimdLaneConditionalBreakpointTest(simdTestSuite);
            });
        }
    });
}

//#region Tests

async function RefreshSimdDataTest(): Promise<void> {
    logger.Info("Refresh SIMD data");
    try {
        await LaunchSequence();
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);

        const debugConsoleOutput = await GetDebugConsoleOutput();
        const consoleOutput = debugConsoleOutput
            .filter(x => x.includes("[Switching to thread") || x.includes(`at ${DEFAULT_BREAKPOINT.fileName}:${DEFAULT_BREAKPOINT.lineNumber}`)).join(" ");
        const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
        const gpuThreads = await GetGpuThreads();
        const currentgpuThread = gpuThreads.find(x => x.simdLanes.find(y => y.current))?.threadId;
        const hwInfoViewContent = await GetDebugPaneContent(OneApiDebugPane.HardwareInfo);
        const selectedLaneViewContent = await GetDebugPaneContent(OneApiDebugPane.SelectedLane);
        const bpinfo = await GetCallStackInfo();
        const currentThreadId = Number(GetStringBetweenStrings(bpinfo, "[", "]"));
        const currentThreadLane = GetStringBetweenStrings(consoleOutput, "lane ", ")]");
        const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");

        assert.include(hwInfoViewContent, `Name: ${deviceName}`, `Device name doesn't match.\nExpected: '${deviceName}'\nto be included in ${hwInfoViewContent}`);
        logger.Pass(`Device name matches. Actual: ${deviceName}`);
        assert.include(selectedLaneViewContent, `Lane Number: ${currentThreadLane}`, `Lane number doesn't match.\nExpected: ${currentThreadLane}\nto be included in ${selectedLaneViewContent}`);
        logger.Pass(`Lane number matches. Actual: ${currentThreadLane}`);
        assert.equal(currentThreadId, currentgpuThread, `Current thread doesn't match.\nExpected: ${currentThreadId}\nto be included in ${currentgpuThread}`);
        logger.Pass(`Current thread matches. Actual: ${currentgpuThread}`);
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await Retry(async() => {
            await Wait(2 * 1000);
            await CleanUp();
        }, 10 * 1000, true);
    }
}

async function ValidateOneApiGpuThreadsTest(threadProperty: ThreadProperty): Promise<void> {
    logger.Info(`Validate OneAPI GPU Threads - Check threads ${threadProperty.toString()}`);
    try {
        await LaunchSequence();
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const threadsNumber = (await GetGpuThreads()).length;
        let currentIteration = 1;

        while (currentIteration < threadsNumber) {
            const bpInfoLines = (await GetDebugConsoleOutput())
                .filter(x => x.includes(`at ${DEFAULT_BREAKPOINT.fileName}:${DEFAULT_BREAKPOINT.lineNumber}`));
            const bpInfoLine = bpInfoLines.pop() as string;
            const currentThread = (await GetGpuThreads()).find(x => x.simdLanes.find(y => y.current)) as Thread;
            const properties = {
                "Id": `${currentThread.threadId - 2}`,
                "Location": currentThread.location
            };

            assert.include(bpInfoLine, properties[threadProperty], `Threads are differend.\nExpected: '${bpInfoLine}'\nto include '${properties[threadProperty]}'`);
            logger.Pass(`Thread ${threadProperty} is the same in debug console and gpu threads view.\nCurrent thread info: ${bpInfoLine}`);
            await ContinueDebugging();
            currentIteration++;
        }
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await Retry(async() => {
            await Wait(2 * 1000);
            await CleanUp();
        }, 10 * 1000, true);
    }
}

async function SimdLaneConditionalBreakpointTest({ breakpointType, paneToCheck }: { breakpointType: ConditionalBreakpointType; paneToCheck: OneApiDebugPane } ): Promise<void> {
    logger.Info(`SimdLaneConditionalBreakpointTest | { breakpointType: '${breakpointType}'; paneToCheck: '${paneToCheck}' }`);
    const simdBreakpoint = breakpointType === "SimdCommand" || breakpointType === "SimdGui";

    try {
        await LaunchSequence();
        await RemoveAllBreakpoints();
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const [expectedCondition, expectedSimdLaneId, expectedThread] = await GetBreakpointCondition(breakpointType);
        const C_BP_61: ConditionalBreakpoint = { fileName: "array-transform.cpp", lineNumber: 61, type: breakpointType, condition: expectedCondition };

        await SetConditionalBreakpoint(C_BP_61);
        await ContinueDebugging();
        await CheckIfBreakpointConditionHasBeenMet({
            expectedSimdLaneId: simdBreakpoint ? expectedSimdLaneId : undefined,
            expectedThread: expectedThread,
            breakpoint: C_BP_61
        });
        switch (paneToCheck) {
        case OneApiDebugPane.HardwareInfo:
            await CheckIfHwInfoViewContainsExpectedInfo();
            break;
        case OneApiDebugPane.OneApiGpuThreads:
            const BP_62 = { fileName: "array-transform.cpp", lineNumber: 62 };

            await CheckIfGpuThreadsViewContainsExpectedInfo();
            await RemoveAllBreakpoints();
            await SetBreakpoint(BP_62);
            await SetInputText("> View: Focus Active Editor Group");
            await ContinueDebugging();
            await CheckIfBreakpointHasBeenHit(BP_62);
            await CheckIfGpuThreadsViewContainsExpectedInfo();
            break;
        case OneApiDebugPane.SelectedLane:
            await CheckIfSelectedLaneViewContainsExpectedInfo(simdBreakpoint ? expectedSimdLaneId : 0);
            break;
        default:
            throw new Error(`Unrecognized member of ${typeof paneToCheck}   . Member: ${paneToCheck}`);
        }
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await CleanUp();
    }
}

//#endregion

async function GetExceptionPopupMessage(): Promise<string | undefined> {
    return await Retry(async() => {
        const exceptionPopup = await new Workbench().getDriver().findElement(By.className("zone-widget-container exception-widget"));

        assert.notEqual(exceptionPopup, undefined, "Cannot find 'breakpoint hit' exception popup");
        return await exceptionPopup.findElement(By.className("description")).getText();
    }, 10 * 1000);
}

async function CheckIfBreakpointConditionHasBeenMet(options: {
    expectedSimdLaneId?: number;
    expectedThread: Thread;
    breakpoint: ConditionalBreakpoint;
}): Promise<void> {
    const { expectedSimdLaneId, expectedThread, breakpoint } = options;
    const simdLane  = (await GetCurrentThread())?.simdLanes.find(x => x.current);
    const breakpointSignature = expectedSimdLaneId ? await (async() => {
        const signature = GetStringBetweenStrings(await GetExceptionPopupMessage() as string, "Hit ", " at");

        return `${(signature as string)[0].toUpperCase()}${(signature as string).slice(1)}`;
    })() : undefined;

    assert.notEqual((await GetDebugConsoleOutput()).find(x => x.includes(`.${expectedThread.threadId - 2}`) &&
    expectedSimdLaneId ? x.includes(breakpointSignature as string) : true &&
    expectedSimdLaneId ? expectedSimdLaneId === (simdLane as SimdLane).laneId &&
    x.includes(`SIMD lane ${(simdLane as SimdLane).laneId}`) : true &&
    x.includes(`at ${breakpoint.fileName}:${breakpoint.lineNumber}`)), undefined, "Condition has not been met");
    logger.Pass("Condition has been met");
}

async function GetCurrentThread(): Promise<Thread | undefined> {
    const threads = await GetGpuThreads();

    return threads.find(x => x.simdLanes.find(x => x.current));
}

async function GetBreakpointCondition(breakpointType: ConditionalBreakpointType): Promise<[string, number, Thread]> {
    const gpuThreadsExceptCurrent = (await GetGpuThreads()).filter(x => !x.simdLanes.find(x => x.current));
    const threadToSetBpOn = gpuThreadsExceptCurrent[GetRandomInt(0, gpuThreadsExceptCurrent.length)];
    const simdLaneId = GetRandomInt(1, 8); // Random SIMD lane between 1 and 7
    const conditions = {
        SimdCommand: `${threadToSetBpOn.threadId}:${simdLaneId}`,
        SimdGui: `-break-insert -p ${threadToSetBpOn.threadId} -l ${simdLaneId}`,
        NativeCommand: `$_thread + 2 == ${threadToSetBpOn.threadId}`,
        NativeGui: `$_thread + 2 == ${threadToSetBpOn.threadId}`,
    };

    return [conditions[breakpointType], simdLaneId, threadToSetBpOn];
}

async function SetConditionalBreakpoint(breakpoint: ConditionalBreakpoint) {
    const [fileName, lineNumber] = [breakpoint.fileName, breakpoint.lineNumber];

    await SetInputText(fileName, { input: await SetInputText("> Go to File...") });
    await Wait(1 * 1000);
    const textEditor = new TextEditor(new EditorView());

    await Wait(1 * 1000);
    await textEditor.moveCursor(lineNumber, 1);
    await Wait(1 * 1000);
    switch (breakpoint.type) {
    case ConditionalBreakpointType.SimdGui:
    case ConditionalBreakpointType.NativeGui:
        await Retry(async() => {
            await PerformContextMenuAction(
                await GetLineNumberWebElement(breakpoint.lineNumber) as WebElement, "Add Conditional Breakpoint...");
            await (await GetConditionalBreakpointExpressionInput())?.sendKeys(breakpoint.condition, Key.ENTER);
        }, 30 * 1000);
        break;
    case ConditionalBreakpointType.SimdCommand:
        const input = await SetInputText("> Intel oneAPI: Add SIMD lane conditional breakpoint");

        await SetInputText(breakpoint.condition, { input: input });
        break;
    case ConditionalBreakpointType.NativeCommand:
        await Retry(async() => {
            await SetInputText("> Debug: Add Conditional Breakpoint...");
            await (await GetConditionalBreakpointExpressionInput())?.sendKeys(breakpoint.condition, Key.ENTER);
        }, 30 * 1000);
        break;
    default:
        const exception = new Error(`Unknown 'ConditionalBreakpointTypes' member of ${breakpoint.type}`);

        logger.Error(exception);
        throw exception;
    }
    await textEditor.click();
    await Wait(1 * 1000);
    const result = await CheckIfBreakpointHasBeenSet(breakpoint);

    logger.Info(`Breakpoint at line ${lineNumber} has been ${result ? "set" : "removed"}`);
    return result;
}

function GetStringBetweenStrings(str: string, startStr: string, endStr: string) {
    const pos = str.indexOf(startStr) + startStr.length;

    return str.substring(pos, str.indexOf(endStr, pos));
}

type OneApiDebugPaneFrameTitle = "oneAPI GPU Threads" | "Hardware Info" | "Selected Lane";
async function GetDebugPaneContent(paneToFind: OneApiDebugPane): Promise<string[]> {
    const selectors: { [Prop in OneApiDebugPane]: { selector: By; frameTitle: OneApiDebugPaneFrameTitle }} = {
        "oneAPI GPU Threads Section": { selector: By.id("simd-view"), frameTitle: "oneAPI GPU Threads" },
        "Hardware Info Section": { selector: By.className("content"), frameTitle: "Hardware Info" },
        "Selected Lane Section": { selector: By.css("tbody"), frameTitle: "Selected Lane" }
    };
    const pane = await GetDebugPane(paneToFind) as WebElement;
    const expanded = (await pane.getAttribute("aria-expanded")) === "true";

    if (!expanded) { await pane.click(); }
    const result = await ExecuteInOneApiDebugPaneFrame(async(driver) => {
        return (await driver.findElement(selectors[paneToFind].selector).getText()).split("\n");
    }, selectors[paneToFind].frameTitle);

    return result as string[];
}

async function ContinueDebugging(): Promise<void> {
    logger.Info("Continue debugging");
    const driver = new Workbench().getDriver();
    const stopButton = await driver.findElement(By.css("a.action-label.codicon.codicon-debug-continue"));

    await stopButton.click();
}

async function GetGpuThreads(): Promise<Thread[]> {
    const gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");
    const gpuThreadsViewClass = await gpuThreadsView?.getAttribute("class");

    if (!gpuThreadsViewClass?.includes("expanded")) {
        await gpuThreadsView?.click();
    }
    await RefreshGpuThreadsView();
    await Wait(3 * 1000);
    return await ExecuteInOneApiDebugPaneFrame(async(driver) => {
        const gpuThreadsObj: Thread[] = [];
        const gpuThreads = await driver.findElement(By.id("simd-view"));
        const gpuThreadsRows = await gpuThreads.findElements(By.css("#simd-view > tbody > tr:not(:first-child)"));

        for (const row of gpuThreadsRows) {
            const rowData = await row.findElements(By.css("td"));
            const rowParsed = [];
            const simdLanes: SimdLane[] = [];

            for (const data of rowData) {
                let cellGroup: WebElement | undefined = undefined;

                try { cellGroup = await data.findElement(By.className("cell-group")); }
                catch { /* empty */ }

                if (cellGroup) {
                    const lanes = await cellGroup.findElements(By.css("div"));

                    for (const lane of lanes) {
                        const laneId = await lane.getAttribute("id");
                        const laneClass = await lane.getAttribute("class");
                        const simdDetails = JSON.parse(laneId) as SimdLaneDetails;
                        const current = laneClass.includes("current");
                        const active = laneClass.includes("colored");
                        const hit = laneClass.includes("hitCell");
                        let indicator: string | undefined = undefined;

                        try { indicator = await (await data.findElement(By.css("span"))).getText();}
                        catch { /* empty */ }
                        
                        simdLanes.push({
                            laneId: simdDetails.lane,
                            current: current,
                            state: hit ? "Hit" : active ? "Active" : "Inactive",
                            details: simdDetails,
                            indicator: indicator,
                            handle: lane
                        });
                        continue;
                    }
                }
                let location: string | undefined;

                const rowClass = await data.getAttribute("class");

                if (rowClass === "simdtooltip") {
                    try { location = await (await data.findElement(By.css("span"))).getAttribute("innerHTML");}
                    catch { /* empty */ }
                }
                const rowDataText = await data.getText();
                const index = rowData.indexOf(data);

                if (index !== 4 ) { rowParsed.push(location || rowDataText); }
            }
            gpuThreadsObj.push({
                threadId: parseInt(rowParsed[0]),
                targetId: rowParsed[1],
                location: rowParsed[2],
                workGroup: rowParsed[3],
                simdLanes: simdLanes
            });
        }

        return gpuThreadsObj;
    }, "oneAPI GPU Threads");
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

function GetRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

async function GetLineNumberWebElement(lineNumber: number) {
    const textEditor = new TextEditor();
    const lineNumbers = await textEditor.findElements(By.className("line-numbers lh-odd"));

    return await (async() => {
        for (const line of lineNumbers) {
            const elementText = await line.getText();

            if (elementText === `${lineNumber}`) { return line; }
        }
    })();
}

async function PerformContextMenuAction(element: WebElement, action: string) {
    const driver = new Workbench().getDriver();

    await driver.actions().contextClick(element).perform();
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

async function GetConditionalBreakpointExpressionInput() {
    const conditionExpressionInputBox = await new Workbench().getDriver().findElement(By.css("div.inputContainer > div > div > textarea.inputarea.monaco-mouse-cursor-text"));

    if (!conditionExpressionInputBox) { throw new Error("Cannot find conditional BP expression input box"); }
    return conditionExpressionInputBox;
}

async function CheckIfHwInfoViewContainsExpectedInfo() {
    const hwInfoViewContent = await GetDebugPaneContent(OneApiDebugPane.HardwareInfo);
    const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
    const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");

    assert.include(hwInfoViewContent, `Name: ${deviceName}`, `Device name doesn't match.\nExpected: '${deviceName}'\nto be included in ${hwInfoViewContent}`);
    logger.Pass(`Device name matches. Actual: ${deviceName}`);
}

async function CheckIfGpuThreadsViewContainsExpectedInfo() {
    const consoleOutput = await GetDebugConsoleOutput();
    const lastBreakpointHit = consoleOutput.join("\n").match(/Thread.*hit.*with SIMD lane.*at.*/gm)?.pop() as string;
    const lastLaneSwitch = consoleOutput.join("\n").match(/\[Switching to Thread \d+.\d+ lane \d+\]/gm)?.pop();
    const lastLaneSwitchId = GetStringBetweenStrings(lastLaneSwitch as string, "lane ", "]");
    const currentThread = await GetCurrentThread() as Thread;

    assert.strictEqual(currentThread.simdLanes.find(x => x.current)?.laneId, Number(lastLaneSwitchId), "Current lane is not marked as current in OneAPI GPU threads view");
    logger.Pass("Current lane is marked as current in OneAPI GPU threads view");
    const lineHit = (lastBreakpointHit.match(/(?<=lane )(\d)(?=,)|(?<=\[)(.*)(?=])/gm) as string[])[0];
    const elements = lineHit.split("-").map(x => Number(x));
    const laneIDs = elements.length === 2 ?
        Array.from({ length: (elements[1] - elements[0]) + 1 }, (_, index) => elements[0] + index) :
        [ elements[0] as number ];
    const threadId = Number((lastBreakpointHit.match(/(?<=\.)(.*)(?= hit)/gm) as string[])[0]) + 2;

    laneIDs.forEach((v) => {
        assert.strictEqual(currentThread.simdLanes[v].state, "Hit", `Lane '${v}' of thread '${threadId}' isn't marked as 'Hit'`);
        logger.Pass(`Lane '${v}' of thread '${threadId}' is marked as 'Hit'`);
    });
}

async function GetLaneIdFromView(pane: LaneContainingPane) {
    switch (pane) {
    case "Selected Lane Section":
        return await Retry(async() => {
            await Wait(3000);
            const laneNumber = (await GetDebugPaneContent(OneApiDebugPane.SelectedLane)).find(x => x.includes("Lane Number: "));
            const laneNumberParsed = Number(laneNumber?.split(" ")[2]);

            if (isNaN(laneNumberParsed)) { throw new Error("Fetching lane number from 'Selected Lane' view failed;"); };
            return laneNumberParsed;
        }, 60 * 1000, true) as number;
    case "DebugConsole":
        return Number(GetStringBetweenStrings((await GetDebugConsoleOutput()).reverse().find(x => x.includes("Switching to Thread")) as string, "lane ", "]"));
    case "oneAPI GPU Threads Section":
        return (await GetCurrentThread())?.simdLanes.find(x => x.current)?.laneId as number;
    }
}

async function CheckIfSelectedLaneViewContainsExpectedInfo(expectedLaneID: number) {
    const checkIfSelectedLaneViewContainsExpectedLane = async(expectedLaneId: number): Promise<void> => {
        const selectedLaneViewContent = await GetDebugPaneContent(OneApiDebugPane.SelectedLane);

        assert.include(selectedLaneViewContent, `Lane Number: ${expectedLaneId}`, `Lane number doesn't match.\nExpected: 'Lane Number: ${expectedLaneId}'\nto be included in ${selectedLaneViewContent}`);
        logger.Pass(`Lane number matches. Actual: ${expectedLaneId}`);
    };
    const checkIfLaneIdMatchesLanesFromOtherViews = async(expectedLaneId: number, panes: LaneContainingPane[]): Promise<void> => {
        const lanes = [];

        for (const pane of panes) {   
            lanes.push({ pane: pane, laneId: await GetLaneIdFromView(pane) });
        }
        assert.isTrue(lanes.every(async x => x.laneId === expectedLaneId), "Lane Ids are not equal to each other");
        logger.Pass(`Expected lane '${expectedLaneId}' is equal to other lane ids`);
    };

    logger.Info("Check if selected lane shows currently selected lane id");
    await checkIfSelectedLaneViewContainsExpectedLane(expectedLaneID);
    await checkIfLaneIdMatchesLanesFromOtherViews(expectedLaneID, ["Selected Lane Section", "oneAPI GPU Threads Section", "DebugConsole"]);

    logger.Info("Check if 'current' lane indicator is present '⇨'");
    const currThread = await GetCurrentThread() as Thread;
    const currentLane = currThread.simdLanes.find(y => y.current) as SimdLane;

    logger.Info(`Check if current lane indicator '⇨' is present on current lane '${currentLane.laneId}'`);
    assert.strictEqual(currentLane.indicator, "⇨", `Current lane indicator '⇨' is not present on current lane '${currentLane.laneId}'`);
    logger.Info(`Current lane indicator '⇨' is present on current lane '${currentLane.laneId}'`);
    const randomLaneIdToSelect = Array(8).fill(0).map((_, i) => i).filter(x => x !== expectedLaneID && x !== 0)[GetRandomInt(0, 6)];

    logger.Info("Set simd lane from GUI and check if it changed in selected lane view");
    await SetSimdLaneFromGui(randomLaneIdToSelect);
    await checkIfSelectedLaneViewContainsExpectedLane(randomLaneIdToSelect);

    logger.Info("Refresh gpu thread view and check lanes again");
    await RefreshGpuThreadsView();
    await checkIfLaneIdMatchesLanesFromOtherViews(randomLaneIdToSelect, ["Selected Lane Section", "oneAPI GPU Threads Section"]);
}

async function SetSimdLaneFromGui(laneToSet: number): Promise<void> {
    logger.Info(`SetSimdLaneFromGui | laneToSet: ${laneToSet}`);
    const gpuThreads = await GetGpuThreads();
    const currentThread = gpuThreads.find(x => x.simdLanes.find(x => x.current)) as Thread;
    const laneToSelect = currentThread.simdLanes.find(x => x.laneId === laneToSet) as SimdLane;

    await ExecuteInOneApiDebugPaneFrame(async() => {
        try {
            await laneToSelect.handle.click();
        } catch (e) {
            logger.Error(e);
        }
    }, "oneAPI GPU Threads");
}

async function ExecuteInOneApiDebugPaneFrame<TResult>(body: (driver: WebDriver) => Promise<TResult>, frame: OneApiDebugPaneFrameTitle): Promise<TResult> {
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

async function GetCallStackInfo(): Promise<string> {
    await Wait(2000);
    const pane = await GetDebugPane("Call Stack Section");
    const paneViewClass = await pane?.getAttribute("class");

    if (!paneViewClass?.includes("expanded")) {
        await pane?.click();
    }
    const paneContent = await pane?.findElement(By.xpath("following-sibling::*"));
    const rows = await paneContent?.findElements(By.className("monaco-list-row"));
    let bpinfo = "";

    for (const row of rows as WebElement[]) {
        bpinfo = await row.getAttribute("aria-label");

        if (bpinfo.includes("Paused on breakpoint")) {
            break;
        }
    }

    return bpinfo;
}