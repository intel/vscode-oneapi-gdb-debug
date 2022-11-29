import {
    CancellationToken,
    debug,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { CurrentThread, Emask } from "../SimdProvider";
import { SelectedLaneViewProvider } from "./selectedLaneViewProvider";
import { getNonce } from "./utils";

enum ViewState{
    COLORS,
    NUMBERS
}

export class SIMDViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.simdview";
    public _view!: WebviewView;
    private _masks!: Emask[];

    private htmlStart = "";
    private htmlEnd = "";
    private viewState = ViewState.COLORS;

    private chosenLaneId?: string;

    constructor(private readonly _extensionUri: Uri,
        private selectedLaneViewProvider: SelectedLaneViewProvider) {}

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

    private setInitialPageContent(webview: Webview){
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
    }

    public cleanView(){
        this._view.webview.html = "";
        this.selectedLaneViewProvider.cleanView();
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

    public setView(masks: Emask[], currentThread?: CurrentThread){
        this.chosenLaneId = undefined;
        this.setLoadingView();
        this._masks = masks;
        this._view.webview.html = this.htmlStart + this.getThreadsView(masks, currentThread) + this.htmlEnd;
    }

    private getThreadsView(masks: Emask[], currentThread?: CurrentThread){
        let upd = "<table id='simd-view'><tbody><tr><th>ThreadID</th><th>TargetID</th><th>Location</th><th>SIMD Lanes</th></tr>";
        let i = 1;
        const currentLaneTable = "";

        for (const m of masks) {
            const binSimdRow = parseInt(m.executionMask,16).toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");
            const newSimdRow = reverseBinSimdRow.padStart(m.length, "0");

            if(currentThread?.name === m.name){
                this.chosenLaneId = `{"lane": ${currentThread.lane}, "threadId": ${i}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`;
              
                this.selectedLaneViewProvider.setView(currentThread.lane, m.executionMask, m.hitLanesMask, m.length);
            }

            const tableString = this.getColorsRow(newSimdRow, i, m);
            
            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td title="${m.func}">${m.func.substring(0,20)}...</td><td><table><tr>${tableString}</tr></table></td></tr>`;
            i++;
        }
        upd = upd + "</tbody></table>" + currentLaneTable;
        return upd;  
    }

    private getColorsRow(newSimdRow: string, i: number, m: Emask){
        const tableString = newSimdRow.split("").map((value: string, index)=> {
            const id = `{"lane": ${index}, "threadId": ${i}, "executionMask": "${m.executionMask}", "hitLanesMask": "${m.hitLanesMask}", "length": ${m.length}}`; //`{"lane": ${currentThread.lane}, "threadId": ${i}, "value": ${m.value}, "length": ${m.length}}`;
            let coloredCell = `<td id='${id}' class ='cell colored one'>1</td>`;

            if(this.chosenLaneId && this.chosenLaneId === id){
                coloredCell = `<td id='${id}' class ='cell colored one'><span style="display:block; font-size:13px; text-align:center; margin:0 auto; width: 14px; height: 14px; color:#ffff00">➡</span></td>`;
            }

            return +value === 0 ? `<td id='${id}' class ='cell'>0</td>`: coloredCell;
        }).join("");

        return tableString;
    }

    public updateView(masks: Emask[]){
        this.setLoadingView();
        this._view.webview.html = this.htmlStart + this.getThreadsView(masks) + this.htmlEnd;
    }

    private async _setWebviewMessageListener(webviewView: WebviewView) {
        webviewView.webview.onDidReceiveMessage(async(message : {command: string; payload: string}) => {
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
                        payload: JSON.stringify({ id: message.payload, previousLane: this.chosenLaneId, viewType: this.viewState }),
                    });
                    this.chosenLaneId = message.payload;
                    const parcedLane = JSON.parse(message.payload);

                    this.selectedLaneViewProvider.setView(parcedLane.lane, parcedLane.executionMask, parcedLane.hitLanesMask, parcedLane.length);
                    
                    const session = debug.activeDebugSession;
                    const evalresult = await session?.customRequest("evaluate", { expression: `-exec thread ${parcedLane.threadId}:${parcedLane.lane}`, context: "repl" });

                    if (evalresult?.result === "void") {
                        return;
                    }
                }
                break;
            }
        });
    }
}
