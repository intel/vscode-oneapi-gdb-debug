/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { Wait, ChangeVsCodeSettings, SetInputText, Retry, GetNotifications } from "./utils/CommonFunctions";
import { InputBox, NotificationType, StatusBar } from "vscode-extension-tester";
import { install } from "source-map-support";
import { tests } from "./tests";
import { Hook } from "mocha";
import { NodeSSH } from "node-ssh";
import { FileSystem as fs } from "./utils/FileSystem";
import { REMOTE_DEBUGGING, TEST_DIR } from "./utils/Consts";

install();
logger.InitLoggers(new ConsoleLogger());

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async() => {
    let firstRun = true;

    for (const test of Object.values(tests)) {
        test.call(this);
    }
    beforeEach(async function() {
        if (REMOTE_DEBUGGING) {
            if (!firstRun) {
                const input = await SetInputText("> Remote-SSH: Connect Current Window to Host...");
                
                await Wait(2000);
                await SetInputText(`${this.remoteUser}@${this.remoteIp}`, { input: input });

                // sshpass -p gta ssh -n -o StrictHostKeyChecking=accept-new gta@10.123.221.144
                // sshpass -p gta ssh-copy-id -i ~/.ssh/id_ed25519.pub 10.123.221.50
                await WaitForConnection(this.remoteIp, this.defaultTimeout);
            }

            const fileInput = await SetInputText("> File: Open Folder...");

            await SetInputText(TEST_DIR, { input: fileInput });
            await Wait(2000);
            const inpt = new InputBox();

            await inpt.setText("gta");
            await inpt.confirm();
            await WaitForConnection(this.remoteIp, this.defaultTimeout);
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

        if (REMOTE_DEBUGGING) {
            this.remoteUser = process.env.REMOTE_USR ?? (() => { throw new Error("'REMOTE_USR' env variable is not set!"); })();
            this.remoteIp = process.env.REMOTE_IP ?? (() => { throw new Error("'REMOTE_IP' env variable is not set!"); })();
            fs.Init(await new NodeSSH().connect({
                host: this.remoteIp,
                username: this.remoteUser,
                password: "gta" }));

            const settings = {
                "security.workspace.trust.untrustedFiles": "open",
                "security.workspace.trust.enabled": false,
                "remote.SSH.useLocalServer": false,
                "remote.SSH.connectTimeout": this.defaultTimeout / 1000,
                "remote.SSH.remotePlatform": { [this.remoteIp]: "linux" }
            };

            for (const [key, value] of Object.entries(settings)) {
                await ChangeVsCodeSettings(key, value);
            }

            await fs.RmAsync(`/home/${this.remoteUser}/.vscode-server/`, { remotePath: true });
            const input = await SetInputText("> Remote-SSH: Connect Current Window to Host...");

            await Wait(2000);
            await SetInputText(`${this.remoteUser}@${this.remoteIp}`, { input: input });
            await Wait(3000);
            const inpt = new InputBox();

            await inpt.setText("gta");
            await inpt.confirm();
            await WaitForConnection(this.remoteIp, this.defaultTimeout);
            await SetInputText(`> Remote: Install Local Extensions in 'SSH: ${this.remoteIp}'...`);
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

        await fs.RmAsync(`${TEST_DIR}/.vscode`, { remotePath: true });
        await ChangeVsCodeSettings("debug.toolBarLocation", "docked");
        // Install extensions on remote
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