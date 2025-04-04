/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { CheckIfBreakpointHasBeenHit, CleanUp, ExecuteInOneApiDebugPaneFrame, GetDebugConsoleOutput, GetDebugPane, GetRandomInt, GetStringBetweenStrings, GetTerminalOutput,
    LaunchSequence, MapTestOptions, Retry, SetBreakpoint, SetInputText, Wait } from "../utils/CommonFunctions";
import { CheckIfBreakpointConditionHasBeenMet, ContinueDebugging, RemoveAllBreakpoints, SetConditionalBreakpoint } from "../utils/Debugging/Debugging";
import { GetGpuThreads, GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";
import { ConditionalBreakpointType, ConditionalBreakpoint } from "../utils/Debugging/Types";
import { OneApiDebugPane, OneApiDebugPaneFrameTitle, TestOptions } from "../utils/Types";
import { SimdLane, Thread } from "../utils/OneApiGpuThreads/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { By, WebElement } from "vscode-extension-tester";
import { DEFAULT_BREAKPOINT, DEVICES } from "../utils/Consts";
import { assert } from "chai";
import { HwInfo } from "../utils/HardwareInfo/Types";

type LaneContainingPane = `${OneApiDebugPane.SelectedLane}` | `${OneApiDebugPane.OneApiGpuThreads}` | "DebugConsole";
type ThreadProperty = "Id" | "Location";

export default function(options: TestOptions) {
    describe(`Examine ${options.remoteTests ? "remote " : ""}debugging functionality`, () => {
        it("Refresh SIMD data", async function() {
            this.timeout(5 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await RefreshSimdDataTest(options);
        });
        for (const threadInfo of [
            "Id",
            "Location"
        ] as ThreadProperty[]) {
            it(`Check threads ${threadInfo}`, async function() {
                this.timeout(5 * this.test?.ctx?.defaultTimeout);
                await ValidateOneApiGpuThreadsTest(threadInfo, options);
            });
        }
        for (const simdTestSuite of [
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.SelectedLane },
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.OneApiGpuThreads },
            { breakpointType: ConditionalBreakpointType.SimdCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.NativeCommand, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.SimdGui, paneToCheck: OneApiDebugPane.HardwareInfo },
            { breakpointType: ConditionalBreakpointType.NativeGui, paneToCheck: OneApiDebugPane.HardwareInfo },
        ]) {
            it(`SIMD lane conditional breakpoint [${simdTestSuite.breakpointType}] [${simdTestSuite.paneToCheck}]`, async function() {
                this.timeout(10 * this.test?.ctx?.defaultTimeout);
                this.retries(2);
                await SimdLaneConditionalBreakpointTest(simdTestSuite, options);
            });
        }
    });
}

//#region Tests

async function RefreshSimdDataTest(options: TestOptions): Promise<void> {
    logger.Info("Refresh SIMD data");
    try {
        await LaunchSequence(MapTestOptions(options));
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);

        const debugConsoleOutput = await GetDebugConsoleOutput();
        const consoleOutput = debugConsoleOutput
            .filter(x => x.includes("[Switching to thread") || x.includes(`at ${DEFAULT_BREAKPOINT.fileName}:${DEFAULT_BREAKPOINT.lineNumber}`)).join(" ");
        const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
        const gpuThreads = await GetGpuThreads();
        const currentgpuThread = gpuThreads.find(x => x.simdLanes.find(y => y.current))?.threadId;
        const hwInfoViewContent = await Retry(async() => {
            const temp = await GetDebugPaneContent(OneApiDebugPane.HardwareInfo);
            if (!temp) throw new Error();
            return temp;
        }, 10 * 1000) as string[];
        const selectedLaneViewContent = await Retry(async() => {
            const temp = await GetDebugPaneContent(OneApiDebugPane.SelectedLane);
            if (!temp) throw new Error();
            return temp;
        }, 10 * 1000) as string[];
        const bpinfo = await GetCallStackInfo();
        const currentThreadId = Number(GetStringBetweenStrings(bpinfo, "[", "]"));
        const currentThreadLane = GetStringBetweenStrings(consoleOutput, "lane ", ")]");
        const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");

        assert.include(hwInfoViewContent.join("\n"), deviceName, `Device name doesn't match.\nExpected: '${deviceName}'\nto be included in ${hwInfoViewContent}`);
        logger.Pass(`Device name matches. Actual: ${deviceName}`);
        assert.include(selectedLaneViewContent, `Lane Index: ${currentThreadLane}`, `Lane number doesn't match.\nExpected: 'Lane Index: ${currentThreadLane}'\nto be included in '${selectedLaneViewContent}'`);
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

async function ValidateOneApiGpuThreadsTest(threadProperty: ThreadProperty, options: TestOptions): Promise<void> {
    logger.Info(`Validate OneAPI GPU Threads - Check threads ${threadProperty.toString()}`);
    try {
        await LaunchSequence(MapTestOptions(options));
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const threadsNumber = (await GetGpuThreads()).length;
        let currentIteration = 1;

        while (currentIteration < threadsNumber) {
            const callstackBpInfo = await GetCallStackInfo();
            const callStackThreadId = ` Gpu thread id: ${GetStringBetweenStrings(callstackBpInfo, "[", "]")}`;
            const bpInfoLines = (await GetDebugConsoleOutput())
                .filter(x => x.includes(`at ${DEFAULT_BREAKPOINT.fileName}:${DEFAULT_BREAKPOINT.lineNumber}`));
            const bpInfoLine = bpInfoLines.pop() as string + callStackThreadId;
            const currentThread = (await GetGpuThreads()).find(x => x.simdLanes.find(y => y.current)) as Thread;
            const properties = {
                "Id": `Gpu thread id: ${currentThread.threadId}`,
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

async function SimdLaneConditionalBreakpointTest({ breakpointType, paneToCheck }: { breakpointType: ConditionalBreakpointType; paneToCheck: OneApiDebugPane }, options: TestOptions ): Promise<void> {
    logger.Info(`SimdLaneConditionalBreakpointTest | { breakpointType: '${breakpointType}'; paneToCheck: '${paneToCheck}' }`);
    const simdBreakpoint = breakpointType === "SimdCommand" || breakpointType === "SimdGui";

    try {
        await LaunchSequence(MapTestOptions(options));
        await RemoveAllBreakpoints();
        await SetInputText("> Intel oneAPI: Refresh SIMD Data");
        await Wait(3 * 1000);
        const [expectedCondition, expectedSimdLaneId, expectedThread] = await GetBreakpointCondition(breakpointType);
        const C_BP_61: ConditionalBreakpoint = { fileName: "array-transform.cpp", lineNumber: 61, type: breakpointType, condition: expectedCondition };

        await SetConditionalBreakpoint(C_BP_61);
        await ContinueDebugging();
        await Wait(3 * 1000);
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

async function GetBreakpointCondition(breakpointType: ConditionalBreakpointType): Promise<[string, number, Thread]> {
    const gpuThreadsExceptCurrent = (await GetGpuThreads()).filter(x => !x.simdLanes.find(x => x.current));
    const threadToSetBpOn = gpuThreadsExceptCurrent[GetRandomInt(0, gpuThreadsExceptCurrent.length)];
    const simdLaneId = GetRandomInt(1, 8); // Random SIMD lane between 1 and 7
    const conditions = {
        SimdCommand: `${threadToSetBpOn.threadId}:${simdLaneId}`,
        SimdGui: `-break-insert -p ${threadToSetBpOn.threadId} -l ${simdLaneId}`,
        NativeCommand: `$_gthread == ${threadToSetBpOn.threadId}`,
        NativeGui: `$_gthread == ${threadToSetBpOn.threadId}`,
    };

    return [conditions[breakpointType], simdLaneId, threadToSetBpOn];
}

async function GetDebugPaneContent(paneToFind: OneApiDebugPane): Promise<string[]> {
    const selectors: { [Prop in OneApiDebugPane]: { selector: By; frameTitle: OneApiDebugPaneFrameTitle }} = {
        "oneAPI GPU Threads Section": { selector: By.id("simd-view"), frameTitle: "oneAPI GPU Threads" },
        "Hardware Info Section": { selector: By.css("body"), frameTitle: "Hardware Info" },
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

async function CheckIfHwInfoViewContainsExpectedInfo() {
    const hwInfoViewContent = await Retry(async() => {
        const temp = await GetDebugPaneContent(OneApiDebugPane.HardwareInfo);
        if (temp.length <= 0) {throw new Error();}
        return temp;
    }, 10 * 1000) as string[];
    const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"))?.split("\n").find(x => x);
    const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");
    const expectedDeviceInfo: HwInfo = { Location: "", Number: "", "Sub device": "", ...DEVICES.find(x => x.Name === deviceName)! };
    const currentDeviceInfo: HwInfo = Object.keys(expectedDeviceInfo).reduce((acc, curr) => {
        // Skip first 5 chars because of '[i2] ' pefix
        acc[curr] = curr === "Name" ? hwInfoViewContent[0].substring(5) : hwInfoViewContent.find(x => x.includes(curr))?.split(": ").pop();
        return acc;
    }, {} as HwInfo);

    assert.isTrue(
        currentDeviceInfo.Name === expectedDeviceInfo.Name &&
        Number(currentDeviceInfo.Cores) === Number(expectedDeviceInfo.Cores) &&
        currentDeviceInfo["Vendor ID"] === expectedDeviceInfo["Vendor ID"] &&
        currentDeviceInfo["Target ID"] === expectedDeviceInfo["Target ID"],
        `Actual device is not the same as expected.\nActual:\n${JSON.stringify(currentDeviceInfo)}\nExpected:\n${JSON.stringify(expectedDeviceInfo)}`);
    assert.isNotEmpty(currentDeviceInfo.Number, `Hardware info property 'Number' is empty. 'Number': ${currentDeviceInfo.Number}`);
    assert.isNotEmpty(currentDeviceInfo.Location, `Hardware info property 'Location' is empty. 'Location': ${currentDeviceInfo.Location}`);
    assert.isNotEmpty(currentDeviceInfo["Sub device"], `Hardware info property 'Sub device' is empty. 'Sub device': ${currentDeviceInfo["Sub device"]}`);
    logger.Pass(`'Hardware info' contains expected info. 'Hardware info' content: ${hwInfoViewContent}`);
}

async function CheckIfGpuThreadsViewContainsExpectedInfo() {
    const consoleOutput = await GetDebugConsoleOutput();
    const lastBreakpointHit = consoleOutput.join("\n").match(/Thread.*hit.*with SIMD lane.*at.*/gm)?.pop() as string;
    const lastLaneSwitch = consoleOutput.join("\n").match(/\[Switching to thread \d+.\d+:\d+ \([A-Z]* \d+.\d+.\d+.\d+ lane \d+\)]/gm)?.pop();
    const lastLaneSwitchId = GetStringBetweenStrings(lastLaneSwitch as string, "lane ", ")]");
    const currentThread = await GetCurrentThread() as Thread;

    assert.strictEqual(currentThread.simdLanes.find(x => x.current)?.laneId, Number(lastLaneSwitchId), "Current lane is not marked as current in OneAPI GPU threads view");
    logger.Pass("Current lane is marked as current in OneAPI GPU threads view");
    const lineHit = (lastBreakpointHit.match(/(?<=lane )(\d)(?=,)|(?<=\[)(.*)(?=])/gm) as string[])[0];
    const elements = lineHit.split("-").map(x => Number(x));
    const laneIDs = elements.length === 2 ?
        Array.from({ length: (elements[1] - elements[0]) + 1 }, (_, index) => elements[0] + index) :
        [ elements[0] as number ];
    const bpinfo = await GetCallStackInfo();
    const threadId = Number(GetStringBetweenStrings(bpinfo, "[", "]"));

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
            const laneNumber = (await GetDebugPaneContent(OneApiDebugPane.SelectedLane)).find(x => x.includes("Lane Index: "));
            const laneNumberParsed = Number(laneNumber?.split(" ")[2]);

            if (isNaN(laneNumberParsed)) { throw new Error("Fetching lane number from 'Selected Lane' view failed;"); };
            return laneNumberParsed;
        }, 60 * 1000, true) as number;
    case "DebugConsole":
        return Number(GetStringBetweenStrings((await GetDebugConsoleOutput()).reverse().find(x => x.includes("Switching to thread")) as string, "lane ", ")]"));
    case "oneAPI GPU Threads Section":
        return (await GetCurrentThread())?.simdLanes.find(x => x.current)?.laneId as number;
    }
}

async function CheckIfSelectedLaneViewContainsExpectedInfo(expectedLaneID: number) {
    const checkIfSelectedLaneViewContainsExpectedLane = async(expectedLaneId: number): Promise<void> => {
        const selectedLaneViewContent = await Retry(async() => {
            const temp = await GetDebugPaneContent(OneApiDebugPane.SelectedLane);
            if (temp.length <= 0) {throw new Error();}
            return temp;
        }, 10 * 1000) as string[];

        assert.include(selectedLaneViewContent, `Lane Index: ${expectedLaneId}`, `Lane number doesn't match.\nExpected: 'Lane Index: ${expectedLaneId}'\nto be included in ${selectedLaneViewContent}`);
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
    const indicator = "🠶";

    logger.Info("Check if selected lane shows currently selected lane id");
    await checkIfSelectedLaneViewContainsExpectedLane(expectedLaneID);
    await checkIfLaneIdMatchesLanesFromOtherViews(expectedLaneID, ["Selected Lane Section", "oneAPI GPU Threads Section", "DebugConsole"]);

    logger.Info(`Check if 'current' lane indicator is present '${indicator}'`);
    const currThread = await GetCurrentThread() as Thread;
    const currentLane = currThread.simdLanes.find(y => y.current) as SimdLane;

    logger.Info(`Check if current lane indicator '${indicator}' is present on current lane '${currentLane.laneId}'`);
    assert.strictEqual(currentLane.indicator, indicator, `Current lane indicator '${indicator}' is not present on current lane '${currentLane.laneId}'`);
    logger.Info(`Current lane indicator '${indicator}' is present on current lane '${currentLane.laneId}'`);
    const randomLaneIdToSelect = Array(8).fill(0).map((_, i) => i).filter(x => x !== expectedLaneID && x !== 0)[GetRandomInt(0, 6)];

    logger.Info("Set simd lane from GUI and check if it changed in selected lane view");
    await SetSimdLaneFromGui(randomLaneIdToSelect);
    await checkIfSelectedLaneViewContainsExpectedLane(randomLaneIdToSelect);

    logger.Info("Refresh gpu thread view and check lanes again");
    await SetInputText("> Intel oneAPI: Refresh SIMD Data");
    await Wait(1000);
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