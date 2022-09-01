import {
    CancellationToken,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { emask } from "../SimdProvider";

enum ViewState{
    COLORS,
    NUMBERS
}

export class SIMDViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.simdview";
    public _view!: WebviewView;
    private _masks!: emask[];

    private htmlStart = "";
    private htmlEnd = "";
    private viewState = ViewState.COLORS;

    constructor(private readonly _extensionUri: Uri) {}

    getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
        return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set the HTML content that will fill the webview view
        this.setInitialPageContent(webviewView.webview, this._extensionUri);

        this._setWebviewMessageListener(webviewView);
    }

    private setInitialPageContent(webview: Webview, extensionUri: Uri){
        const toolkitUri = this.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const stylesUri = this.getUri(webview, extensionUri, ["src", "webview-ui", "styles.css"]);
        const mainUri = this.getUri(webview, extensionUri, ["src", "webview-ui", "main.js"]);

        this.htmlStart = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="${toolkitUri}"></script>
          <script type="module" src="${mainUri}"></script>
          <link rel="stylesheet" href="${stylesUri}">
          <title>SIMD Lanes</title>
        </head>
        <body>`;

        this.htmlEnd = "</body></html>";
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

    public setView(masks: emask[]){
        const upd = this.getColorsView(masks);

        this._masks = masks;
        this._view.webview.html = this.htmlStart + upd + "<vscode-button id='change-view-button'>Change view</vscode-button>" + this.htmlEnd;
    }

    private getColorsView(masks: emask[]){
        let upd = "<table id='simd-view'><tbody><tr><td>ThreadID</td><td>Name</td><td>SIMD Lanes</td></tr>";

        const reg0 = /0/gm;
        const reg1 = /1/gm;

        for (const m of masks) {
            const newSimdRow = m.value.toString(2).padStart(m.length, "0").replace(reg0,"<td class ='zero'></td>").replace(reg1,"<td class ='one'></td>");

            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td><table><tr>${newSimdRow}</tr></table></td></tr>`;
        }
        upd = upd + "</tbody></table>";

        return upd;
    }

    private getNumbersView(masks: emask[]){
        let upd = "<table id='simd-view'><tbody><tr><td>ThreadID</td><td>Name</td><td>SIMD Lanes</td></tr>";

        for (const m of masks) {
            upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td><code>${m.value.toString(2).padStart(m.length, "0")}</code></td></tr>`;
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
