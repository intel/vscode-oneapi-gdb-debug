/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { Wait, ChangeLocalVsCodeSettings, SetInputText, Retry, GetNotifications, MapTestOptions } from "./utils/CommonFunctions";
import { InputBox, NotificationType, StatusBar } from "vscode-extension-tester";
import { install } from "source-map-support";
import { tests } from "./tests";
import { Hook } from "mocha";
import { NodeSSH } from "node-ssh";
import { REMOTE_DEBUGGING, REMOTE_HOST, REMOTE_PASS, REMOTE_USER, TEST_DIR } from "./utils/Consts";
import { RmAsync } from "./utils/FileSystem";
import { TestOptions } from "./utils/Types";

install();
logger.InitLoggers(new ConsoleLogger());

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async function() {
    let firstRun = true;
    let testOptions: TestOptions = { remoteTests: false };
    const initTests = async(options: TestOptions) => {
        for (const test of Object.values(tests)) {
            test.call(this, options);
        }
    };

    it("placeholder");
    beforeEach(async function() {
        if (testOptions.remoteTests) {
            if (!firstRun) {
                const input = await SetInputText("> Remote-SSH: Connect Current Window to Host...");
                
                await Wait(2000);
                await SetInputText(`${testOptions.remoteUser}@${testOptions.remoteHost}`, { input: input });
                await Wait(2000);
                const inpt = new InputBox();
    
                await inpt.setText("gta");
                await inpt.confirm();
                // sshpass -p gta ssh -n -o StrictHostKeyChecking=accept-new gta@10.123.221.50
                // sshpass -p gta ssh-copy-id -i ~/.ssh/id_ed25519.pub 10.123.221.50
                await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
            }

            const fileInput = await SetInputText("> File: Open Folder...");

            await SetInputText(TEST_DIR, { input: fileInput });
            await Wait(2000);

            if (firstRun) {
                const inpt = new InputBox();

                await inpt.setText("gta");
                await inpt.confirm();
            }
            await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
            await SetInputText("", {});
        }
        firstRun = false;
    });
    afterEach(async function() {
        await CloseBrowser(this);
        await LaunchBrowser(this);
        await Wait(2 * 1000);
    });
    before(async function() {
        this.defaultTimeout = 3 * 60 * 1000;
        testOptions = REMOTE_DEBUGGING ? {
            remoteTests: true,
            remoteUser: REMOTE_USER as string,
            remotePass: REMOTE_PASS as string,
            remoteHost: REMOTE_HOST as string, 
            ssh: await new NodeSSH().connect({
                host: REMOTE_HOST,
                username: REMOTE_USER,
                password: REMOTE_PASS })
        } : { remoteTests: false };

        await initTests(testOptions);
        if (testOptions.remoteTests) {

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
            await RmAsync(`/home/${testOptions.remoteUser}/.vscode-server/`, MapTestOptions(testOptions));
            const input = await SetInputText("> Remote-SSH: Connect Current Window to Host...");

            await Wait(2000);
            await SetInputText(`${testOptions.remoteUser}@${testOptions.remoteHost}`, { input: input });
            await Wait(3000);
            const inpt = new InputBox();

            await inpt.setText("gta");
            await inpt.confirm();
            await WaitForConnection(testOptions.remoteHost, this.defaultTimeout);
            await SetInputText(`> Remote: Install Local Extensions in 'SSH: ${testOptions.remoteHost}'...`);
            await Wait(2000);
            const inpt2 = new InputBox();

            await inpt2.toggleAllQuickPicks(true);
            await Wait(1000);
            await inpt2.confirm();
            await Retry(async() => {
                const notifications = await GetNotifications(NotificationType.Info);

                for (const notifiaction of notifications) {
                    const message = await notifiaction.getMessage();

                    if (message === "Successfully installed extensions.") { return; }
                }
                await Wait(3 * 1000);
                throw new Error("Extensions are being installed");
            }, this.defaultTimeout);
        } else {
            // fs = FileSystem.GetInstance();
        }

        await RmAsync(`${TEST_DIR}/.vscode`, MapTestOptions(testOptions));
        await ChangeLocalVsCodeSettings("debug.toolBarLocation", "docked");
    });
});

async function WaitForConnection(ip: string, timeout: number) {
    await Retry(async() => {
        const statusbar = new StatusBar();
        const status = await statusbar.getItem(`remote  SSH: ${ip}`);

        if (status) { return; }
        await Wait(5 * 1000);
        throw new Error();
    }, timeout, true);
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