"use strict";
import * as vscode from "vscode";

export class SchedulerLocking {

    private schedulerStatusBarItem: vscode.StatusBarItem;
    private schedulerLockingStates: { [option: string]: string } = {};

    constructor(private context: vscode.ExtensionContext) {
        this.schedulerStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
        context.subscriptions.push(this.schedulerStatusBarItem);

        // Register commands
        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.schedulerLockingContinueOff", () => {
            this.toggleSchedulerLocking("continue");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.schedulerLockingContinueOn", () => {
            this.toggleSchedulerLocking("continue");
        }));

        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.schedulerLockingStepOff", () => {
            this.toggleSchedulerLocking("step");
        }));
        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.schedulerLockingStepOn", () => {
            this.toggleSchedulerLocking("step");
        }));

        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.schedulerLockingStatusBarRefresh", () => {
            this.updateStatusBarMessage();
        }));
    }

    private async toggleSchedulerLocking(option: "continue" | "step") {
        try {
            const currentStatus = this.schedulerLockingStates[option] ?? "off";
            const newStatus = currentStatus === "on" ? "off" : "on";

            await this.sendExecCommand(`set scheduler-locking ${option} ${newStatus}`);
            this.schedulerLockingStates[option] = newStatus;
            this.updateStatusBarMessage();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to set scheduler-locking ${option}: ${(error as Error).message}`);
        }
    }

    private async sendExecCommand(command: string): Promise<string> {
        const session = vscode.debug.activeDebugSession;

        if (!session) {
            throw new Error("No active debug session");
        }
        await session.customRequest("threads");
        try {
            const result = await session.customRequest("evaluate", {
                expression: `-exec ${command}`,
                context: "repl"
            });

            return result.result;
        } catch (error) {
            console.error(`Error sending command '-exec ${command}':`, error);
            throw error;
        }
    }

    private async updateStatusBarMessage() {
        const states = await this.getSchedulerLockingState();

        if (states) {
            this.schedulerLockingStates = states;
            this.updateStatusBarDisplay();
        } else {
            this.schedulerStatusBarItem.hide();
        }

    }

    private async getSchedulerLockingState(): Promise<{ [option: string]: string } | null> {
        try {
            const output = await this.sendExecCommand("show scheduler-locking");
            const states: { [option: string]: string } = {};

            // Define a global regex to match all scheduler-locking options
            const regex = /scheduler-locking\s+([\w\s]+):\s+"(\w+)"/g;
            let match: RegExpExecArray | null;

            // Iterate over all matches in the output
            // eslint-disable-next-line no-cond-assign
            while ((match = regex.exec(output)) !== null) {
                const option = match[1].trim(); // e.g., 'replay continue'
                const state = match[2].trim();  // e.g., 'on' or 'off'

                states[option] = state;
            }

            return states;
        } catch (error) {
            if ((error as Error).message.includes("Unable to perform this action because the process is running")) {
                this.schedulerStatusBarItem.hide();
            } else {
                console.error("Error getting scheduler-locking state:", error);
            }
            return null;
        }
    }


    private updateStatusBarDisplay() {
        const activeOptions: string[] = [];
        const states = this.schedulerLockingStates;
        let backgroundColor: vscode.ThemeColor | undefined;

        if (states["step"] === "on") {
            activeOptions.push("step");
            vscode.commands.executeCommand("setContext", "schedulerLockingStepOn", true);
        } else {
            vscode.commands.executeCommand("setContext", "schedulerLockingStepOn", false);
        }

        if (states["continue"] === "on") {
            activeOptions.push("continue");
            vscode.commands.executeCommand("setContext", "schedulerLockingContinueOn", true);
        } else {
            vscode.commands.executeCommand("setContext", "schedulerLockingContinueOn", false);
        }

        if (activeOptions.length > 0) {
            this.schedulerStatusBarItem.text = `$(lock) Scheduler-locking: ${activeOptions.join(", ")}`;

            // Set background color based on the combination
            if (states["step"] === "on" && states["continue"] === "on") {
                // Both are on
                backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
            } else if (states["step"] === "on") {
                // Only 'step' is on
                backgroundColor = new vscode.ThemeColor("statusBarItem.hoverForeground");
            } else if (states["continue"] === "on") {
                // Only 'continue' is on
                backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
            }

            this.schedulerStatusBarItem.backgroundColor = backgroundColor;
        
            // Build the tooltip with all states
            const tooltipLines = Object.entries(states).map(
                ([option, state]) => `${option}: ${state}`
            );
            const tooltipText = tooltipLines.join("\n");

            this.schedulerStatusBarItem.tooltip = tooltipText;

            this.schedulerStatusBarItem.show();
        } else {
            this.schedulerStatusBarItem.hide();
            this.schedulerStatusBarItem.backgroundColor = undefined;
        }
    }
}
