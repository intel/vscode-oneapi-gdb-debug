/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { Wait, ChangeVsCodeSettings } from "./utils/CommonFunctions";
import { VSBrowser } from "vscode-extension-tester";
import { install } from "source-map-support";
import { RmSync } from "./utils/FileSystem";
import { tests } from "./tests";
import { Hook } from "mocha";

install();
logger.InitLoggers(new ConsoleLogger());

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async() => {
    for (const test of Object.values(tests)) {
        test.call(this);
    }
    afterEach(async function() {
        await CloseBrowser(this);
        await LaunchBrowser(this);
        await Wait(2* 1000);
        await VSBrowser.instance.openResources(...this.resources);
        SetToolBarLocationToDocked();
    });
    before(async function() {
        this.defaultTimeout = 60 * 1000;
        this.resources = ["../array-transform", "../array-transform/src/array-transform.cpp"];
        await VSBrowser.instance.openResources(...this.resources);
        RmSync("../array-transform/.vscode");
        SetToolBarLocationToDocked();
    });
});

async function CloseBrowser(context: Mocha.Context) {
    await Wait(1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const closeHook = (<any>context.test?.parent?.parent)._afterAll[0] as Hook;

    await Promise.all([closeHook.fn?.call(context, () => {})]);
}

async function LaunchBrowser(context: Mocha.Context) {
    await Wait(1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = (<any>context.test?.parent?.parent)._beforeAll[0] as Hook;
    
    await Promise.all([before.fn?.call(context, () => {})]);
}

function SetToolBarLocationToDocked() {
    logger.Info("Set toolbar location to docked");
    ChangeVsCodeSettings("debug.toolBarLocation", "docked");
}