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

export class ThreadInfoViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.threadInfo";
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
          <title>Thread Info</title>
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
            this._view.webview.html = this.htmlStart + "Error occured while getting Thread Info: " + errMsg + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    public async setView(currentThread: CurrentThread, hitLanesMask: string, length: number, metBPConditions: boolean | undefined){
        const table = `<table>
            <tr><td>ID: </td>
            <td id="threadID">${currentThread.threadId}</td></tr>
            <tr><td>Active Lanes Mask: </td>
            <td id="hitLanesMask">${metBPConditions ? hitLanesMask : "-"}</td></tr>
            <tr><td>SIMD Width: </td>
            <td id="width">${length}</td></tr>
        </table>`;

        try {
            this._view.webview.html = this.htmlStart + table + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }
}
