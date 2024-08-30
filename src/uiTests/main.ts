/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { FileExistsSync, ReadFileSync, RmSync, WriteFileSync } from "./utils/FileSystem";
import { VSBrowser } from "vscode-extension-tester";
import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { install } from "source-map-support";
import { assert } from "chai";
import { tests } from "./tests";
import { Wait, Retry, GetExtensionsSection, UninstallExtension, InstallExtension } from "./utils/CommonFunctions";
import { Hook } from "mocha";

install();
logger.InitLoggers(new ConsoleLogger());
const resources = ["../array-transform", "../array-transform/src/array-transform.cpp"];

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async() => {
    for (const test of Object.values(tests)) {
        test.call(this);
    }
    afterEach(async function () {
        await CloseBrowser(this);
        await LaunchBrowser(this);
        await Wait(2* 1000);
        await VSBrowser.instance.openResources(...resources);
        SetToolBarLocationToDocked();
    });
    before(async function() {
        this.defaultTimeout = 60 * 1000;
        await VSBrowser.instance.openResources(...resources);
        RmSync("../array-transform/.vscode");
        SetToolBarLocationToDocked();
    });
});

async function CloseBrowser(context: Mocha.Context) {
    await Wait(1000);
    const closeHook = (<any>context.test?.parent?.parent)._afterAll[0] as Hook;
    await Promise.all([closeHook.fn?.call(context, () => {})]);
}

async function LaunchBrowser(context: Mocha.Context) {
    await Wait(1000);
    const before = (<any>context.test?.parent?.parent)._beforeAll[0] as Hook;
    await Promise.all([before.fn?.call(context, () => {})]);
}

function SetToolBarLocationToDocked() {
    logger.Info("Set toolbar location to docked");
    const vsCodeSettingsPath = "test-resources/settings/User/settings.json";

    if (!FileExistsSync(vsCodeSettingsPath)) {
        WriteFileSync(vsCodeSettingsPath, "{}");
    }
    const settings = JSON.parse(ReadFileSync(vsCodeSettingsPath, "utf-8"));

    settings["debug.toolBarLocation"] = "docked";
    WriteFileSync(vsCodeSettingsPath, JSON.stringify(settings));
}

async function InstallRequiredExtensions(extensions: string[]): Promise<void> {
    for await (const requiredExtension of extensions) {
        const isExtensionInstalled = await IsExtensionInstalled(requiredExtension);

        if (!isExtensionInstalled) {
            await InstallExtension(requiredExtension);
        }
    }
    await Wait(3 * 1000);
}

async function IsExtensionInstalled(extensionName: string): Promise<boolean | undefined> {
    return await Retry(async() => {
        const extensionsView = await GetExtensionsSection("Installed");

        await extensionsView.clearSearch();
        const extensionsList = await extensionsView.getText();
        const isInstalled = extensionsList.includes(extensionName);

        logger.Info(isInstalled ? `Extension: '${extensionName}' is installed` : `Extension: '${extensionName}' is not installed`);
        return isInstalled;
    }, 10 * 1000);
}

async function InstallExtensionViaMarketplace(extensionToInstall: string): Promise<void> {
    await Retry(async() => {
        const extensionsView = await GetExtensionsSection("Installed");

        await extensionsView.clearSearch();
        const extension = await extensionsView.findItem(extensionToInstall);

        if (await extension?.isInstalled()) {
            logger.Info(`Extension '${extensionToInstall}' is already installed. SKIP`);
        }
        logger.Info(`Install '${extensionToInstall}' extension`);
        await extension?.install();
        const installed = await extension?.isInstalled();

        assert.isTrue(installed, `Installation of '${extensionToInstall}' failed. Actual: ${installed} | Expected: 'true'`);
        logger.Pass(`Extensions ${extensionToInstall} has been installed. Actual: ${installed} | Expected: 'true'`);
        await extensionsView.clearSearch();
    }, 60 * 1000);
}

async function UninstallAllExtensions(): Promise<void> {
    const extensionsToUninstall = [
        "Environment Configurator for Intel® oneAPI Toolkits",
        "C/C++",
    ];

    for await (const extension of extensionsToUninstall) {
        await UninstallExtension(extension);
    }
}