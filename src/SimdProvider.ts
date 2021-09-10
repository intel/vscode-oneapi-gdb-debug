/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';


export class SimdProvider {

    private view: SimdViewProvider;

    constructor(
        private context: vscode.ExtensionContext
    ) {

        //Setup Webview
        this.view = new SimdViewProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider("intelOneAPI.debug.simdview", this.view));

        context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('cppdbg', new SimdDebugAdapterProviderFactory(this)));

        context.subscriptions.push(vscode.commands.registerCommand('intelOneAPI.debug.fetchSIMDInfo', async () => {
            this.fetchEMaskForAll();
            return;

        }));

        //We need to test if multi debug sessions get effected by this, we might need to initialize multiple instances of this object :/
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            console.log("Debug Session " + session.id + " terminated");
            this.view.updateWith("");
        }));

        context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(e => {
            console.log(e);
        }));
    }

    public updateWithSimdData(s: SimdStatusData): void {

        let others = "";
        s.otherLanes.forEach(i => {
            others = others.concat(i + "<br>");
        });
        this.view.updateWith("<h3>Active: " + s.activeLane + "</h3><br>" + others);
    }

    private matchIeMasktoSIMD(i: string): number {
        switch(i.toLowerCase()) {
            case "0xff": {
                return 8;
            }
            case "0xffff": {
                return 16;
            }
            case "0xffffffff": {
                return 32;
            }
        }
        //Did not match against known types
        return 0;

    }

    public async fetchEMaskForAll(): Promise<void> {
        const session = vscode.debug.activeDebugSession;
        if (session) {
            const r = await session.customRequest("threads");
            
            const threads = r.threads as DebugProtocol.Thread[];

            const masks: emask[] = []; //optimise?

            for (const t of threads) {
                
                const strarg: DebugProtocol.StackTraceArguments = { threadId: t.id };
                const sTrace = await session.customRequest('stackTrace', strarg);
                let evalargs: DebugProtocol.EvaluateArguments = { expression: "$emask", context: "repl", frameId: sTrace.stackFrames[0].id, format: {hex: true}};
                let evalresult = await session.customRequest('evaluate', evalargs);
                if (evalresult.result === 'void' ) {
                    continue; //Filter Threads without EMASK
                }
                this.view.updateWith("waiting for data");
                const maskvar = parseInt(evalresult.result, 16);

                evalargs = { expression: "$iemask", context: "repl", frameId: sTrace.stackFrames[0].id,format: {hex: true} };
                evalresult = await session.customRequest('evaluate', evalargs);
                let maskLength = 0;
                if (evalresult.result !== 'void' ) {
                    maskLength = this.matchIeMasktoSIMD(evalresult.result as string);
                }

                evalargs = { expression: "$_thread", context: "repl", frameId: sTrace.stackFrames[0].id};
                evalresult = await session.customRequest('evaluate', evalargs);
                let tid = 0;
                if (evalresult.result !== 'void' ) {
                    tid = parseInt(evalresult.result);
                }
                
                masks.push({name: t.name, threadId: tid, value: maskvar, length: maskLength});
                
            }
            if (!masks.length) {
                return; //exit, no simd detected
            }
            let upd = "<table><tbody><tr><td>ThreadID</td><td>Name</td><td>SIMD Lanes</td></tr>";
            for (const m of masks) {
                upd = upd + `<tr><td>${m.threadId}</td><td>${m.name}</td><td><code>${m.value.toString(2).padStart(m.length, "0")}</code></td></tr>`;
            }
            upd = upd + "</tbody></table>";

            this.view.updateWith(upd);

        }
    }
}


interface emask {
    name: string;
    threadId: number;
    value: number;
    length: number;
}

class SimdDebugAdapterProviderFactory implements vscode.DebugAdapterTrackerFactory {

    constructor(
        private readonly simdtracker: SimdProvider,
    ) { }

    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        console.log("starting session" + session.id + session.type);
        return new SimdDebugAdapterProvider(this.simdtracker);
    }

}

class SimdDebugAdapterProvider implements vscode.DebugAdapterTracker {


    constructor(
        private readonly simdtracker: SimdProvider,
    ) {


    }


    public onDidSendMessage(m: DebugProtocol.ProtocolMessage) {

        this.routeDebugMessage(m);
    }

    private routeDebugMessage(m: DebugProtocol.ProtocolMessage): void {
        if (m.type === "event") {
            const e = m as DebugProtocol.Event;
            switch (e.event) {
                case "stopped": {
                    const stopped = e as DebugProtocol.StoppedEvent;
                    this.simdtracker.fetchEMaskForAll();
                }

            }

        }
        return;
    }

}

class SimdStatusData {
    constructor(
        public readonly activeLane: string,
        public readonly otherLanes: string[],
    ) { }
}

class SimdViewProvider implements vscode.WebviewViewProvider {


    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public updateWith(data: string) {

        if (this._view) {
            this._view.webview.html = data;
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        // context: vscode.WebviewViewResolveContext,
        // _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,


            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = "";

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'colorSelected':
                    {
                        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
                        break;
                    }
            }
        });
    }
}

