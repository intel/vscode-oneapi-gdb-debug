import {
    CancellationToken,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { Emask } from "../SimdProvider";

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

    constructor(private readonly _extensionUri: Uri) {}

    public resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ]
        };

        this._setWebviewMessageListener(webviewView);
        this.setInitialPageContent(webviewView.webview, this._extensionUri);
    }

    private setInitialPageContent(webview: Webview, extensionUri: Uri){
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

        this.htmlEnd = `
            <button id='change-view-button'>Change view</button>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public cleanView(){
        this._view.webview.html = "";
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

    public setView(masks: Emask[]){
        const upd = this.getColorsView(masks);

        this._masks = masks;
        this._view.webview.html = this.htmlStart + upd + this.htmlEnd;
    }

    private getColorsView(masks: Emask[]){
        let upd = "<table id='simd-view'><tbody><tr><td>ThreadID</td><td>Name</td><td>SIMD Lanes</td></tr>";

        for (const m of masks) {
            const binSimdRow = m.value.toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");
            const newSimdRow = reverseBinSimdRow.padStart(m.length, "0");
            const tableString = newSimdRow.split("").map((value: any, index)=> {
                const id = `${index}+${m.name}`;
                const coloredCell = `<td id='${id}' class ='cell one'></td>`;

                return value === "0" ? `<td id='${id}' class ='cell zero'></td>`: coloredCell;
            });

            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td><table><tr>${tableString.join("")}</tr></table></td></tr>`;
        }
        upd = upd + "</tbody></table>";

        return upd;
    }

    private getNumbersView(masks: Emask[]){
        let upd = "<table id='simd-view'><tbody><tr><td>ThreadID</td><td>Name</td><td>SIMD Lanes</td></tr>";

        for (const m of masks) {
            const binSimdRow = m.value.toString(2);
            const reverseBinSimdRow = binSimdRow.padStart(m.length, "0").split("").reverse().join("");

            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td><code>${reverseBinSimdRow}</code></td></tr>`;
        }
        upd = upd + "</tbody></table>";
        return upd;
    }

    private _setWebviewMessageListener(webviewView: WebviewView) {
        webviewView.webview.onDidReceiveMessage((message) => {
            const command = message.command;

            switch (command) {
            case "change":
                {
                    const upd = this.viewState === ViewState.COLORS ? this.getNumbersView(this._masks) : this.getColorsView(this._masks);

                    this.viewState = this.viewState === ViewState.COLORS ? ViewState.NUMBERS : ViewState.COLORS;
                    webviewView.webview.postMessage({
                        command: "change",
                        payload: JSON.stringify({ newLanes: upd }),
                    });
                }

                break;
            }
        });
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
