/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { NotificationType } from "vscode-extension-tester";
import { GetExtensionsSection, GetNotificationActions, GetNotifications, Retry, SetInputText, TakeNotificationAction, UninstallExtension, Wait } from "../utils/CommonFunctions";
import { LoggerAggregator as logger } from "../utils/Logger";
import { assert } from "chai";
import { NotificationPopup } from "../utils/Types";

const expectedNotifications: {[k: string]: NotificationPopup} = {
    env_config: {
        name: "Environment Configurator for Intel® oneAPI Toolkits",
        message : "Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.",
        installButton : "Environment Configurator for Intel oneAPI Toolkits"
    },
    c_cppExt: {
        name: "C/C++",
        message : "No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.",
        installButton : "Install C/C++ Extension"
    }
};

export default function() {
    describe("Install extensions from notifications", () => {
        before(async() => {
            for (const notification of Object.values(expectedNotifications)) {
                await UninstallExtension(notification.name);
            }
            await SetInputText("> Developer: Reload WIndow");
            await Wait(5 * 1000);
        });
        for (const notification of Object.values(expectedNotifications)) {
            it(`Install '${notification.name}' extension`, async function() {
                this.timeout(this.test?.ctx?.defaultTimeout);
                await InstallExtensionFromNotificationTest(notification);
            });
        }
    });
}

//#region Tests

async function InstallExtensionFromNotificationTest(expectedNotification: NotificationPopup) {
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
                    const extensionsView = await GetExtensionsSection("Installed");
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
    let notifications = await GetNotifications(NotificationType.Any);

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