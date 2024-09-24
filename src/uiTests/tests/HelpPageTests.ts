/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ExecuteInIFrame, GetNotificationActions, GetNotifications, SetInputText, TakeNotificationAction, Wait } from "../utils/CommonFunctions";
import { By, EditorView, NotificationType, Workbench } from "vscode-extension-tester";
import { LoggerAggregator as logger } from "../utils/Logger";
import { NotificationPopup } from "../utils/Types";
import { exec } from "child_process";
import { assert } from "chai";
import * as util from "util";
import axios from "axios";
import { LoadAndParseJsonFile } from "../utils/FileSystem";
import { HttpsProxyAgent } from "https-proxy-agent";

export default function() {
    describe("Check help pages", () => {
        it("Check online help page", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout);
            await CheckOnlineHelpTest();
        });
        it("Check offline help page", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout);
            await CheckOfflineHelpPageTest();
        });
    });
}

//#region Tests

async function CheckOnlineHelpTest(): Promise<void> {
    logger.Info("Check online help page");
    try {
        const onlineHelpNotification: NotificationPopup = {
            name: "Online help notification",
            message: "Open online documentation",
            installButton: "Open"
        };

        await SetInputText("> Intel oneAPI: Open gdb-oneapi debugger online documentation (help)");
        const notifications = await GetNotifications(NotificationType.Any);

        for (const notification of notifications) {
            const message = await notification.getMessage();

            if (message === onlineHelpNotification.message) {
                const actions = await GetNotificationActions(notification);

                logger.Info("Count firefox processes");
                const initCount = await ProcessStart("ps aux | grep firefox | wc -l");
                const title = await actions[0].getText();

                assert.equal(title, onlineHelpNotification.installButton, `Open button doesn't exists. Actual: '${title}' | Expected: '${onlineHelpNotification.installButton}'`);
                logger.Pass(`Open button exists. Button: '${title}'`);
                await TakeNotificationAction(notification, onlineHelpNotification.installButton);                   
                const popup = await new Workbench().getDriver().findElement(By.className("monaco-dialog-box"));

                await Wait(2 * 1000);
                const linkWebElement = await popup.findElement(By.id("monaco-dialog-message-detail"));
                const link = await linkWebElement.getText();
                const popupButtons = await popup.findElements(By.className("monaco-button monaco-text-button"));
                const popupOpenButton = await (async() => {
                    for (const button of popupButtons) {
                        const name = await button.getText();

                        if (name === "Open") { return button; }
                    }
                    throw new Error("Can't find 'Open' button");
                })();

                assert.isTrue(link && link.startsWith("https:"), `Documentation url has not been found. Actual: '${link && link.startsWith("https:")}' | Expected: 'true'`);
                logger.Pass(`Documentation url has been found. Url: ${link}`);
                await Wait(2 * 1000);
                await popupOpenButton.click();
                await Wait(2 * 1000);
                const currentCount = await ProcessStart("ps aux | grep firefox | wc -l");
                const httpsAgent = new HttpsProxyAgent("http://proxy-dmz.intel.com:912");
                const { status } = await axios.get(link, { httpsAgent: httpsAgent });

                await ProcessStart("pkill -f firefox");
                const message = `Actual: '${Number(currentCount)}' ${Number(currentCount) > Number(initCount) ? ">" : "<"} '${Number(initCount)}' | Expected: '${Number(currentCount)}' > '${Number(initCount)}'`;

                assert.isAbove(Number(currentCount), Number(initCount), `Online documentation hasn't been opened. ${message}`);
                logger.Pass(`Online documentation has been opened. ${message}`);
                assert.equal(status, 200, `Online documentation responded with '${status}' status code. Actual: ${status} | Expected: 200 | Url: ${link}`);
                logger.Pass(`Online documentation responded with 200. Actual: ${status} | Expected: 200 | Url: ${link}`);
                break;
            }
        }
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        const editorView = new EditorView();

        logger.Info("Close all editors");
        await editorView.closeAllEditors();
    }
}

async function CheckOfflineHelpPageTest(): Promise<void> {
    try {
        logger.Info("Check offline help page");
        await SetInputText("> Intel oneAPI: List gdb-oneapi debugger unique commands (help)");
        const offlineHelpReference = LoadAndParseJsonFile("media/userHelp/content.json");//JSON.parse(fs.readFileSync("media/userHelp/content.json", "utf-8"));

        logger.Info("Get all nested values");
        const values = GetAllNestedValues(offlineHelpReference);
        let offlineHelpBody: string = "";

        await ExecuteInIFrame(async() => {
            await ExecuteInIFrame(async(driver) => {
                offlineHelpBody = await driver.getPageSource();
            });
        });
        for (const value of values) {
            const parsed = value.replace(/\s>\s+/g, " &gt; ").replace("<oneapiExt>", "<span class=\"oneapi-ext\">").replace("</oneapiExt>", "</span>").replace("</br>", "<br>");

            assert.include(offlineHelpBody, parsed, `Can't find desired line.\nExpected original: '${value}'\nExpected parsed: '${parsed}'\n`);
        }
    } catch (e) {
        logger.Error(e);
        throw e;
    } finally {
        const editorView = new EditorView();

        logger.Info("Close all editors");
        await editorView.closeAllEditors();
    }
}

//#endregion

async function ProcessStart(command: string): Promise<string | undefined | unknown> {
    let result: string | undefined | unknown;
    const execAsync = util.promisify(exec);

    logger.Info(`Perform '${command}' command`);
    try {
        const { stdout } = await execAsync(command);

        result = stdout;
    } catch (e) {
        result = e;
        logger.Error(e);
    }

    return result;
}

function GetAllNestedValues(jsonObject: unknown): string[] {
    if (typeof jsonObject !== "object") {
        return jsonObject as never;
    }
    let values: string[] = [];

    for (const key in jsonObject) {
        const value: unknown = jsonObject[key as keyof object];

        if (Array.isArray(value)) {
            for (const arrValue of value) {
                values = values.concat(GetAllNestedValues(arrValue));
            }
            continue;
        }
        values = values.concat(GetAllNestedValues(value));
    }
    return values;
}