import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";
import * as fs from "fs";

export class SyscheckViewProvider implements vscode.TreeDataProvider<Dependency> {
    private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

    private tests: Dependency[] = [];

    constructor(private context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                "intelOneAPI.syscheckView.run",
                async () => {
                    await vscode.window.withProgress(
                        { location: { viewId: "intelOneAPI.syscheckView" } },
                        async () => {
                            const output = await this.createSysReport();
                            if (output) {
                                this.parseOutputAndRefresh(output);
                            }
                            return;
                        }
                    );
                }
            )
        );
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Dependency): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Dependency): Thenable<Dependency[]> {
        if (element) {
            return Promise.resolve(element.children);
        } else {
            return Promise.resolve(this.tests);
        }
    }

    private async createSysReport(): Promise<string | undefined> {
        const rootPath = await this.getDefaultRootPath();
        let output: string | undefined = undefined;
        if (rootPath !== undefined) {
            const scriptPath = path.join(
                rootPath,
                "debugger",
                "latest",
                "etc",
                "debugger",
                "sys_check",
                "sys_check.sh"
            );
            const command = `${scriptPath} -v`;
            output = await this.executeCommand(command, "logs");
        } else {
            vscode.window.showErrorMessage(
                `Root path for Intel oneAPI environment is undefined.\n\n` +
                `This issue may occur if the Intel oneAPI environment variables are not properly configured.\n\n` +
                `To resolve this, please use the "Environment Configurator for Intel Software Developer Tools" extension ` +
                `to set up your environment.`,
                { modal: true }
            );
            return undefined;
        }

        return output;
    }

    private executeCommand(command: string, logDirName: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure the log directory exists
                const logsDir = logDirName;
                await fs.promises.mkdir(logsDir, { recursive: true });

                // Change to the logs directory
                const options = { cwd: logsDir };

                // Execute the command in the specified directory
                exec(command, options, (error, stdout, stderr) => {
                    if (error) {
                        vscode.window.showErrorMessage(`Error: ${stderr}`);
                        return reject(error);
                    }
                    resolve(stdout);
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error creating directory: ${(error as Error).message}`);
                reject(error);
            }
        });
    }

    private parseOutputAndRefresh(output: string) {
        const lines = output.split("\n");

        // Extract the script version
        const versionMatch = output.match(/version ([\d.]+)/);
        const scriptVersion = versionMatch ? versionMatch[1] : "Unknown";

        // Extract the date and other header information
        const dateMatch = output.match(/at (.+)$/m);
        const date = dateMatch ? dateMatch[1] : new Date().toISOString();

        // Create a header TreeItem
        const headerText = `Tests executed on ${date} using script version ${scriptVersion}`;
        const headerItem = new Dependency(headerText, "", vscode.TreeItemCollapsibleState.None);

        // Filter relevant lines containing the test information
        const relevantLines = lines.filter(
            (line) => line.includes("|") && !line.includes("Check Name") && !line.includes("-------")
        );

        // Create TreeItems for each test
        const testItems = relevantLines.map((line) => {
            const [testName, description, status, details] = line
                .split("|")
                .map((part) => part.trim());

            let iconPath;

            // Choose different icons based on the status
            if (status === "PASS") {
                iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));  // Green checkmark
            } else if (status === "FAIL") {
                iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));   // Red cross
            } else if (status === "WARNING") {
                iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconWarning")); // Orange warning
            } else {
                iconPath = new vscode.ThemeIcon("question"); // Default question mark icon for unknown status
            }

            // Create child item with details and indent it
            const detailItem = new Dependency(
                `\t${details}`,
                "",
                vscode.TreeItemCollapsibleState.None
            );

            const testItem = new Dependency(
                testName,
                ` ${status}`,
                details ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                iconPath,
                [detailItem] // Add the detail as a child item
            );
            testItem.tooltip = `${description}`;  // Set tooltip with the description

            return testItem;
        });

        // Combine the header with the test items
        this.tests = [headerItem, ...testItems];

        this.refresh();
    }

    private async getDefaultRootPath(): Promise<string | undefined> {
        const oneApiRoot = process.env["ONEAPI_ROOT"];
        const defaultPath = oneApiRoot ? oneApiRoot : undefined;
        if (!defaultPath) {
            return undefined;
        }

        try {
            await fs.promises.access(defaultPath, fs.constants.F_OK);
            return defaultPath;
        } catch (err) {
            return undefined;
        }
    }
}

class Dependency extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private result: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        iconPath?: vscode.ThemeIcon,
        public readonly children: Dependency[] = []
    ) {
        super(label, collapsibleState);
        this.description = result;
        this.iconPath = iconPath;
        this.children = children;
    }
}
