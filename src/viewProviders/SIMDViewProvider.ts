/**
 * Copyright (c) 2022-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import {
    commands,
    CancellationToken,
    ExtensionContext,
    Uri,
    window,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { CurrentThread, Emask, getThread } from "../SimdProvider";
import { ThreadInfoViewProvider } from "./threadInfoViewProvider";
import { SelectedLaneViewProvider } from "./selectedLaneViewProvider";
import { getNonce } from "./utils";
import { Filter } from "../SimdProvider";
import { FilterHelpWebview } from "./filterHelpViewProvider";


enum ViewState {
    COLORS,
    NUMBERS
}

export class SIMDViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.simdview";
    public _view!: WebviewView;
    private waitingIntervalId: ReturnType<typeof setInterval> | undefined = undefined;
    private _masks!: Emask[];
    private _currentThread: CurrentThread | undefined;

    private htmlStart = "";
    private htmlEnd = "";
    private searchPanel = "";
    private filterPanel = "";
    private simdView = "";
    private viewState = ViewState.COLORS;

    private chosenLaneId?: string;

    private _activeLaneSymbol: string | undefined;
    private _inactiveLaneSymbol: string | undefined;

    public set activeLaneSymbol(symbol: string | undefined) {
        this._activeLaneSymbol = "";
        if (symbol !== undefined && symbol?.length === 1) {
            this._activeLaneSymbol = symbol;
        }
    }

    public set inactiveLaneSymbol(symbol: string | undefined) {
        this._inactiveLaneSymbol = "";
        if (symbol !== undefined && symbol?.length === 1) {
            this._inactiveLaneSymbol = symbol;
        }
    }

    constructor(
        private context: ExtensionContext,
        private threadInfoViewProvider: ThreadInfoViewProvider,
        private selectedLaneViewProvider: SelectedLaneViewProvider) { }

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
            enableScripts: true,

            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        await this._setWebviewMessageListener(webviewView);
        this.setInitialPageContent(webviewView.webview);
    }

    public async triggerSearch() {

        await window.withProgress(
            { location: { viewId: "intelOneAPI.debug.simdview" } },
            async() => {
                try {
                    this._view.webview.postMessage({
                        command: "triggerSearch",
                        payload: JSON.stringify("triggerSearch")
                    });
                } catch (error) {
                    this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                        // Handle errors in gdb requests: display error message in panel
                        if (error instanceof Error) {
                            this.threadInfoViewProvider.setErrorView(error.message);
                        } else {
                            this.threadInfoViewProvider.setErrorView(String(error));
                        }
                    });
                }
            }
        );

    }


    public async triggerFilter() {
        await window.withProgress(
            { location: { viewId: "intelOneAPI.debug.simdview" } },
            async() => {
                try {
                    this._view.webview.postMessage({
                        command: "triggerFilter",
                        payload: JSON.stringify("triggerFilter")
                    });
                } catch (error) {
                    this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                        // Handle errors in gdb requests: display error message in panel
                        if (error instanceof Error) {
                            this.threadInfoViewProvider.setErrorView(error.message);
                        } else {
                            this.threadInfoViewProvider.setErrorView(String(error));
                        }
                    });
                }
            }
        );
    }

    private setInitialPageContent(webview: Webview) {
        const scriptUri = webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "media", "main.js"));

        const styleVSCodeUri = webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "media", "main.css"));
        const codiconsUri = webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        const toolkitUri = this.getUri(webview, this.context.extensionUri, [
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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${styleVSCodeUri}" rel="stylesheet" />
            <link href="${styleMainUri}" rel="stylesheet" />
            <link href="${codiconsUri}" rel="stylesheet" />

            <script type="module" src="${toolkitUri}" nonce="${nonce}"></script>
            <title>SIMD Lanes</title>
        </head>
        <body>`;

        this.searchPanel = `
        <div class="search-panel">
            <div class="drag-handle codicon codicon-gripper"></div>
            <input type="text" id="searchInput" placeholder="Find" />
            <span id="searchCounter">No results</span>
            <button id="prevBtn" class="codicon codicon-arrow-up"></button>
            <button id="nextBtn" class="codicon codicon-arrow-down"></button>
            <button id="toggleHideBtn" class="codicon codicon-search-fuzzy"></button>
            <button id="closeBtn" class="codicon codicon-close"></button>
        </div>`;

        this.filterPanel = `
        <div class="filter-panel">
            <!-- First Row: Drag Handle, Thread and Lane Section, Help, Apply and Close Buttons -->
            <div class="control-row">
                <div class="drag-handle codicon codicon-gripper"></div>
                <label for="threadInput">Thread:</label>
                <div class="custom-dropdown" id="threadDropdownContainer">
                    <div class="dropdown-selected">
                        <button id="threadDropdownToggle" class="codicon codicon-chevron-down"></button>
                        <span id="threadSelectedValue">All</span>
                    </div>
                    <div class="dropdown-menu" id="threadDropdownMenu" style="display: none;">
                        <div class="dropdown-option" data-value="all">All</div>
                        <div class="dropdown-option" data-value="custom">Custom range...</div>
                    </div>
                    <input type="text" id="threadInput" class="dropdown-input" placeholder="Enter custom thread range" style="display: none;" />
                </div>
                <label for="laneInput">Lane:</label>
                <div class="custom-dropdown" id="laneDropdownContainer">
                    <div class="dropdown-selected">
                        <button id="laneDropdownToggle" class="codicon codicon-chevron-down"></button>
                        <span id="laneSelectedValue">Selected</span>
                    </div>
                    <div class="dropdown-menu" id="laneDropdownMenu" style="display: none;">
                        <div class="dropdown-option" data-value="--selected-lanes">Selected</div>
                        <div class="dropdown-option" data-value="--all-lanes">All Lanes</div>
                        <div class="dropdown-option" data-value="custom">Custom lane range...</div>
                    </div>
                    <input type="text" id="laneInput" class="dropdown-input" placeholder="Enter custom lane" style="display: none;" />
                </div>
                <button id="helpBtn" class="codicon codicon-question"></button>
                <button id="applyFilterBtn" class="codicon codicon-check"></button>
                <button id="clearBtn" class="codicon codicon-clear-all"></button>
                <button id="closeFilterBtn" class="codicon codicon-close"></button>
            </div>

            <!-- Second Row: WorkGroup Work-item Global ID and Work-item Local ID -->
            <div class="control-row" style="display: flex; gap: 10px; align-items: center;">
                <div style="flex: 1;">
                    <label for="workGroupInput">Work-group:</label>
                    <input type="text" id="workGroupInput" placeholder="E.g., 1-5,2-*" />
                    </div>
                <div style="flex: 1;">
                    <label for="globalWorkItemInput">Work-item Global ID:</label>
                <input type="text" id="globalWorkItemInput" placeholder="E.g., 1,2,3 or *" />
                </div>
                <div style="flex: 1;">
                    <label for="localWorkItemInput">Work-item Local ID:</label>
                <input type="text" id="localWorkItemInput" placeholder="E.g., 1,2,3 or *" />
                </div>
            </div>
    
            <!-- Third Row: Filter Input -->
            <div class="control-row">
                <label for="filterInput">Filter Expression:</label>
                <input type="text" id="filterInput" placeholder="Expression for selection" />
            </div>
        </div>`;

        this.htmlEnd = `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;

        this.simdView = `
        <table id='simd-view'><thead><tr><th class="thread-id">Target ID [Thread ID]</th><th>Location</th><th class="workgroup tooltip"><div class="overflow-wrapper">Work-group (x,y,z)</div><span class="tooltiptext">Work-group (x,y,z)</span></th>
        <th class="lanes">SIMD Lanes <span class="tooltip"><span class="info-icon"></span>
        <div class="tooltiptext">
                <table id="info-color">
                    <thead>
                        <tr>
                            <th>Color</th>
                            <th>Thread State</th>
                         </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class ='color-info'><div class="cell hitCell"></div></td>
                            <td>Active - have met breakpoint conditions</td>
                        </tr>
                        <tr>
                            <td class ='color-info'><div class="cell colored"></div></td>
                            <td>Active</td>
                        </tr>
                        <tr>
                            <td class ='color-info'><div class="cell"></div></td>
                            <td>Inactive</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </th>
        </tr>
        </thead>
        <tbody>
    `;

    }

    public async setLoadingView() {
        try {
            this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                this.threadInfoViewProvider.setLoadingView();
            });

            this._view.webview.html = this.htmlStart + "<h4></h4>" + this.htmlEnd;
            this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                this.selectedLaneViewProvider.setLoadingView();
            });

        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    public async setErrorView(errMsg: string) {
        try {
            this._view.webview.html = this.htmlStart + "Error occured while getting SIMD Lanes Info:" + errMsg + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
        return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
    }

    public async setView(masks: Emask[], currentThread?: CurrentThread) {
        this.chosenLaneId = undefined;
        this._masks = masks;
        try {
            this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                this.threadInfoViewProvider.setLoadingView();
            });
            // Synchronously updates the 'selectedLaneViewProvider' panel each time 'simdViewProvider.setView' is called
            this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                this.selectedLaneViewProvider.setLoadingView();
            });
            this._currentThread = currentThread;
            this._view.webview.html = this.htmlStart + await this.getThreadsView(masks, currentThread) + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    private async getThreadsView(masks: Emask[], currentThread?: CurrentThread) {
        let upd = this.filterPanel + this.searchPanel + this.simdView;
        const currentLaneTable = "";

        for (const m of masks) {
            const binSimdRow = parseInt(m.executionMask, 16).toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");
            const newSimdRow = reverseBinSimdRow.padStart(m.length, "0");

            if (currentThread?.threadId === m.threadId) {
                this.chosenLaneId = `{"lane": ${currentThread.lane}, "targetId": "${m.targetId}", "threadId": ${m.threadId}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;
                try {
                    await commands.executeCommand("setContext", "oneapi:haveSelected", true);
                    let metBPConditions: boolean | undefined = undefined;

                    if (m.hitLanesMask !== undefined) {
                        metBPConditions = m.hitLanesMask !== "undefined" ? true : false;
                    }

                    this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                        this.threadInfoViewProvider.setLoadingView();
                        this.threadInfoViewProvider.setView(currentThread, m.hitLanesMask, m.length, metBPConditions);
                    });


                    this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                        this.selectedLaneViewProvider.setLoadingView();
                        this.selectedLaneViewProvider.setView(currentThread, m.executionMask, metBPConditions);
                    });
                } catch (error) {
                    this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                        // Handle errors in gdb requests: display error message in panel
                        if (error instanceof Error) {
                            this.threadInfoViewProvider.setErrorView(error.message);
                        } else {
                            this.threadInfoViewProvider.setErrorView(String(error));
                        }
                    });
                }
            }

            const tableString = this.getColorsRow(newSimdRow, m);
            const x = m.threadWorkgroup ? m.threadWorkgroup.split(",")[0] : "-";
            const y = m.threadWorkgroup ? m.threadWorkgroup.split(",")[1] : "-";
            const z = m.threadWorkgroup ? m.threadWorkgroup.split(",")[2] : "-";
            let filename = "";

            if (m.file) {
                filename += `<td class="tooltip filename"><div class="overflow-wrapper">${m.file}</div> :${m.line}<span class="tooltiptext">${m.file}:${m.line}</span></td>`;
            } else {
                filename += "<td> - </td>";
            }

            upd = upd + `<tr><td class="thread-id">${m.targetId} [${m.threadId}]</td>${filename}<td class="workgroup">${x},${y},${z}</td><td class="lanes">${tableString}</td></tr>`;
        }
        upd = upd + "</tbody></table>" + currentLaneTable;
        return upd;
    }

    private getColorsRow(newSimdRow: string, m: Emask) {
        if (newSimdRow === "NaN") {
            return "<td></td>";
        }

        const tableString = newSimdRow.split("").map((value: string, index) => {
            const id = `{"lane": ${index}, "targetId": "${m.targetId}", "threadId": ${m.threadId}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;

            if (+value === 0) {
                return `<div id='${id}' class ='cell'>${this._inactiveLaneSymbol}</div>`;
            }
            let cellStyle = "colored";

            if (m.hitLanesMask) {
                const hitLanesMaskBinary = parseInt(m.hitLanesMask, 16).toString(2).split("").reverse().join("");
                const hitNum = hitLanesMaskBinary.charAt(index);

                cellStyle = hitNum === "1" ? "hitCell" : "colored";
            }

            let coloredCell = `<div id='${id}' class ='cell ${cellStyle} one'>${this._activeLaneSymbol}</div>`;

            if (this.chosenLaneId && this.chosenLaneId === id) {
                coloredCell = `<div id='${id}' class ='cell ${cellStyle} one current'></div>`;
            }
            return coloredCell;
        });

        let groupedCells = "<div class='cell-container'>";

        for (let i = 0; i < tableString.length; i += 8) {
            const group = tableString.slice(i, i + 8).join("");

            groupedCells += `<div class='cell-group'>${group}</div>`;
        }
        groupedCells += "</div>";

        return groupedCells;
    }

    public async updateView(masks: Emask[]) {
        this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
            this.selectedLaneViewProvider.setLoadingView();
        });
        this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
            this.threadInfoViewProvider.setLoadingView();
        });
        this._view.webview.html = this.htmlStart + this.searchPanel + await this.getThreadsView(masks) + this.htmlEnd;
    }

    private async _setWebviewMessageListener(webviewView: WebviewView) {
        webviewView.webview.onDidReceiveMessage(async(message: { command: string; payload: string }) => {
            const command = message.command;

            switch (command) {
            case "change":
                {
                    this.waitForViewToBecomeVisible(() => {
                        this.setLoadingView();
                    });
                    await this.setLoadingView();
                    try {
                        await window.withProgress(
                            { location: { viewId: "intelOneAPI.debug.simdview" } },
                            () => this.updateView(this._masks)
                        );
                    } catch (error) {
                        this.waitForViewToBecomeVisible(() => {
                            // Handle errors in gdb requests: display error message in panel
                            if (error instanceof Error) {
                                this.setErrorView(error.message);
                            } else {
                                this.setErrorView(String(error));
                            }
                        });
                    }
                }
                break;

            case "changeLane":
                {
                    await commands.executeCommand("setContext", "oneapi:haveSelected", true);
                    this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                        this.selectedLaneViewProvider.setLoadingView();
                    });
                    this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                        this.threadInfoViewProvider.setLoadingView();
                    });
                    await window.withProgress(
                        { location: { viewId: ThreadInfoViewProvider.viewType } },
                        async() => {
                            try {
                                webviewView.webview.postMessage({
                                    command: "changeLane",
                                    payload: JSON.stringify({ id: message.payload, previousLane: this.chosenLaneId, viewType: this._activeLaneSymbol }),
                                });
                                this.chosenLaneId = message.payload;
                                const parsedMessage = JSON.parse(message.payload);
                                const currentThread = await getThread(parseInt(parsedMessage.threadId, 10), parseInt(parsedMessage.lane, 10));

                                if (!currentThread) {
                                    await commands.executeCommand("setContext", "oneapi:haveSelected", false);
                                    return;
                                }

                                let metBPConditions: boolean | undefined = undefined;

                                if (parsedMessage.hitLanesMask !== undefined) {

                                    metBPConditions = parsedMessage.hitLanesMask !== "undefined" ? true : false;
                                }

                                this.threadInfoViewProvider.waitForViewToBecomeVisible(() => {
                                    this.threadInfoViewProvider.setView(currentThread, parsedMessage.hitLanesMask, parsedMessage.length, metBPConditions);
                                });
                                this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                                    this.selectedLaneViewProvider.setView(currentThread, parsedMessage.executionMask, metBPConditions);
                                });

                                if (!this._currentThread || this._currentThread.threadId !== currentThread.threadId) {
                                    this._currentThread = currentThread;
                                    commands.executeCommand("intelOneAPI.watchPanel.fetchSimdWatchPanel");
                                }
                            } catch (error) {
                                this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                                    // Handle errors in gdb requests: display error message in panel
                                    if (error instanceof Error) {
                                        this.selectedLaneViewProvider.setErrorView(error.message);
                                    } else {
                                        this.selectedLaneViewProvider.setErrorView(String(error));
                                    }
                                }
                                );
                            }
                        }
                    );
                }
                break;
            case "applyFilter":
                {
                    const parsedMessage = JSON.parse(message.payload);

                    const filter: Filter = {
                        filter: parsedMessage.filter,
                        threadValue: parsedMessage.threadValue,
                        laneValue: parsedMessage.laneValue,
                        localWorkItemValue: parsedMessage.localWorkItemValue,
                        globalWorkItemValue: parsedMessage.globalWorkItemValue,
                        workGroupValue: parsedMessage.workGroupValue
                    };

                    await this.context.globalState.update("ThreadFilter", filter);
                    await commands.executeCommand("intelOneAPI.debug.fetchSIMDInfo");
                }
                break;
            case "openFilterHelp": {
                FilterHelpWebview.show(this.context);
            }
                break;
                    
                    
            default:
                break;
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible === true) {
                commands.executeCommand("intelOneAPI.debug.fetchSIMDInfo");
            } else {
                commands.executeCommand("setContext", "oneapi:haveSelected", false);
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible === true) {
                commands.executeCommand("intelOneAPI.debug.fetchSIMDInfo");
            } else {
                commands.executeCommand("setContext", "oneapi:haveSelected", false);
            }
        });
    }
}
