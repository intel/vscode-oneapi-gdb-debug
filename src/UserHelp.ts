/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */
"use strict";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";


export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media/userHelp` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "userHelp")]
    };
}

export class UserHelp {
    private gdbOneapiDocumentationLink = "https://software.intel.com/gdb-oneapi-documentation";

    openOnlineDocumentation(): void {
        vscode.window
            .showInformationMessage("Open online documentation", "Open")
            .then(selection => {
                if (selection === "Open") {
                    vscode.env.openExternal(vscode.Uri.parse(this.gdbOneapiDocumentationLink));
                }
            });
    }
}

type UserHelpData = {
    readonly features: Features;
    readonly comparison: Comparison;
    readonly oneapiNewCommands: OneapiNewCommands;
};

type Features = {
    intro: string;
    featurePointedList: Array<string>;
};

type Comparison = {
    intro: string;
    commands: Array<SimpleDescription>;
};

type OneapiNewCommands = {
    intro: string;
    chapters: Array<Chapter>;
};

type Chapter = {
    name: string;
    commands: Array<SimpleDescription>;
};

type SimpleDescription = {
    name: string;
    description?: string;
};
export class DebuggerCommandsPanel {
    public static currentPanel: DebuggerCommandsPanel | undefined;
    public static readonly viewType = "debuggerCommands";
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    userHelpJSONFile = fs.readFileSync(path.join(__dirname, "..", "media", "userHelp", "content.json"), "utf8");
    userHelp: UserHelpData = JSON.parse(this.userHelpJSONFile);

    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined; // If we already have a panel, show it.

        if (DebuggerCommandsPanel.currentPanel) {
            DebuggerCommandsPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            DebuggerCommandsPanel.viewType,
            "Debugger Commands",
            column || vscode.ViewColumn.One,
            getWebviewOptions(extensionUri),
        );

        DebuggerCommandsPanel.currentPanel = new DebuggerCommandsPanel(panel, extensionUri);
        // sending JSON data to the webview
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
        DebuggerCommandsPanel.currentPanel = new DebuggerCommandsPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                case "alert":
                    vscode.window.showErrorMessage(message.text);
                    return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose(): void {
        DebuggerCommandsPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();

            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;

        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    listPoints(list: Array<string>): string {
        let htmlList = "<ul class=\"pointed-list\">";

        for (const i in list) {
            htmlList += `<li>${list[i]}</li>`;
        }
        htmlList += ("</ul>");
        return htmlList;
    }

    getTable(content: Array<SimpleDescription>, cssClass: string): string {
        let table = `<table class="${cssClass}">${cssClass.includes("small-table")
            ? ""
            : "<thead><tr><th>Command</th><th>Description</th></tr></thead>"
        }<tbody>`;
        const oneapiExtCssClass = "oneapi-ext";

        for (const i in content) {
            const name = content[i].name
                .replace("<oneapiExt>", `<span class='${oneapiExtCssClass}'>`)
                .replace("</oneapiExt>", "</span>");

            table += `<tr><td>${cssClass.includes("numeric") ? `${(parseInt(i) + 1)}.</td><td>` : ""}${name.trim()}</td><td>${content[i]["description"] ? content[i].description : ""}</td></tr>`;
        }
        table += "</tbody></table>";
        return table;
    }

    listTablesWithTitles(content: Array<Chapter>): string {
        let list = "";

        for (const entry of content) {
            list += `<p class="small-intro">${entry.name}</p>`;
            list += this.getTable(entry.commands, "small-table numeric");
        }
        return list;
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Links to documentations
        const oneapiCheatsheetLink = "https://software.intel.com/gdb-oneapi-cheatsheet ";
        const oneapiUserManualLink = "https://software.intel.com/gdb-oneapi-manual ";
        const oneapiDocumentationLink = "https://software.intel.com/gdb-oneapi-documentation";
        const gdbDocumentationLink = "https://www.gnu.org/software/gdb/documentation/";

        // Local path to css styles
        const styleMainPath = vscode.Uri.joinPath(this._extensionUri, "media", "userHelp", "style.css");

        // Uri to load styles into webview
        const styleMainUri = webview.asWebviewUri(styleMainPath);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        // vscode.window.activeColorTheme.kind
        // 1 - light mode
        // 2 - dark mode
        // 3 - high contrast mode
        const activeColorTheme = vscode.window.activeColorTheme.kind;

        return `<!DOCTYPE html>
             <html lang="en">
             <head>
                 <meta charset="UTF-8">
                 <!--
                     Use a content security policy to only allow loading images from https or from our extension directory,
                     and only allow scripts that have a specific nonce.
                 -->
                 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
                 <link href="${styleMainUri}" rel="stylesheet">
                 <title>Usefull GDB-oneAPI Commands</title>
             </head>
             <body>
                <div class="body-wrapper ${activeColorTheme===1 ? "light-mode" : "dark-mode"}">
                    <div class="left-menu">
                        <div class="left-menu-positioning">
                            <div class="documentation-resources title">
                                <span class="center">Documentation resources:</span>
                            </div>
                            <div class="documentation-resources-list-wrapper">
                                <ul class="documentation-resources" id="documentation-resources">
                                    <li class="section-name">Intel® Distribution for GDB</li>
                                    <li class="inner"><a class="header-link" href="${oneapiDocumentationLink}">Online Documentation</a></li>
                                    <li class="inner"><a class="header-link" href="${oneapiUserManualLink}">User Manual (PDF)</a></li>
                                    <li class="inner"><a class="header-link" href="${oneapiCheatsheetLink}">Cheatsheet (PDF)</a></li>
                                    <li class="section-name}">GDB</a></li>
                                    <li class="inner"><a class="header-link" href="${gdbDocumentationLink}">Online Documentation</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="right-content">
                        <div class="header">
                            <h1>Diferrences between GDB and Intel® Distribution for GDB:<h1>
                        </div>
                        <div class="content" id="bodyContent">
                            <p class="intro">${this.userHelp.features.intro}</p>
                            <div class="list-wrapper">
                                ${this.listPoints(this.userHelp.features.featurePointedList)}
                            </div>
                            <p class="intro">${this.userHelp.comparison.intro}</p>
                            ${this.getTable(this.userHelp.comparison.commands, "table")}
                            <p class="intro">${this.userHelp.oneapiNewCommands.intro}</p>
                            <div class="oneapi-new-commands ${activeColorTheme===1 ? "light-mode" : "dark-mode"}">
                                ${this.listTablesWithTitles(this.userHelp.oneapiNewCommands.chapters)}
                            </div>
                        </div>
                    </div>
                </div>
             </body>
             </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
