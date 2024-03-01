/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { FileExistsSync, ReadFileSync, WriteFileSync } from "./utils/FileSystem";
import { VSBrowser } from "vscode-extension-tester";
import { ConsoleLogger, LoggerAggregator as logger } from "./utils/Logger";
import { install } from "source-map-support";
import { assert } from "chai";
import { tests } from "./tests";
import { Wait, Retry, GetExtensionsSection, UninstallExtension } from "./utils/CommonFunctions";

install();
logger.InitLoggers(new ConsoleLogger());

describe("'GDB with GPU Debug Support for Intel® oneAPI Toolkits' extension tests", async() => {
    for (const test of Object.values(tests)) {
        test.call(this);
    }
    
    after(async function() {
        await UninstallAllExtensions();
    });
    before(async function() {
        this.defaultTimeout = 60 * 1000;
        await VSBrowser.instance.openResources("../array-transform", "../array-transform/src/array-transform.cpp");
        await InstallRequiredExtensions();
        SetToolBarLocationToDocked();
    });
});

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

async function InstallRequiredExtensions(): Promise<void> {
    logger.Info("Check if required extensions are installed");
    const requiredExtensions = [
        "Analysis Configurator for Intel® oneAPI Toolkits",
        "C/C++",
        "CMake Tools",
        "Code Sample Browser for Intel® oneAPI Toolkits",
        "Environment Configurator for Intel® oneAPI Toolkits",
    ];

    for await (const requiredExtension of requiredExtensions) {
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
    }, 5 * 1000);
}

async function InstallExtension(extensionToInstall: string): Promise<void> {
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