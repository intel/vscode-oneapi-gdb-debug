/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { RemoveAllBreakpoints, SetConditionalBreakpoint, ContinueDebugging, CheckIfBreakpointConditionHasBeenMet } from "../utils/Debugging/Debugging";
import { GetGpuThreads, GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";
import { ConditionalBreakpoint, ConditionalBreakpointType } from "../utils/Debugging/Types";
import { GetRandomInt, LaunchSequence, Wait } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { Thread } from "../utils/OneApiGpuThreads/Types";
import { assert } from "chai";

export default function() {
    describe("Validate 'OneAPI GPU Threads' pane", () => {
        it("Check if 'TargetID' is available", async function() {
            this.timeout(3 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await CheckTargetIdTest();
        });

        it("Check if current SIMD lane indicator has red background", async function() {
            this.timeout(10 * this.test?.ctx?.defaultTimeout);
            this.retries(1);
            await CheckCurrentLaneIndicatorTest();
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

//#endregion