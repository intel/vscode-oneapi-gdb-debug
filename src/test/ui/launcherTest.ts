import { Workbench, VSBrowser} from "vscode-extension-tester";
import { DialogHandler } from "vscode-extension-tester-native";
import { execSync } from "child_process";
import { mkdirSync, rmdirSync } from "fs";
import * as path from "path";

describe("Launcher Extension basic tests", () => {
    let browser: VSBrowser;
    let workbench: Workbench;
    let executablePath: string;
    const workspacePath = path.join(process.cwd(), "test-data", "launchers-workspace");

    before(() => {
        mkdirSync(workspacePath, { recursive: true });
        const sourcePath = path.join(process.cwd(), "src", "test", "ui", "assets", "hello-world.c");
        executablePath = path.join(workspacePath, "hello-world");
        execSync(`gcc ${sourcePath} -o ${executablePath}`);
    });

    before(async function () {
        this.timeout(20000);

        workbench = new Workbench();
        browser = VSBrowser.instance;

        await workbench.executeCommand("File: Open Folder");
        const dialog = await DialogHandler.getOpenDialog();
        await dialog.selectPath(workspacePath);
        await dialog.confirm();
        await browser.driver.sleep(1000);
    });

    // Tests here
    //
    // it("TestName", function(){});
    //
    // ----------


    after(() => {
        rmdirSync(workspacePath, { recursive: true });
    });
});
