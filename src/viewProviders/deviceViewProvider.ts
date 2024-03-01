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
import { SortedDevices } from "../SimdProvider";
import { getNonce } from "./utils";

export class DeviceViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.deviceView";
    public _view!: WebviewView;
    private waitingIntervalId: ReturnType<typeof setInterval> | undefined = undefined;


    private htmlStart = "";
    private htmlEnd = "";

    constructor(private readonly _extensionUri: Uri) { }

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
    public async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, _token: CancellationToken) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true
        };

        // Set the HTML content that will fill the webview view
        this.setInitialPageContent(webviewView.webview);
    }

    private setInitialPageContent(webview: Webview) {
        const scriptUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "main.js"));

        const styleVSCodeUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "main.css"));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        const toolkitUri = this.getUri(webview, this._extensionUri, [
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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet

            <script type="module" src="${toolkitUri}"></script>
            <title>Hardware Info</title>
        </head>
        <body>`;

        this.htmlEnd = `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
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
            this._view.webview.html = this.htmlStart + "Error occured while getting devices info: "+ errMsg + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    public async setView(sortedDevices: SortedDevices) {
        let upd = "";

        for (const [threadGroups, devices] of Object.entries(sortedDevices)) {
            upd += `<div class="collapsible active">▷ ${threadGroups}</div>`;
            for (const device of devices) {
                const table = `<table class="content">
                    <tr><td>Number: </td>
                    <td>${device.number}</td></tr>
                    <tr><td>Name: </td>
                    <td>${device.device_name}</td></tr>
                    <tr><td>Location: </td>
                    <td>${device.location}</td></tr>
                    <tr><td>Sub device: </td>
                    <td>${device.sub_device}</td></tr>
                    <tr><td>Vendor ID: </td>
                    <td>${device.vendor_id}</td></tr>
                    <tr><td>Target ID: </td>
                    <td>${device.target_id}</td></tr>
                </table>`;

                upd += "&emsp;" + table + "<br>";
            }
        }

        try {
            this._view.webview.html = this.htmlStart + upd + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

}
