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

    public setView(sortedDevices: SortedDevices){
        let upd = "";

        for (const [threadGroups, devices] of Object.entries(sortedDevices)) {
            upd += threadGroups;
            for (const device of devices){
                const table = `<table>
                    <tr><td>Number</td>
                    <td>${device.number}</td></tr>
                    <tr><td>Name</td>
                    <td>${device.device_name}</td></tr>
                    <tr><td>Location</td>
                    <td>${device.location}</td></tr>
                    <tr><td>Sub device</td>
                    <td>${device.sub_device}</td></tr>
                    <tr><td>Vendor ID</td>
                    <td>${device.vendor_id}</td></tr>
                    <tr><td>Target ID</td>
                    <td>${device.target_id}</td></tr>
                </table>`;

                upd += "&emsp;" + table +"<br>";
            }
        }
        this._view.webview.html = this.htmlStart + upd + this.htmlEnd;
    }
}
