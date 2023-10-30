/**
 * Copyright (c) 2022-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import {
    CancellationToken,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { CurrentThread } from "../SimdProvider";

export class SelectedLaneViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.selectedLane";
    public _view!: WebviewView;
    private waitingIntervalId: ReturnType<typeof setInterval> | undefined = undefined;


    private htmlStart = "";
    private htmlEnd = "";

    constructor(private readonly _extensionUri: Uri) {}

    getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
        return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
    }

    public async waitForViewToBecomeVisible(callback: () => void, checkInterval: number = 50) {
        if (this.waitingIntervalId !== undefined) {
            clearInterval(this.waitingIntervalId);
            this.waitingIntervalId = undefined;
        }

        return new Promise<void>((resolve) => {
            this.waitingIntervalId = setInterval(() => {
                if (this._view && this._view.visible) {
                    clearInterval(this.waitingIntervalId);
                    this.waitingIntervalId = undefined;
                    callback();
                    resolve();
                }
            }, checkInterval);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async resolveWebviewView( webviewView: WebviewView, context: WebviewViewResolveContext, _token: CancellationToken) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set the HTML content that will fill the webview view
        this.setInitialPageContent(webviewView.webview, this._extensionUri);
    }

    private setInitialPageContent(webview: Webview, extensionUri: Uri){
        const toolkitUri = this.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);

        this.htmlStart = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="${toolkitUri}"></script>
          <title>Selected Lane Info</title>
        </head>
        <body>`;

        this.htmlEnd = "</body></html>";
    }

    public async setLoadingView() {
        try {
            this._view.webview.html = this.htmlStart + "<h4></h4>" + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }

    }

    public async setErrorView(errMsg: string) {
        try {
            this._view.webview.html = this.htmlStart + "Error occured while getting Selected Lane Info: " + errMsg + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    public async setView(currentThread: CurrentThread, executionMask: string, metBPConditions: boolean | undefined){

        let stateMsg = "Inactive";

        if (metBPConditions !== undefined && !metBPConditions) {
            stateMsg = "Active";
        } else {
            stateMsg = "Active - have met breakpoint conditions";
        }
        const table = `<table>
            <tr><td>Lane Index: </td>
            <td id="selectedLane">${currentThread.lane}</td></tr>
            <tr><td>State: </td>
            <td id="selectedMask">${stateMsg}</td></tr>
            <tr><td>Work-item Global ID (x,y,z): </td>
            <td id="workitemGlobalid">${currentThread.workitemGlobalid.toString()}</td></tr>
            <tr><td>Work-item Local ID (x,y,z): </td>
            <td id="workitemLocalid">${currentThread.workitemLocalid.toString()}</td></tr>
            <tr><td>Execution Mask: </td>
            <td id="selectedMask">${executionMask}</td></tr>
        </table>`;

        try {
            this._view.webview.html = this.htmlStart + table + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    // After setting "setContext", "oneapi:haveSIMD" to true, some time passes before initializing this._view,
    // so we check its presence every 50 ms
    private async ensureViewExists() {
        return new Promise<void>((resolve) => {
            const intervalId = setInterval(() => {
                if (this._view && this._view.visible) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 50);
        });
    }

    // After setting "setContext", "oneapi:haveSIMD" to true, some time passes before initializing this._view,
    // so we check its presence every 50 ms
    private async ensureViewExists() {
        return new Promise<void>((resolve) => {
            const intervalId = setInterval(() => {
                if (this._view && this._view.visible) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 50);
        });
    }
}
