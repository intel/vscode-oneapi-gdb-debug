import {
    commands,
    CancellationToken,
    Uri,
    window,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { CurrentThread, Emask, getThread } from "../SimdProvider";
import { SelectedLaneViewProvider } from "./selectedLaneViewProvider";
import { getNonce } from "./utils";

enum ViewState {
        COLORS,
        NUMBERS
}

export class SIMDViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.simdview";
    public _view!: WebviewView;
    private waitingIntervalId: ReturnType<typeof setInterval> | undefined = undefined;
    private _masks!: Emask[];

    private htmlStart = "";
    private htmlEnd = "";
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

    constructor(private readonly _extensionUri: Uri,
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, _token: CancellationToken) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ]
        };

        await this._setWebviewMessageListener(webviewView);
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
            <title>SIMD Lanes</title>
        </head>
        <body>`;

        this.htmlEnd = `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;

        this.simdView = `
        <table id='simd-view'><tbody><tr><th>ThreadID</th><th>TargetID</th> <th>Location</th><th>Work-group<br>(x,y,z)</th>
        <th class="tooltip">SIMD Lanes 🛈
            <div class="tooltiptext">
                <table>
                    <tr>
                        <th>SIMD lane color</th>
                        <th>Thread State</th>
                    </tr>
                    <tr>
                        <td class ='hittedlane'>■</td>
                        <td>Active - have met breakpoint conditions</td>
                    </tr>
                    <tr>
                    <td class =' activelane'>■</td>
                    <td>Active</td>
                    </tr>
                    <tr>
                        <td class ='inactivelane'>■</td>
                        <td>Inactive</td>
                    </tr>
                </table>
            </div>
        </th>
        </tr>
    `;

    }
    
    public async setLoadingView() {
        try {
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

    public async setView(masks: Emask[], currentThread?: CurrentThread){
        this.chosenLaneId = undefined;
        this._masks = masks;
        try {
            // Synchronously updates the 'selectedLaneViewProvider' panel each time 'simdViewProvider.setView' is called
            this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                this.selectedLaneViewProvider.setLoadingView();
            });
            this._view.webview.html = this.htmlStart + await this.getThreadsView(masks, currentThread) + this.htmlEnd;
        } catch (error) {
            console.error("An error occurred while setting the view:", error);
        }
    }

    private async getThreadsView(masks: Emask[], currentThread?: CurrentThread){
        let upd = this.simdView;
        const currentLaneTable = "";

        for (const m of masks) {
            const binSimdRow = parseInt(m.executionMask, 16).toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");
            const newSimdRow = reverseBinSimdRow.padStart(m.length, "0");

            if (currentThread?.name === m.name) {
                this.chosenLaneId = `{"lane": ${currentThread.lane}, "name": "${m.name}", "threadId": ${m.threadId}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;
                try {
                    await commands.executeCommand("setContext", "oneapi:haveSelected", true);
                    this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                        this.selectedLaneViewProvider.setLoadingView();
                        this.selectedLaneViewProvider.setView(currentThread, m.executionMask, m.hitLanesMask, m.length);
                    });
                } catch (error) {
                    this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                        // Handle errors in gdb requests: display error message in panel
                        if (error instanceof Error) {
                            this.selectedLaneViewProvider.setErrorView(error.message);
                        } else {
                            this.selectedLaneViewProvider.setErrorView(String(error));
                        }
                    });
                }
            }

            const tableString = this.getColorsRow(newSimdRow, m);
            const x = m.threadWorkgroup ? m.threadWorkgroup.split(",")[0] : "-";
            const y = m.threadWorkgroup ? m.threadWorkgroup.split(",")[1] : "-";
            const z = m.threadWorkgroup ? m.threadWorkgroup.split(",")[2] : "-";
            let filename = "";

            if (m.file.length > 13) {
                // Create a shortened filename
                const shortenedValue = m.file.substring(0, 10);

                filename += `<td class="simdtooltip">${shortenedValue}... :${m.line}<span class="simdtooltiptext">${m.file}:${m.line}</span></td>`;
            } else {
                filename += `<td>${m.file}:${m.line}</td>`;
            }

            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td>${filename}<td>${x},${y},${z}</td><td><table><tr>${tableString}</tr></table></td></tr>`;
        }
        upd = upd + "</tbody></table>" + currentLaneTable;
        return upd;
    }

    private getColorsRow(newSimdRow: string, m: Emask) {
        if (newSimdRow === "NaN") {
            return "<td></td>";
        }

        const tableString = newSimdRow.split("").map((value: string, index) => {
            const id = `{"lane": ${index}, "name": "${m.name}", "threadId": ${m.threadId}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;
        
            if (+value === 0) {
                return `<td id='${id}' class ='cell'>${this._inactiveLaneSymbol}</td>`;
            }
            let cellStyle = "colored";

            if (m.hitLanesMask) {
                const hitLanesMaskBinary = parseInt(m.hitLanesMask, 16).toString(2).split("").reverse().join("");
                const hitNum = hitLanesMaskBinary.charAt(index);

                cellStyle = hitNum === "1" ? "hitCell" : "colored";
            }

            let coloredCell = `<td id='${id}' class ='cell ${cellStyle} one'>${this._activeLaneSymbol}</td>`;

            if (this.chosenLaneId && this.chosenLaneId === id) {
                coloredCell = `<td id='${id}' class ='cell ${cellStyle} one current'><span style="display:block; font-size:13px; text-align:center; margin:0 auto; width: 14px; height: 14px; color:#ffff00">⇨</span></td>`;
            }
            return coloredCell;
        }).join("");

        return tableString;
    }

    public async updateView(masks: Emask[]){
        this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
            this.selectedLaneViewProvider.setLoadingView();
        });
        this._view.webview.html = this.htmlStart + await this.getThreadsView(masks) + this.htmlEnd;
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
                    await window.withProgress(
                        { location: { viewId: "intelOneAPI.debug.selectedLane" } },
                        async() => {
                            try {
                                webviewView.webview.postMessage({
                                    command: "changeLane",
                                    payload: JSON.stringify({ id: message.payload, previousLane: this.chosenLaneId, viewType: this._activeLaneSymbol }),
                                });
                                this.chosenLaneId = message.payload;
                                const parsedMessage = JSON.parse(message.payload);
                                const currentThread = await getThread(parsedMessage.threadId, parsedMessage.lane);

                                if (!currentThread) {
                                    await commands.executeCommand("setContext", "oneapi:haveSelected", false);
                                    return;
                                }

                                this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                                    this.selectedLaneViewProvider.setView(currentThread, parsedMessage.executionMask, parsedMessage.hitLanesMask, parsedMessage.length);
                                });
                            } catch (error) {
                                this.selectedLaneViewProvider.waitForViewToBecomeVisible(() => {
                                    // Handle errors in gdb requests: display error message in panel
                                    if (error instanceof Error) {
                                        this.selectedLaneViewProvider.setErrorView(error.message);
                                    } else {
                                        this.selectedLaneViewProvider.setErrorView(String(error));
                                    }
                                });
                            }
                        }
                    );
                }
                break;

            default:
                break;
            }
        });
    }
}
