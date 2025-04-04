/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { RemoveAllBreakpoints, SetConditionalBreakpoint, ContinueDebugging, CheckIfBreakpointConditionHasBeenMet } from "../utils/Debugging/Debugging";
import { GetRandomInt, LaunchSequence, ReplaceStringInFile, SetSettingValue, Wait } from "../utils/CommonFunctions";
import { GetGpuThreads, GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";
import { ConditionalBreakpoint, ConditionalBreakpointType } from "../utils/Debugging/Types";
import { SimdLane, Thread } from "../utils/OneApiGpuThreads/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { By, Workbench } from "vscode-extension-tester";
import { assert } from "chai";
import { FileExistsSync } from "../utils/FileSystem";

export default function() {
    describe("Validate 'OneAPI GPU Threads' pane", () => {
        it("Check if 'TargetID' is available", async function() {
            this.timeout(3 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await CheckTargetIdTest();
        });

        it.skip("Check if current SIMD lane indicator has red background", async function() {
            this.timeout(10 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await CheckCurrentLaneIndicatorTest();
        });
        it("Check SIMD lanes symbols", async function() {
            this.timeout(4 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await CheckSimdLaneSymbols(this.resources);
        });
    });
}

//#region Tests

async function CheckTargetIdTest(): Promise<void> {
    logger.Info("Check 'TargetID' Test");
    try {
        await LaunchSequence();
        await Wait(3 * 1000);

        const gpuThreads = await GetGpuThreads();
        const targetIds = gpuThreads.map(x => x.targetId);
        const result = targetIds.every(x => (/^ZE \d+.\d+.\d+.\d+$/.test(x)));
        const message = `Actual:\n${targetIds.join("\n")}`;

        logger.Info(`Check if 'TargetID's are available. ${message}`);
        assert.isTrue(result, `'TargetID's are not valid. ${message}\nExpected: Satisfy the pattern "/ZE \d+.\d+.\d+.\d+/" eg. "ZE 0.1.3.0"`);
        logger.Pass("'TargetID's are available and valid!");
    } catch (e) {
        logger.Error(e);
        throw e;
    }
}

async function CheckCurrentLaneIndicatorTest(): Promise<void> {
    logger.Info("Check if current lane indicator is present on red background square test");
    type SimdBreakpoint = { bp: ConditionalBreakpoint; thread: Thread | undefined; laneId: number }

    try {
        await LaunchSequence();
        await Wait(3 * 1000);
        await RemoveAllBreakpoints();
        const allThreads = await GetGpuThreads();
        let currentThread = await GetCurrentThread(allThreads) as Thread;
        const availableThreads = allThreads.filter(x => { if (x.threadId !== currentThread?.threadId) {return x.threadId;} });
        const breakpoints: SimdBreakpoint[] = [];

        for (const thread of availableThreads) {
            const simdLaneId = GetRandomInt(1, 8); // Random SIMD lane between 1 and 7
            const C_BP_62: ConditionalBreakpoint = { fileName: "array-transform.cpp", lineNumber: 62, type: ConditionalBreakpointType.SimdCommand, condition: `${thread.threadId}:${simdLaneId}` };
            
            await SetConditionalBreakpoint(C_BP_62);
            breakpoints.push({ bp: C_BP_62, thread: allThreads.find(x => x.threadId === thread.threadId), laneId: simdLaneId });
            await Wait(2 * 1000);
        }

        await ContinueDebugging();
        await Wait(2 * 1000);

        while (breakpoints.length > 0) {

            currentThread = await GetCurrentThread() as Thread;
            const breakpoint = breakpoints.find(b => b.thread?.threadId === currentThread.threadId) as SimdBreakpoint;
            const index = breakpoints.lastIndexOf(breakpoint);
            
            breakpoints.splice(index, 1);

            await CheckIfBreakpointConditionHasBeenMet({
                expectedSimdLaneId: breakpoint.laneId,
                expectedThread: breakpoint.thread as Thread,
                breakpoint: breakpoint.bp
            });

            const currentLane = currentThread.simdLanes.find(s => s.current);
            const hitLane = currentThread.simdLanes.find(s => s.state === "Hit");

            const message = `ThreadId: '${currentThread.threadId}' | LaneId: '${currentLane?.laneId}' | Current lane indicator: '${currentLane?.indicator}' | Current lane state (Hit == red, Active == blue): '${currentLane?.state}' | Expected LaneId: '${breakpoint.laneId}'`;

            logger.Info(`Check if threads: '${currentThread.threadId}' current lane: '${currentLane?.laneId}' is the same as expected lane '${breakpoint.laneId}' and if it is also hit lane: '${hitLane?.laneId}'`);
            logger.Info(`More thread info:\n${message}`);

            assert.strictEqual(currentLane?.laneId, breakpoint.laneId, `Lanes are not the same! Current lane id: ${currentLane?.laneId} | Expected lane id: ${breakpoint.laneId}`);
            logger.Pass(`Lanes are the same! Current lane id: ${currentLane?.laneId} | Expected lane id: ${breakpoint.laneId}`);

            assert.strictEqual(currentLane?.laneId, hitLane?.laneId, `Lanes are not the same! Current lane id: ${currentLane?.laneId} | Hit lane id: ${hitLane?.laneId}`);
            logger.Pass(`Lanes are the same! Current lane id: ${currentLane?.laneId} | Hit lane id: ${hitLane?.laneId}`);

            await ContinueDebugging();
            await Wait(3 * 1000);
        }
    } catch (e) {
        logger.Error(e);
        throw e;
    }
}

async function CheckSimdLaneSymbols(resources: string[]): Promise<void> {
    logger.Info("Check if SIMD lane symbols are displayed");
    const indicator = "🠶";
    const activeLaneSymbol = "A";
    const inactiveLaneSymbol = "I";
    const path = GetArrayTransformFilePath(resources) as string;

    try {

        // Change array length to '65' to spawn inactive lanes "constexpr size_t length = .*"
        ReplaceStringInFile("constexpr size_t length", "constexpr size_t length = 65;", path);
        await LaunchSequence();
        await Wait(3 * 1000);
        const allThreads = await GetGpuThreads();
        const currentThread = await GetCurrentThread(allThreads) as Thread;
        const currentLane = currentThread.simdLanes.find(s => s.current) as SimdLane;

        logger.Info(`Check if current lane indicator '${indicator}' is present on current lane '${currentLane.laneId}'`);
        assert.strictEqual(currentLane.indicator, indicator, `Current lane indicator '${indicator}' is not present on current lane '${currentLane.laneId}'`);
        logger.Info(`Current lane indicator '${indicator}' is present on current lane '${currentLane.laneId}'`);
        const settingsEditor = await new Workbench().openSettings();

        await SetSettingValue("ACTIVE_LANE_SYMBOL", "Aa", settingsEditor);
        const activeLanevalidationMessage = await settingsEditor.getDriver().findElement(By.className("setting-item-validation-message")).getText();

        logger.Info("Check if validation message is 'Value must be 1 or fewer characters long.'");
        assert.strictEqual(activeLanevalidationMessage, "Value must be 1 or fewer characters long.", "Validation message is not equal to 'Value must be 1 or fewer characters long.'");
        logger.Pass("Validation message is 'Value must be 1 or fewer characters long.'");
        await SetSettingValue("ACTIVE_LANE_SYMBOL", activeLaneSymbol, settingsEditor);
        await SetSettingValue("INACTIVE_LANE_SYMBOL", "Ii", settingsEditor);
        const inactiveLanevalidationMessage = await settingsEditor.getDriver().findElement(By.className("setting-item-validation-message")).getText();

        logger.Info("Check if validation message is 'Value must be 1 or fewer characters long.'");
        assert.strictEqual(inactiveLanevalidationMessage, "Value must be 1 or fewer characters long.", "Validation message is not equal to 'Value must be 1 or fewer characters long.'");
        logger.Pass("Validation message is 'Value must be 1 or fewer characters long.'");
        await SetSettingValue("INACTIVE_LANE_SYMBOL", inactiveLaneSymbol, settingsEditor);
        const threadsAfterSettingsChange = await GetGpuThreads();
        const allActiveLanes = threadsAfterSettingsChange.flatMap(t => t.simdLanes.filter(l => l.state === "Active" || l.state === "Hit"));
        const allInactiveLanes = threadsAfterSettingsChange.flatMap(t => t.simdLanes.filter(l => l.state === "Inactive"));

        logger.Info(`Check if all active and hit lanes contains custom lane symbol '${activeLaneSymbol}'`);
        assert.isTrue(allActiveLanes.every(l => l.current ? true : l.customSymbol === activeLaneSymbol), `Not all active lanes has custom lane symbol '${activeLaneSymbol}'`);
        logger.Pass(`All active and hit lanes contains custom lane symbol '${activeLaneSymbol}'`);

        logger.Info(`Check if all inactive lanes contains custom lane sumbol '${inactiveLaneSymbol}'`);
        assert.isTrue(allInactiveLanes.every(l => l.customSymbol === inactiveLaneSymbol), `Not all inactive lanes has custom lane symbol '${inactiveLaneSymbol}'`);
        logger.Pass(`All inactive lanes contains custom lane sumbol '${inactiveLaneSymbol}'`);
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        ReplaceStringInFile("constexpr size_t length", "constexpr size_t length = 64;", path);
    }
}

//#endregion

function GetArrayTransformFilePath(resources: string[]): string | undefined {
    const test_resources = process.env["TEST_RESOURCES"];
    let arrayTransformPath = test_resources?.includes("array-transform") ? test_resources.concat("/src/array-transform.cpp") : undefined;

    arrayTransformPath = arrayTransformPath ?? resources.find(x => x.includes(".cpp"));
    if (!FileExistsSync(arrayTransformPath ?? "")) {
        return;
    }

    return arrayTransformPath;
}