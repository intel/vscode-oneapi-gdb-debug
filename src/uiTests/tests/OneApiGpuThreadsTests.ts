/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { LaunchSequence, Retry, SetInputText, Wait } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { GetGpuThreads } from "../utils/OneApiGpuThreads";
import { assert } from "chai";

export default function() {
    describe("Validate 'OneAPI GPU Threads' pane", () => {
        it("Check if 'TargetID' is available", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 120);
            this.retries(1);
            await CheckTargetIdTest();
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
    assert.isTrue(result, `'TargetID's are not valid. Actual:\n${targetIds.join("\n")}\nExpected: Satisfy the pattern "/ZE \d+.\d+.\d+.\d+/" eg. "ZE 0.1.3.0"`);
    } catch(e) {
        logger.Error(e);
        throw e;
    }
}

//#endregion