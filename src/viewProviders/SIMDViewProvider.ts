import {
    commands,
    CancellationToken,
    Uri,
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
    
    public setLoadingView(){
        if (this._view.webview.html){
            this._view.webview.html = this.htmlStart + "<h4 class = 'dot'>Waiting for data to show ...</h4>" + this.htmlEnd;
        } else {
            this._view.webview.html = this.htmlStart + "<h4 class = 'dot'>...</h4>" + this.htmlEnd;
        }
    }

    getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
        return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
    }

    public async setView(masks: Emask[], currentThread?: CurrentThread){
        this.chosenLaneId = undefined;
        await this.ensureViewExists();
        this.setLoadingView();
        this._masks = masks;
        this._view.webview.html = this.htmlStart + await this.getThreadsView(masks, currentThread) + this.htmlEnd;
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

    private async getThreadsView(masks: Emask[], currentThread?: CurrentThread){
        let upd = this.simdView;
        const currentLaneTable = "";

        for (const m of masks) {
            const binSimdRow = parseInt(m.executionMask, 16).toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");
            const newSimdRow = reverseBinSimdRow.padStart(m.length, "0");

            if (currentThread?.name === m.name) {
                this.chosenLaneId = `{"lane": ${currentThread.lane}, "name": "${m.name}", "threadId": ${m.threadId}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;
                await commands.executeCommand("setContext", "oneapi:haveselected", true);
                this.selectedLaneViewProvider.setView(currentThread, m.executionMask, m.hitLanesMask, m.length);
            }

            const tableString = this.getColorsRow(newSimdRow, m);
            const x = m.threadWorkgroup ? m.threadWorkgroup.split(",")[0] : "-";
            const y = m.threadWorkgroup ? m.threadWorkgroup.split(",")[1] : "-";
            const z = m.threadWorkgroup ? m.threadWorkgroup.split(",")[2] : "-";

            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td> <td title="${m.fullname}"> ${m.file}:${m.line} </td><td>${x},${y},${z}</td><td><table><tr>${tableString}</tr></table></td></tr>`;
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
        this.setLoadingView();
        this._view.webview.html = this.htmlStart + await this.getThreadsView(masks) + this.htmlEnd;
    }

    private async _setWebviewMessageListener(webviewView: WebviewView) {
        webviewView.webview.onDidReceiveMessage(async(message: { command: string; payload: string }) => {
            const command = message.command;

            switch (command) {
            case "change":
                {
                    this.viewState = this.viewState === ViewState.COLORS ? ViewState.NUMBERS : ViewState.COLORS;
                    this.updateView(this._masks);
                }
                break;

            case "changeLane":
                {
                    // TODO: update real thread lane
                    webviewView.webview.postMessage({
                        command: "changeLane",
                        payload: JSON.stringify({ id: message.payload, previousLane: this.chosenLaneId, viewType: this._activeLaneSymbol }),
                    });
                    this.chosenLaneId = message.payload;
                    const parsedMessage = JSON.parse(message.payload);
                    const currentThread = await getThread(parsedMessage.threadId, parsedMessage.lane);

                    if (!currentThread) {
                        await commands.executeCommand("setContext", "oneapi:haveselected", false);
                        return;
                    }
                    await commands.executeCommand("setContext", "oneapi:haveselected", true);
                    await this.selectedLaneViewProvider.setView(currentThread, parsedMessage.executionMask, parsedMessage.hitLanesMask, parsedMessage.length);
                }

                break;

            default:
                break;
            }
        });
    }
}
