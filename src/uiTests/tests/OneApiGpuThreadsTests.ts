/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { LaunchSequence, Wait } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { GetGpuThreads } from "../utils/OneApiGpuThreads";
import { assert } from "chai";

export default function() {
    describe("Validate 'OneAPI GPU Threads' pane", () => {
        it("Check if 'TargetID' is available", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3); // Three minutes timeout.
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
        const message = `Actual:\n${targetIds.join("\n")}`;
        logger.Info(`Check if 'TargetID's are available. ${message}`)
        assert.isTrue(result, `'TargetID's are not valid. ${message}\nExpected: Satisfy the pattern "/ZE \d+.\d+.\d+.\d+/" eg. "ZE 0.1.3.0"`);
        logger.Pass("'TargetID's are available and valid!")
    } catch (e) {
        logger.Error(e);
        throw e;
    }
}

//#endregion