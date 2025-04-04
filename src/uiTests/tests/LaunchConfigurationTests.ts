/**
 * Copyright (c) 2021-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { CheckIfTaskWasExecuted, ClearInputText,LaunchSequence,
    MapTestOptions,
    SelectQuickPick, SetInputText, StopDebugging } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { TestOptions, VsCodeTask } from "../utils/Types";
import { Workbench } from "vscode-extension-tester";
import { TASKS_JSON_PATH } from "../utils/Consts";
import { assert } from "chai";
import { LoadAndParseJsonFile } from "../utils/FileSystem";

export default function(options: TestOptions) {
    describe("Generate launch configurations", () => {
        for (const task of [
            "run",
            "run-cpu",
            "run-gpu",
            "run-fpga"
        ]) {
            (options.remoteTests ? it.skip : it)(`Generate '${task}' task`, async function() {
                this.timeout(this.test?.ctx?.defaultTimeout);
                await GenerateTaskTest(task);
            });
        }
        it(`Generate 'Debug' launch configuration${options.remoteTests ? " on remote target machine" : ""}`, async function() {
            this.timeout(this.test?.ctx?.defaultTimeout);
            await GenerateDebugLaunchConfigurationTest(options); 
        });
    });
}

//#region Tests

async function GenerateTaskTest(taskName: string): Promise<void> {
    logger.Info(`Generate '${taskName}' task`);
    try {
        const expectedCommand = `mkdir -p build && cmake  -S . -B build && cmake --build build && cmake --build build --target ${taskName}`;
        let input = await new Workbench().openCommandPrompt();

        input = await ClearInputText(input);
        input = await SetInputText("> Intel oneapi: Generate tasks", { input: input });
        input = await SelectQuickPick("Select a new target", input);
        input = await SelectQuickPick(taskName, input);
        await SelectQuickPick("Close", input);
        const tasks = (await LoadAndParseJsonFile<{tasks: VsCodeTask[]}>(TASKS_JSON_PATH, { remotePath: false })).tasks;
        const runCpuTask = tasks.find(task => task.label === taskName) as VsCodeTask;

        assert.exists(runCpuTask, `'${taskName}' task doesn't exists!`);
        logger.Pass(`Task: '${taskName}' has been created and exists in 'tasks.json'`);
        assert.strictEqual(runCpuTask.label, taskName, `'${taskName}' task has incorrect label. Actual: '${runCpuTask.label} | Expected: ${taskName}'`);
        logger.Pass(`Task: '${taskName}' has correct label. Actual: '${runCpuTask.label} | Expected: ${taskName}'`);
        assert.strictEqual(runCpuTask.command, expectedCommand, `'${taskName}' task has incorrect command.\nActual: ${runCpuTask.command}\nExpected: ${expectedCommand}`);
        logger.Pass(`Task: '${taskName}' has correct command.\nActual: ${runCpuTask.command}\nExpected: ${expectedCommand}`);
    } catch(e) {
        logger.Error(e);
        throw e;
    } finally {
        await SetInputText("> Terminal: Kill All Terminals");
    }
}

async function GenerateDebugLaunchConfigurationTest(options: TestOptions): Promise<void> {
    logger.Info("Generate debug launch configuration");
    try {
        await LaunchSequence(MapTestOptions(options));
        await StopDebugging();
        await CheckIfTaskWasExecuted("postTask", "simple postTask");
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await SetInputText("> Terminal: Kill All Terminals");
    }
}

//#endregion