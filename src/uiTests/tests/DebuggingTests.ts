/**
 * Copyright (c) 2024-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { assert } from "chai";
import { GetDebugConsoleOutput, GetStringBetweenStrings, GetTerminalOutput, LaunchSequence, MapTestOptions, Wait } from "../utils/CommonFunctions";
import { DEVICES, TEST_DIR } from "../utils/Consts";
import { HwInfo } from "../utils/HardwareInfo/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { ContinueDebugging } from "../utils/Debugging/Debugging";
import { GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";
import { TestOptions } from "../utils/Types";
import { ReadFileAsync } from "../utils/FileSystem";

export default function(options: TestOptions) {
    describe(`Debugging ${options.remoteTests ? "on remote machine " : ""}tests`, () => {
        it("Can hit breakpoint as many times as expected", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3);
            await CanHitBreakpointAsManyTimesAsExpectedTest(options);
        });
    });
}

//#region Tests

async function CanHitBreakpointAsManyTimesAsExpectedTest(options: TestOptions): Promise<void> {
    logger.Info("Check if BP has been hit exact amount of times as expexted");
    try {
        await LaunchSequence(MapTestOptions(options));
        await Wait(3 * 1000);
        const terminalOutput = (await GetTerminalOutput("cppdbg: array-transform"));
        const deviceName = GetStringBetweenStrings(terminalOutput as string, "device: [", "] from");
        const currentDevice = DEVICES.find(d => d.Name === deviceName) as HwInfo;
        
        const path = `${TEST_DIR}/src/array-transform.cpp`;
        const file = await ReadFileAsync(path, "utf-8", MapTestOptions(options));
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