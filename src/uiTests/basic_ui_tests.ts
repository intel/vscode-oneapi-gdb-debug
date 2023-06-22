import { VSBrowser } from "vscode-extension-tester";
import { TestFunctions } from "./utils/TestFunctions";
describe("Basic UI tests", () => {
    let browser: VSBrowser;
    const expectedNotifications: Record<string, INotification> = {
        c_cppExt: {
            name: "C/C++",
            message : "No extension for C/C++ was found. Please install it to run Intel oneAPI launch configurations.",
            installButton : "Install C/C++ Extension"
        },
        env_config: {
            name: "Environment Configurator for Intel® oneAPI Toolkits",
            message : "Please install the \"Environment Configurator for Intel oneAPI Toolkits\" to configure your development environment.",
            installButton : "Environment Configurator for Intel oneAPI Toolkits"
        },
    };
    
    before(async function() {
        browser = VSBrowser.instance;
        await browser.openResources("../array-transform", "../array-transform/src/array-transform.cpp");
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
    });
});