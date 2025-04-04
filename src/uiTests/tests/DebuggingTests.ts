/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { assert } from "chai";
import { GetDebugConsoleOutput, GetStringBetweenStrings, GetTerminalOutput, LaunchSequence, Wait } from "../utils/CommonFunctions";
import { DEVICES, REMOTE_DEBUGGING, TEST_DIR } from "../utils/Consts";
import { FileSystem as fs } from "../utils/FileSystem";
import { HwInfo } from "../utils/HardwareInfo/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { ContinueDebugging } from "../utils/Debugging/Debugging";
import { GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";

export default function() {
    describe("Debugging tests", () => {
        it("Can hit breakpoint as many times as expected", async function() {
            this.timeout(10 * this.test?.ctx?.defaultTimeout);
            await CanHitBreakpointAsManyTimesAsExpectedTest();
        });
    });
}

//#region Tests

async function CanHitBreakpointAsManyTimesAsExpectedTest(): Promise<void> {
    logger.Info("Check if BP has been hit exact amount of times as expexted");
    try {
        await LaunchSequence();
        await Wait(3 * 1000);
        const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"));
        const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");
        const currentDevice = DEVICES.find(d => d.Name === deviceName) as HwInfo;
        
        const path = `${TEST_DIR}/src/array-transform.cpp`;
        const file = await fs.ReadFileAsync(path, "utf-8", { remotePath: REMOTE_DEBUGGING });
        const line = file.split("\n").find(l => l.includes("constexpr size_t length"));
        const simdNumber = line?.split("=")[1].trim().slice(0, -1);
        const expectedThreadCount = Math.ceil(Number(simdNumber) / currentDevice?.SimdWidth);

        let currentIteration = 1;
        const threadsMet: number[] = [];

        while (currentIteration <= expectedThreadCount) {
            const appHasExited = (await GetDebugConsoleOutput()).filter(x => x.includes("has exited with code")).length > 0;

            if (appHasExited) {
                throw new Error("App exited unexpectedly!");
            }
            threadsMet.push((await GetCurrentThread())?.threadId ?? -1);
            await ContinueDebugging();
            currentIteration++;
        }

        await Wait(5000);
        const appHasExited = (await GetDebugConsoleOutput()).filter(x => x.includes("has exited with code")).length > 0;
        const actualThreadCount = new Set(threadsMet).size;

        logger.Info("Check if app has exited.");
        assert.isTrue(appHasExited, `App didn't exit as expected! Actual '${appHasExited}' | Expected: 'true'`);
        logger.Pass("App exited as expected.");
        logger.Info("Check if breakpoint has been hit as many times as expected.");
        assert.strictEqual(actualThreadCount, expectedThreadCount, `Breakpoint hasn't been hit as many times as expected! Actual: '${actualThreadCount}' | Expected: '${expectedThreadCount}'`);
        logger.Pass("Breakpoint has been hit as many times as expected.");

    } catch (e) {
        logger.Error(e);
        throw e;
    }
}

//#endregion