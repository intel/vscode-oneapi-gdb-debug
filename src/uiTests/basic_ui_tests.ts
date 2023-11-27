import { VSBrowser } from "vscode-extension-tester";
import { TestFunctions } from "./utils/TestFunctions";
import { ConditionalBreakpointTypes, ThreadProperties, expectedNotifications } from "./utils/Consts";

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
    describe("Install extensions from notifications", () => {
        it("Install 'C/C++' extension", async function() {
            this.timeout(10 * 1000);
            await TestFunctions.InstallExtensionFromNotificationTest(expectedNotifications.c_cppExt);
        });
        it("Install 'Environment Configurator for Intel® oneAPI Toolkits' extensions", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.InstallExtensionFromNotificationTest(expectedNotifications.env_config);
        });
    });
    describe("Generate launch configurations", () => {
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
    describe("Check help pages", () => {
        it("Check online help page", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.CheckOnlineHelpTest(); 
        });
        it("Check offline help page", async function() {
            this.timeout(60 * 1000);
            await TestFunctions.CheckOfflineHelpPageTest(); 
        });
    });
    describe("Examine debugging functionality", () => {
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
        it("SIMD lane conditional breakpoint check using '> Intel oneAPI: Add SIMD lane conditional breakpoint' command", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.SimdLaneConditionalBreakpointTest(ConditionalBreakpointTypes.SimdCommand); 
        });
        it("SIMD lane conditional breakpoint check using 'Add Conditional Breakpoint...' context menu option", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.SimdLaneConditionalBreakpointTest(ConditionalBreakpointTypes.SimdGui); 
        });
        it("Conditional native breakpoint check using '> Debug: Add Conditional Breakpoint...' command", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.SimdLaneConditionalBreakpointTest(ConditionalBreakpointTypes.NativeCommand); 
        });
        it("Conditional native breakpoint check using 'Add Conditional Breakpoint...' context menu option", async function() {
            this.timeout(5 * 60 * 1000);
            await TestFunctions.SimdLaneConditionalBreakpointTest(ConditionalBreakpointTypes.NativeGui); 
        });
    });
});