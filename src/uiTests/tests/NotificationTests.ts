/**
 * Copyright (c) 2024-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { InputBox, Notification, NotificationType } from "vscode-extension-tester";
import { GetExtensionsSection, GetNotificationActions, GetNotifications, InstallExtension, Retry, SetInputText, TakeNotificationAction, UninstallExtension, Wait, WaitForConnection } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { assert } from "chai";
import { ExtensionSection, NotificationPopup, TestOptions } from "../utils/Types";

const expectedNotifications: {[k: string]: NotificationPopup} = {
    env_config: {
        name: "Environment Configurator for Intel Software Developer Tools",
        message : "Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.",
        installButton : "Environment Configurator for Intel oneAPI Toolkits",
        id: "intel-corporation.oneapi-environment-configurator"
    },
    c_cppExt: {
        name: "C/C++",
        message : "No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.",
        installButton : "Install C/C++ Extension",
        id: "ms-vscode.cpptools"
    }
};

export default function(options: TestOptions) {
    describe(`Install extensions from notifications${options.remoteTests ? " on remote target" : ""}`, () => {
        before(async function() {
            try {
                for (const notification of Object.values(expectedNotifications)) {
                    await UninstallExtension(notification.id as string, options);
                }
                await SetInputText("> Developer: Reload WIndow");
                await Wait(5 * 1000);
                if (options.remoteTests) {
                    await SetInputText(options.remotePass, { input: new InputBox() });
                    await WaitForConnection(options.remoteHost, this.test?.ctx?.defaultTimeout);
                }
            } catch(e) { logger.Error(e); }
        });
        after(async() => {
            try {
                for (const notification of Object.values(expectedNotifications)) {
                    await InstallExtension(notification.id as string, options);
                }
                await SetInputText("> Developer: Reload WIndow");
                await Wait(5 * 1000);
            } catch(e) { logger.Error(e); }
        });
        for (const notification of Object.values(expectedNotifications)) {
            it(`Install '${notification.name}' extension`, async function() {
                this.timeout(this.test?.ctx?.defaultTimeout);
                await InstallExtensionFromNotificationTest(notification, options);
            });
        }
    });
}

//#region Tests

async function InstallExtensionFromNotificationTest(expectedNotification: NotificationPopup, options: TestOptions) {
    try {
        logger.Info(`Install '${expectedNotification.name}' extension from notiification popup`);
        await ClearUnwantedNotifications();
        let found = false;
        const notifications = await GetNotifications(NotificationType.Any);

        for (const notification of notifications) {
            found = true;
            const message = await notification.getMessage();

            if (message === expectedNotification.message) {
                const actions = await GetNotificationActions(notification);
                const title = await actions[0].getText();

                assert.strictEqual(title, expectedNotification.installButton, `Install button doesn't exists. Actual: '${title}' | Expected: '${expectedNotification.installButton}'`);
                logger.Pass(`Install button exists. Button: ${title}`);

                await TakeNotificationAction(notification, expectedNotification.installButton);
                await Retry(async() => {
                    await Wait(1000);
                    let section: ExtensionSection = "Installed";

                    if (options.remoteTests) {
                        section = { customName: `SSH: ${options.remoteHost} - Installed` };
                    }
                    const extensionsView = await GetExtensionsSection(section);
                    const installedExtensions = await extensionsView.getText();

                    assert.include(installedExtensions, expectedNotification.name, `Extension: '${expectedNotification.name}' hasn't been installed`);
                    logger.Pass(`Extension: '${expectedNotification.name}' has been installed`);
                }, 60 * 1000, true);
            }
        }
        if (!found) {throw new Error("Extension hasn't been installed or is already installed");}
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        await SetInputText("> Terminal: Kill All Terminals");
    }
}

//#endregion

async function ClearUnwantedNotifications(): Promise<void> {
    logger.Info("Clear unwanted notifications");
    let notifications = await Retry(async() => {
        await Wait(2000);
        return await GetNotifications(NotificationType.Any);
    }, 20 * 1000) as Notification[];

    while (notifications.length > 2 ) {
        for (const notification of notifications) {
            const message = await notification.getMessage();
            const messages = Object.values(expectedNotifications).map(x => x.message);

            if (!messages.includes(message)) {
                await notification.dismiss();
                continue;
            }
        }
        notifications = await GetNotifications(NotificationType.Any);
    }
}