/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { Wait, ChangeLocalVsCodeSettings, SetInputText, Retry, GetNotifications, MapTestOptions, WaitForConnection } from "./utils/CommonFunctions";
import { InputBox, NotificationType, VSBrowser } from "vscode-extension-tester";
import { install } from "source-map-support";
import { tests } from "./tests";
import { Hook } from "mocha";
import { NodeSSH } from "node-ssh";
import { REMOTE_DEBUGGING, REMOTE_HOST, REMOTE_PASS, REMOTE_USER, TEST_DIR } from "./utils/Consts";
import { RmAsync } from "./utils/FileSystem";
import { RemoteTestOptions, TestOptions } from "./utils/Types";

install();
logger.InitLoggers(new ConsoleLogger());

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async function() {
    let firstRun = true;
    const testOptions: TestOptions = REMOTE_DEBUGGING ? {
        remoteTests: true,
        remoteUser: REMOTE_USER as string,
        remotePass: REMOTE_PASS as string,
        remoteHost: REMOTE_HOST as string, 
        ssh: new NodeSSH().connect({
            host: REMOTE_HOST,
            username: REMOTE_USER,
            password: REMOTE_PASS })
    } : { remoteTests: false };

    for (const test of Object.values(tests)) {
        test.call(this, testOptions);
    }

    beforeEach(async function() {
        await ChangeLocalVsCodeSettings("debug.toolBarLocation", "docked");

        if (!testOptions.remoteTests) {
            await VSBrowser.instance.openResources(TEST_DIR);
            return;
        }
        const settings = {
            "security.workspace.trust.untrustedFiles": "open",
            "security.workspace.trust.enabled": false,
            "remote.SSH.useLocalServer": false,
            "remote.SSH.connectTimeout": this.defaultTimeout / 1000,
            "remote.SSH.remotePlatform": { [testOptions.remoteHost]: "linux" }
        };

        for (const [key, value] of Object.entries(settings)) {
            await ChangeLocalVsCodeSettings(key, value);
        }
        if (!firstRun) {
            await ConnectToRemote(testOptions);
            await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
        }

        let fileInput = await SetInputText("> File: Open Folder...");
        await Wait(2000);
        fileInput =  await SetInputText(TEST_DIR as string, { input: fileInput });
        await Wait(2000);
        try {
            if (await fileInput.getQuickPicks()) {
                await fileInput.confirm();
                await Wait(2000);
            }
        } catch {}

        if (firstRun) {
            await SetInputText(testOptions.remotePass, { input: new InputBox() });
        }
        await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
        try {
            await SetInputText("", {});
        } catch {}
        firstRun = false;
    });
    afterEach(async function() {
        await CloseBrowser(this);
        await LaunchBrowser(this);
        await Wait(2 * 1000);
    });
    before(async function() {
        this.defaultTimeout = 3 * 60 * 1000;
        if (testOptions.remoteTests) {
            await RmAsync(`/home/${testOptions.remoteUser}/.vscode-server/`, MapTestOptions(testOptions));
            await ConnectToRemote(testOptions);
            await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
            await InstallAllLocalExtensionsOnRemote(testOptions, this.defaultTimeout);
        } else {
            await VSBrowser.instance.openResources(TEST_DIR);
        }

        await RmAsync(`${TEST_DIR}/.vscode`, MapTestOptions(testOptions));
        await RmAsync(`${TEST_DIR}/build`, MapTestOptions(testOptions));
    });
    after(async function() {
        if (!testOptions.remoteTests) {
            return;
        }
        (await testOptions.ssh).connection?.end();
        (await testOptions.ssh).dispose();
    });
});

async function InstallAllLocalExtensionsOnRemote(options: RemoteTestOptions, timeout: number) {
    await SetInputText(`> Remote: Install Local Extensions in 'SSH: ${options.remoteHost}'...`);
    await Wait(2000);
    const input = new InputBox();

    await input.toggleAllQuickPicks(true);
    await Wait(1000);
    await input.confirm();
    await Retry(async() => {
        const notifications = await GetNotifications(NotificationType.Info);

        for (const notifiaction of notifications) {
            const message = await notifiaction.getMessage();

            if (message === "Successfully installed extensions.") { return; }
        }
        await Wait(3 * 1000);
        throw new Error("Extensions are being installed");
    }, timeout);
}

async function ConnectToRemote(options: RemoteTestOptions) {
    const input = await SetInputText("> Remote-SSH: Connect Current Window to Host...");

    await Wait(2000);
    await SetInputText(`${options.remoteUser}@${options.remoteHost}`, { input: input });
    await Wait(3000);
    await SetInputText(options.remotePass, { input: new InputBox() });
}

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