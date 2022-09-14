import {
    CancellationToken,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";
import { SortedDevices } from "../SimdProvider";

export class DeviceViewProvider implements WebviewViewProvider {
    public static readonly viewType = "intelOneAPI.debug.deviceView";
    public _view!: WebviewView;

    private htmlStart = "";
    private htmlEnd = "";

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
          <title>Hardware Info</title>
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

    

    public setErrorView(){
        this._view.webview.html = this.htmlStart + "Error occured while getting devices info" + this.htmlEnd;
    }

    public setView(devices: SortedDevices){
        let upd = "";

        for (const [threadGroups, deviceNames] of Object.entries(devices)) {
            upd += threadGroups + "<br>";
            for (const name of deviceNames){
                upd += "&emsp;" + name +"<br>";
            }
        }
        this._view.webview.html = this.htmlStart + upd + this.htmlEnd;
    }
}
