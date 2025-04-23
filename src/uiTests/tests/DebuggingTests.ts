/**
 * Copyright (c) 2024-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { assert } from "chai";
import { CheckIfBreakpointHasBeenHit, EvaluateExpression, GetDebugConsoleOutput, GetStringBetweenStrings, GetTerminalOutput, LaunchSequence, MapTestOptions, Retry, SetBreakpoint, SetInputText, Wait } from "../utils/CommonFunctions";
import { DEVICES, TEST_DIR } from "../utils/Consts";
import { HwInfo } from "../utils/HardwareInfo/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { ContinueDebugging, RemoveAllBreakpoints, StepOver } from "../utils/Debugging/Debugging";
import { GetCurrentThread } from "../utils/OneApiGpuThreads/OneApiGpuThreads";
import { TestOptions } from "../utils/Types";
import { ReadFileAsync } from "../utils/FileSystem";
import { Breakpoint, SchedulerLockingType } from "../utils/Debugging/Types";
import { By, Workbench } from "vscode-extension-tester";

export default function(options: TestOptions) {
    describe(`Debugging ${options.remoteTests ? "on remote machine " : ""}tests`, () => {
        it("Can hit breakpoint as many times as expected", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3);
            await CanHitBreakpointAsManyTimesAsExpectedTest(options);
        });
        it("Scheduler locking continue", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3);
            await SchedulerLockingTest(options, SchedulerLockingType.Continue);
        });
        it("Scheduler locking step", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3);
            await SchedulerLockingTest(options, SchedulerLockingType.Step);
        });
    });
}

//#region Tests

async function SchedulerLockingTest(options: TestOptions, type: SchedulerLockingType): Promise<void> {
    logger.Info("Check if scheduler locking locks on initial thread");
    try {
        await LaunchSequence(MapTestOptions(options));
        await Wait(3 * 1000);
        await SetInputText(`> Scheduler-Locking ${type}`);
        await Wait(2 * 1000);
        const initialSchedulerLockingLabel = await GetSchedulerLockingLabel();

        assert.strictEqual(initialSchedulerLockingLabel, `Scheduler-locking: ${type}`, `Scheduler locking label is not as expected! Actual: '${initialSchedulerLockingLabel}' | Expected: 'Scheduler-locking: ${type}'`);
        logger.Pass("Scheduler locking label is as expected.");
        const initialThread = await GetCurrentThread();

        switch(type) {
        case SchedulerLockingType.Continue:
            const breakpoints: {[key: string]: Breakpoint} = {
                BP_55: { fileName: "array-transform.cpp", lineNumber: 55 },
                BP_56: { fileName: "array-transform.cpp", lineNumber: 56 },
                BP_61: { fileName: "array-transform.cpp", lineNumber: 61 }
            };

            for (const bp of Object.values(breakpoints)) {
                await SetBreakpoint(bp);
            }
            for (const bp of Object.values(breakpoints)) {
                await ContinueDebugging();
                await CheckIfBreakpointHasBeenHit(bp);
                const currentThread = await GetCurrentThread();

                assert.strictEqual(currentThread?.threadId, initialThread?.threadId, `Current thread is not the same as initial thread! Actual: '${currentThread?.threadId}' | Expected: '${initialThread?.threadId}'`);
                logger.Pass("Current thread is the same as initial thread.");
            }
            break;
        case SchedulerLockingType.Step:
            const expectedLineNumbers = [55, 56, 59, 57, 61, 62].map(x => x.toString());

            for (const lineNumber of expectedLineNumbers) {
                await StepOver();
                const currentLineNumber = await Retry(async() => {
                    const expressionOutput_2 = await EvaluateExpression("-exec frame");
                    const currentLineNumber = expressionOutput_2?.map(line => line.match(/^\d+/)?.[0]).find(line => line !== undefined);

                    if (!currentLineNumber) {
                        throw new Error("Current line number is undefined");
                    }
                    return currentLineNumber;
                }, 30 * 1000);
                const currentThread = await GetCurrentThread();

                assert.strictEqual(currentLineNumber, lineNumber, `Current line number is not the same as initial line number! Actual: '${currentLineNumber}' | Expected: '${lineNumber}'`);
                logger.Pass(`Current line number is the same as initial line number. Actual: '${currentLineNumber}' | Expected: '${lineNumber}'`);
                assert.strictEqual(currentThread?.threadId, initialThread?.threadId, `Current thread is not the same as initial thread! Actual: '${currentThread?.threadId}' | Expected: '${initialThread?.threadId}'`);
                logger.Pass("Current thread is the same as initial thread.");
            }
            break;
        }
        await SetInputText(`> Scheduler-Locking ${type}`);
        await Wait(2 * 1000);
        const schedulerLockingLabel = await GetSchedulerLockingLabel();

        assert.isUndefined(schedulerLockingLabel, `Scheduler locking label is not as expected! Actual: '${schedulerLockingLabel}' | Expected: 'undefined'`);
        logger.Pass("Scheduler locking label is as expected.");
        await RemoveAllBreakpoints();
        await ContinueDebugging();
        const appHasExited = (await GetDebugConsoleOutput()).filter(x => x.includes("has exited with code")).length > 0;

        logger.Info("Check if app has exited.");
        assert.isTrue(appHasExited, `App didn't exit as expected! Actual '${appHasExited}' | Expected: 'true'`);
        logger.Pass("App exited as expected.");

    } catch (e) {
        logger.Error(e);
        throw e;
    }
}

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

async function GetSchedulerLockingLabel(): Promise<string | undefined> {
    return await Retry(async() => {
        const driver = new Workbench().getDriver();
        const schedulerLockingLabel = await driver.findElement(By.css("[aria-label*=\"Scheduler-locking: \"]"));
        const labelText = (await schedulerLockingLabel.getText()).trim();

        return labelText;
    }, 2 * 1000);
}