import { VSBrowser } from "vscode-extension-tester";
import { TestFunctions } from "./utils/TestFunctions";
import { ThreadProperties, expectedNotifications } from "./utils/Consts";

describe("Basic UI tests", () => {
    let browser: VSBrowser;

    before(async function() {
        browser = VSBrowser.instance;
        await browser.openResources("../array-transform", "../array-transform/src/array-transform.cpp");
        await TestFunctions.InstallRequiredExtensions();
    });
    after(async function() {
        await TestFunctions.UninstallAllExtensions();
    });
    describe("Generate tasks", () => {
        it("Install 'C/C++' extension", async function() {
            this.timeout(10 * 1000);
            await TestFunctions.InstallExtensionFromNotificationTest(expectedNotifications.c_cppExt);
        });
        it("Install 'Environment Configurator for Intel® oneAPI Toolkits' extensions", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.InstallExtensionFromNotificationTest(expectedNotifications.env_config);
        });
        it("Generate 'run' task", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.GenerateTaskTest("run");
        });
        it("Generate 'run-cpu' task", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.GenerateTaskTest("run-cpu");
        });
        it("Generate 'run-gpu' task", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.GenerateTaskTest("run-gpu");
        });
        it("Generate 'run-fpga' task", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.GenerateTaskTest("run-fpga");
        });
        it("Generate 'Debug' launch configuration", async function() {
            this.timeout(120 * 1000);
            await TestFunctions.GenerateDebugLaunchConfigurationTest(); 
        });
        it("Check online help page", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.CheckOnlineHelpTest(); 
        });
        it("Check offline help page", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.CheckOfflineHelpPageTest(); 
        });
        it("Refresh SIMD data", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.RefreshSimdDataTest(); 
        });
        it("Check threads id", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.ValidateOneApiGpuThreadsTest(ThreadProperties.Id); 
        });
        it("Check threads location", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.ValidateOneApiGpuThreadsTest(ThreadProperties.Location); 
        });
    });
});