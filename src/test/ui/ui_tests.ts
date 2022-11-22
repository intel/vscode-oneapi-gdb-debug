/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { SideBarView, ExtensionsViewSection, Notification, NotificationType,VSBrowser, WebDriver, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { existsSync, readFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path/win32";




describe("GDB with GPU Debug Support for Intel(R) oneAPI Toolkits basic tests", () => {
    let browser: VSBrowser;
    let driver: WebDriver;
    let workbench: Workbench;

    before(async() => {
        browser = VSBrowser.instance;
        driver = browser.driver;
        workbench = new Workbench();
    });
    const expectedNotifications = {
        c_cppExt : {
            willInstalled: "C/C++",
            message : "No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.",
            install_button : "Install C/C++ Extension"
        },
        env_config : {
            willInstalled: "Environment Configurator for Intel® oneAPI Toolkits",
            message : "Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.",
            install_button : "Environment Configurator for Intel oneAPI Toolkits"
        },
    };

    describe("Notifications do appear and works", () => {
        //With a clean install, we expect two notifications
        it("Contain the correct number of notifications", async function() {
            const center = await workbench.openNotificationsCenter();

            const notifications = await center.getNotifications(NotificationType.Any);

            expect(notifications.length).equal(2);
        });

        it("C_Cpp extension can be installed", async function() {
            const center = await workbench.openNotificationsCenter();

            const notifications = await center.getNotifications(NotificationType.Any);

            for (const notification of notifications){
                const message = await notification.getMessage();

                if (message === expectedNotifications.c_cppExt.message) {
                    const actions = await notification.getActions();

                    const title = await actions[0].getTitle();

                    expect(title).equal(expectedNotifications.c_cppExt.install_button);
                    await notification.takeAction(expectedNotifications.c_cppExt.install_button);
                    await driver.sleep(2000);
                }
            }
        });

        it("Env config extension can be installed", async function() {
            const center = await workbench.openNotificationsCenter();

            const notifications = await center.getNotifications(NotificationType.Any);

            for (const notification of notifications){
                const message = await notification.getMessage();

                if (message === expectedNotifications.env_config.message) {
                    const actions = await notification.getActions();

                    const title = await actions[0].getTitle();

                    expect(title).equal(expectedNotifications.env_config.install_button);
                    await notification.takeAction(expectedNotifications.env_config.install_button);
                    await driver.sleep(2000);
                }
            }
        });

        
    });
    describe("Required extensions was installed", () => {
        let text : string;

        it("Get installed Extension list", async function() {
            const extensionView = await workbench.getActivityBar().getViewControl("Extensions");

            await extensionView?.openView();
            const sidebar = workbench.getSideBar();
            const sidebarView = sidebar.getContent();
            const inst_ext = await sidebarView.getSection("Installed");

            text = await inst_ext.getText();

        });

        it("C/C++ was installed", async function() {
            expect(text).include(expectedNotifications.c_cppExt.willInstalled);
        });

        it("Environment Configurator for Intel® oneAPI Toolkits", async function() {
            expect(text).include(expectedNotifications.env_config.willInstalled);

        });
    });
});
