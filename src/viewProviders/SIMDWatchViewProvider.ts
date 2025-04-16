/**
 * Copyright (c) 2024-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import {
    commands,
    CancellationToken,
    Uri,
    window,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    ExtensionContext
} from "vscode";

import { EventEmitter } from "events";
import { getNonce } from "./utils";
import { SIMDWatchProvider, WatchRequests, Request, Variable, reqVariablesList, Variables } from "../SimdWatchProvider";
import { checkGbdOneapiSession } from "../viewProviders/utils";

interface Data { 
    expression: string; 
    range: string; 
    uniqueId: string;
    varName: string;
    level: number;
    html: string;
 };

 interface RowArguments {
    uniqueId: string;
    expression: string;
    vars?: Variable[];
    rootVarName?: string;
    type?: string;
    simdWidth?: number;
    level: number;
    numchild?: number;
 };

type Dictionary = { [key: string]: string };

const tagsToReplace: Dictionary = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
};

export class SIMDWatchViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.watchPanel.simdWatchView";
    public _view!: WebviewView;
    private emitter: EventEmitter;
    private _provider: SIMDWatchProvider | undefined;

    private htmlStart = "";
    private htmlEnd = "";
    private maxLength = 18;

    constructor(
		private readonly _extensionUri: Uri,
		private context: ExtensionContext,
    ) {

        this.emitter = new EventEmitter();

    }

    getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
        return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, _token: CancellationToken) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true
        };

        // Set the HTML content that will fill the webview view
        await this._setWebviewMessageListener(webviewView);
        this.setInitialPageContent(webviewView.webview);
        commands.executeCommand("intelOneAPI.watchPanel.fetchSimdWatchPanel");
    }

    private setInitialPageContent(webview: Webview) {
        const scriptUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "simd-watch.js"));
        const styleVSCodeUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "media", "simd-watch.css"));

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
            <link href="${styleMainUri}" rel="stylesheet">

            <script type="module" src="${toolkitUri}"></script>
            <title>SIMD Watch</title>
        </head>
        <body>`;

        this.htmlEnd = `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public setErrorView() {
        this._view.webview.html = this.htmlStart + "Error occured while getting devices info" + this.htmlEnd;
    }

    public showExpInput() {

        this._view.webview.postMessage({
            command: "showExpInput",
            payload: JSON.stringify({ data: "" })
        });
    }

    /* Helper to create one <td>. */
    private makeCell(value: string, classList: Array<string>, colspan: number | undefined) {
        let classes = (classList.length === 0) ? "cell" : "cell " + classList.join(" ");
        const colspanAttr = colspan ? " colspan=\"" + colspan + "\"" : "";

        if (value === "") {
            classes += " empty";
        }

        return `<td class=\"${classes}\" ${colspanAttr}>${value}</td>`;
    }
    
    private escapeHtml(str: string) {
        return str.replace(/[&<>]/g, function(tag: string) {
            return tagsToReplace[tag] || tag;
        });
    }

    private getValueClasses(value: string) {
        const classes: string[] = ["value", "available"];

        /* Add type based classes. */
        if (!isNaN(+value)) {
            classes.push("number");
        } else if (value === "true" || value === "false") {
            classes.push("bool");
        }

        return classes;
    }

    private prepareValue(value: string) {
        if (value.length <= this.maxLength) {
            return this.escapeHtml(value);
        }

        const shortenedValue = this.escapeHtml(value.substring(0, this.maxLength));

        return `<span class="shortTooltip">${shortenedValue}…<span class="shortTooltipText">${this.escapeHtml(value)}</span></span>`;
    }

    private makeValueCells(args: RowArguments, hasChildren: boolean) {
        const simdWidth = args.simdWidth ? args.simdWidth : 32;

        if (!args.vars || args.vars.length === 0) {
            /* Anonymous unions don't have vars, but have children. */
            if (hasChildren) {
                return this.makeCell("", ["value"], undefined).repeat(simdWidth);
            }
            /* We show "not unavailable" in the first cell and the rest are empty. */
            return this.makeCell("not available", ["unavailable", "value"], undefined)
                + this.makeCell("", ["unavailable", "value"], undefined) .repeat(simdWidth - 1);
        }
        let varIndex = 0;
        let cells: string = "";

        /* Create cells for each lane. */
        for (let lane = 0; lane < simdWidth; lane++) {
            if (args.vars[varIndex] && lane === args.vars[varIndex].lane) {
                /* The lane is active. */
                if (hasChildren && args.level > 0 
                        && (args.vars[varIndex].value === "{...}")) {
                    /* We don't show "{...}" for children. But there could be 
                    a variable with a value and children, e.g. a pointer to struct
                    or char array. */
                    cells += this.makeCell("", this.getValueClasses(""), undefined);
                } else {
                    /* Cells with real values. */
                    const value: string = this.prepareValue(args.vars[varIndex].value);

                    cells += this.makeCell(value, this.getValueClasses(value), undefined);
                }
                varIndex++;
            } else {
                /* The lane is inactive. Create an empty cell. */
                cells += this.makeCell("", this.getValueClasses(""), undefined);
            }
        }

        return cells;
    }

    private makeExpressionCell(args: RowArguments, hasChildren: boolean, isRoot: boolean) {
        let expressionContent = "";

        /* Stackable level indents */
        expressionContent += "<div class=\"level-indent\"></div>".repeat(args.level);

        /* A tree element */
        expressionContent += "<div class=\"expand-box\">";
        if (hasChildren) {
            expressionContent += "<div class=\"expand tree collapsed\"></div>";
        } else {
            expressionContent += "<div class=\"expand\"></div>";
        }
        expressionContent += "</div>";

        /* Expression itself */
        expressionContent += `<div class="expression">${this.prepareValue(args.expression)}`;
        if (isRoot) {
            expressionContent += ":";
        }
        expressionContent += "</div>";
        /* Final expression cell. */
        return this.makeCell(expressionContent, ["expression-cell"], undefined);
    }

    /* Make a standard watch expression row. */
    private makeRow(args: RowArguments) {
        const varAttr = (args.rootVarName) ? `data-var-name="${args.rootVarName}"` : "";
        let row = `<tr class="row" data-id="${args.uniqueId}" data-level="${args.level}" ${varAttr}>`;
        const isRoot = args.level === 0;
        let numchild = 0;

        if (args.numchild && args.numchild !== 0) {
            numchild = args.numchild;
        } else if (args.vars && args.vars.length > 0) {
            numchild = args.vars[0].numchild;
        }
        const hasChildren = numchild > 0;

        row += this.makeExpressionCell(args, hasChildren, isRoot);
        row += this.makeValueCells(args, hasChildren);

        /* Remove only for root expressions. */
        if (isRoot) {
            row += this.makeCell("<span class=\"remove\"></span>", ["remove-cell"], undefined);
        }

        row += "</tr>";

        return row;
    }

    private makeHeader(simdWidth: number | undefined) {
        if (!simdWidth) {
            simdWidth = 32;
        }

        /* Needed for column hovering. */
        let row = `<colgroup>${"<col/>".repeat(simdWidth + 2)}</colgroup>`;
        
        row += "<thead><tr class=\"header\">";
        /* expression column */
        row += "<th class=\"cell\"></th>";
        
        /* lanes column */
        for (let i = 0; i < simdWidth; i++) {
            row += "<th class=\"cell lane\">[" + i + "]</th>";
        }

        /* remove column */
        row += "<th class=\"cell\"></th></tr></thead>";
        return row;
    }

    /* Make a row with the input. */
    private makeInputRow(simdWidth: number | undefined) {
        if (!simdWidth) {
            simdWidth = 32;
        }
        /* the row is hidden by default. */
        let row = "<tr class=\"row input-row hidden\">";
        const input = "<input type=\"text\" class=\"expression-input\" placeholder=\"Expression to watch\"/>";

        row += this.makeCell(input, ["expression-cell"], simdWidth + 1);
        row += this.makeCell("<span class=\"remove\"></span>", ["remove-cell"], undefined);
        row += "</tr>";
        return row;
    }

    /* Generate and set full view HTML. */
    public async setView(provider: SIMDWatchProvider) {
        this._provider = provider;
        const watchRequests = this.context.globalState.get<WatchRequests>("WatchRequests");
        let htmlContent = "";
        const rows : string[] = [];
        let tableContent = "";

        const session = await checkGbdOneapiSession();

        await window.withProgress(
            { location: { viewId: "intelOneAPI.watchPanel.simdWatchView" } },
            async() => {
                if (!session) {
                    /* Debugger has not started. */
                    if (watchRequests) {
                        watchRequests.requests.forEach((request, index) => {
                            rows[index] = this.makeRow({
                                uniqueId: request.uniqueId,
                                expression: request.expression,
                                level: 0
                            });

                        });
                    }
                    rows.push(this.makeInputRow(undefined));
                } else {
                    /* Debugger has started. */
                    const simdWidth = await provider.getSIMDWidth(session);

                    tableContent += this.makeHeader(simdWidth.width);

                    if (watchRequests) {
                        /* There are some watch requests already. */
                        const fetchedVars = provider.fetchVars(watchRequests, session);

                        watchRequests.requests.forEach((request, index) => {
                            /* Once a request is resolved, start with its row generation. */
                            fetchedVars.promises[index].then(() => {
                                const response = fetchedVars.reqVariablesList.vars[index];

                                rows[index] = this.makeRow({
                                    uniqueId: request.uniqueId,
                                    expression: request.expression,
                                    vars: response.vars,
                                    rootVarName: (response.vars && response.vars.length > 0)
                                        ? response.vars[0].name : undefined,
                                    simdWidth: simdWidth.width,
                                    level: 0
                                });
                            });
                        });
                        /* Wait all requests to finish. */
                        await Promise.all(fetchedVars.promises);
                    }
                    /* Last row is with input. */
                    rows.push(this.makeInputRow(simdWidth.width));
                }

                tableContent += "<tbody>" + rows.join("") + "</tbody>";
                tableContent = "<table id=\"simd-watch\" class=\"table\">" + tableContent + "</table>";

                htmlContent += tableContent;

                await this.ensureViewExists();
                this._view.webview.html = this.htmlStart + htmlContent + this.htmlEnd;
            }
        );
    }

    /* Return HTML which needs to be added to the table when a new requests
       are submitted. */
    public async addRows(newRequests: WatchRequests): Promise<string> {
        const watchRequests = this.context.globalState.get<WatchRequests>("WatchRequests");
        const rows: string[] = [];
    
        if (watchRequests) {
            const session = await checkGbdOneapiSession();
    
            if (!session || !this._provider) {
                newRequests.requests.forEach((request, index) => {
                    rows[index] = this.makeRow({
                        uniqueId: request.uniqueId, 
                        expression: request.expression,
                        level: 0
                    });
                });
            } else {
                const simdWidth = await this._provider.getSIMDWidth(session);
                const fetchedVars = this._provider.fetchVars(newRequests, session);

                newRequests.requests.forEach((request, index) => {
                    /* Start generating a row once a request is resolved. */
                    fetchedVars.promises[index].then(() => {
                        const response = fetchedVars.reqVariablesList.vars[index];
    
                        rows[index] = this.makeRow({
                            uniqueId: request.uniqueId, 
                            expression: request.expression,
                            vars: response.vars,
                            rootVarName: (response.vars && response.vars.length > 0) 
                                ? response.vars[0].name : undefined,
                            simdWidth: simdWidth.width, 
                            level: 0
                        });
                    });
                });
                await Promise.all(fetchedVars.promises);
            }
        }
    
        return rows.join("");
    }
    
    /* Generate rows for expanded elements. */
    private async makeVarListHtml(nextLevel: Variables, fetchedVars: { promises: Promise<void>[], reqVariablesList: reqVariablesList}, 
        level: number, simdWidth: number) {
        const rows: string[] = [];

        fetchedVars.promises.forEach((promise, index) => {
            /* Once a promise is resolved we can start with its row generation. */
            promise.then(() => {
                const response = fetchedVars.reqVariablesList.vars[index];

                rows[index] = this.makeRow({
                    uniqueId: response.uniqueId,
                    expression: nextLevel.vars[index].exp,
                    numchild: nextLevel.vars[index].numchild,
                    vars: response.vars,
                    rootVarName: nextLevel.vars[index].name,
                    simdWidth: simdWidth,
                    level: level
                });
            });
        });

        await Promise.all(fetchedVars.promises);

        return rows.join("");
    }

    private async _setWebviewMessageListener(webviewView: WebviewView) {
        webviewView.webview.onDidReceiveMessage(async(message: { command: string; data: Data }) => {
            const command = message.command;
            const request: Request = {
                uniqueId: "",
                expression: ""
            };

            switch (command) {
            case "addSimdWatch":
                {
                    await window.withProgress(
                        { location: { viewId: "intelOneAPI.watchPanel.simdWatchView" } },
                        async() => {
                            request.expression = message.data.expression;
                            request.uniqueId = message.data.uniqueId;
                            let savedReq = this.context.globalState.get<WatchRequests>("WatchRequests");
                            let isFisrt = false;

                            // Check if savedReq is undefined
                            if (!savedReq) {
                                savedReq = {
                                    requests: []
                                };
                                isFisrt = true;
                            }
                            savedReq.requests.push(request);
                            await this.context.globalState.update("WatchRequests", savedReq);
                            const session = await checkGbdOneapiSession();

                            if (!session || isFisrt) {
                                await commands.executeCommand("intelOneAPI.watchPanel.fetchSimdWatchPanel");
                                return;
                            }
                            const newWatchRequests: WatchRequests = {
                                requests: []
                            };

                            newWatchRequests.requests.push(request);
                            const htmlNewWatch = await this.addRows(newWatchRequests);

                            this._view.webview.postMessage({
                                command: "addSimdWatch",
                                payload: JSON.stringify({ 
                                    uniqueId: request.uniqueId, 
                                    htmlNewWatch: htmlNewWatch
                                })
                            });
                        }
                    );
                }
                break;
            case "removeSIMDWatch":
                {
                    await window.withProgress(
                        { location: { viewId: "intelOneAPI.watchPanel.simdWatchView" } },
                        async() => {
                            const savedReq = this.context.globalState.get<WatchRequests>("WatchRequests");

                            if (!savedReq) {
                                return;
                            }
                            request.uniqueId = message.data.uniqueId;
                            savedReq.requests = savedReq.requests.filter(oldRequest => oldRequest.uniqueId !== request.uniqueId);
                            await this.context.globalState.update("WatchRequests", savedReq);

                            this._view.webview.postMessage({
                                command: "removeSIMDWatch",
                                payload: JSON.stringify({ 
                                    uniqueId: request.uniqueId, 
                                })
                            });
                        }
                    );
                }

                break;
            case "expandVarObject":
                {
                    await window.withProgress(
                        { location: { viewId: "intelOneAPI.watchPanel.simdWatchView" } },
                        async() => {
                            const uniqueId = message.data.uniqueId;
                            const varName = message.data.varName;
                            const level: number = +message.data.level;
                            const session = await checkGbdOneapiSession();
        
                            if (!session || !this._provider) {
                                return;
                            }

                            const infoExp = await this._provider.getInfoExp(varName, session);

                            if (!infoExp) {
                                return;
                            }

                            const watchRequests: WatchRequests = {
                                requests: []
                            };
 
                            infoExp.promises.forEach((promise, index) => {
                                promise.then(() => {
                                    watchRequests.requests[index] = {
                                        uniqueId: (Date.now() + Math.floor(Math.random() * 1e6)).toString(),
                                        expression: infoExp.resultVariables.vars[index].pathExp || ""
                                    };
                                });
                            });
                            await Promise.all(infoExp.promises);

                            const nextlevelvarlist = this._provider.fetchVars(watchRequests, session);
                            const simdWidth = await this._provider.getSIMDWidth(session);
                            
                            const htmlChildren = await this.makeVarListHtml(infoExp.resultVariables, nextlevelvarlist,
                                level + 1, simdWidth.width || 32);
                            
                            this._view.webview.postMessage({
                                command: "expandVarObject",
                                payload: JSON.stringify({ 
                                    uniqueId: uniqueId, 
                                    htmlChildren: htmlChildren 
                                })
                            });
                        }
                    );
                }
                break;
            case "saveHTMLState":
                {
                    await window.withProgress(
                        { location: { viewId: "intelOneAPI.watchPanel.simdWatchView" } },
                        async() => {
                            const html = this.htmlStart + message.data.html + this.htmlEnd;

                            this._view.webview.html = html;
                        }
                    );
                }
                break;
            default:
                break;
            }
        });
    }

    // After setting "setContext", "oneapi:havedevice" to true, some time passes before initializing this._view,
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
