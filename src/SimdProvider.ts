/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

"use strict";
import * as vscode from "vscode";
import { parse } from "path";
import { DebugProtocol } from "@vscode/debugprotocol";
import { DeviceViewProvider } from "./viewProviders/deviceViewProvider";
import { SIMDViewProvider } from "./viewProviders/SIMDViewProvider";

interface ThreadInfo {
    index: number;
    threadId: number;
    name: string;
}

export interface CurrentThread {
    name: string;
    lane: unknown;
    workitemGlobalid: string;
    workitemLocalid: string;

}

export async function getThread(thread?: string, laneNum?: string): Promise<CurrentThread | undefined> {
    const session = vscode.debug.activeDebugSession;

    if (session) {
        await session.customRequest("threads");
        let evalresult;

        if (thread === undefined || laneNum === undefined) {
            evalresult = await session.customRequest("evaluate", { expression: "-exec thread", context: "repl" });
        } else {

            // Using thread-select is caused by the need to switch the debugging context to update the values of local variables and other things in the VSCode window.
            evalresult = await session.customRequest("evaluate", { expression: `-exec -thread-select --thread ${thread} --lane ${laneNum} ${thread}`, context: "repl" });
            session.customRequest("sendInvalidate", {});
        }

        if (!evalresult || evalresult.result === "void") {
            return undefined;
        }

        const threadInfo = evalresult.result.split("\n")[0].replace(/[({})]/g, "").split(" ");

        evalresult = await session.customRequest("evaluate", { expression: "-exec -data-evaluate-expression $_workitem_global_id", context: "repl" });
        const workitemGlobalid = evalresult.result.replace(/[({< >})]/g, "").split("value:")[1].replace(/x:|y:|z:/g, "");

        evalresult = await session.customRequest("evaluate", { expression: "-exec -data-evaluate-expression $_workitem_local_id", context: "repl" });
        const workitemLocalid = evalresult.result.replace(/[({< >})]/g, "").split("value:")[1].replace(/x:|y:|z:|/g, "");

        const name = threadInfo.length < 7 ? `${threadInfo[2]} ${threadInfo[3]}` : `${threadInfo[4]} ${threadInfo[5]}`;
        const lane = threadInfo.length < 7 ? laneNum : +threadInfo[7].replace(/[^0-9]/g, "");

        return {
            name: name,
            lane: lane,
            workitemGlobalid,
            workitemLocalid
        };
    }
    return undefined;
}

export class SimdProvider {

    private threadsInfoArray: ThreadInfo[] = [];
    private _showInactiveThreads: boolean | undefined;


    public set showInactiveThreads(flag: boolean | undefined) {
        this._showInactiveThreads = false;
        if (flag !== undefined) {
            this._showInactiveThreads = flag;
        }
    }

    constructor(
        private context: vscode.ExtensionContext,
        private simdViewProvider: SIMDViewProvider,
        private deviceViewProvider: DeviceViewProvider
    ) {

        context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory("cppdbg", new SimdDebugAdapterProviderFactory(this)));

        context.subscriptions.push(vscode.commands.registerCommand("intelOneAPI.debug.fetchSIMDInfo", async() => {
            this.fetchEMaskForAll();
            this.fetcDevicesForAll();
            return;
        }));

        //We need to test if multi debug sessions get affected by this, we might need to initialize multiple instances of this object :/
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            console.log("Debug Session " + session.id + " terminated");
            vscode.commands.executeCommand("setContext", "oneapi:haveSIMD", false);
            vscode.commands.executeCommand("setContext", "oneapi:havedevice", false);
            vscode.commands.executeCommand("setContext", "oneapi:haveselected", false);

        }));

        context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(e => {
            this.simdBreakpointsHandler(e);
        }));

    }

    set threadsInfo(value: ThreadInfo[]) {
        this.threadsInfoArray = value;
    }

    get threadsInfo(): ThreadInfo[] {
        return this.threadsInfoArray;
    }

    public async fetchEMaskForAll(): Promise<void> {
        const session = vscode.debug.activeDebugSession;

        if (session) {
            await session.customRequest("threads");
            const evalresult = await session.customRequest("evaluate", { expression: "-exec -thread-info", context: "repl" });

            if (evalresult.result === "void") {
                return;
            }
            const masks: Emask[] = [];

            if (!/arch=intelgt/.test(evalresult.result)) {
                await vscode.commands.executeCommand("setContext", "oneapi:haveSIMD", false);
                return;
            }
            const allThreads: string = evalresult.result.match(/\{id=\d+.*\}/g);
            const threadsById = allThreads.toString().split("{id=");
            const threadsArray = [];

            if (!threadsById) {
                return;
            }

            if (this._showInactiveThreads) {
                const threadsToAdd = allThreads.toString().split("{id=").filter(thread => thread.trim() !== "");

                threadsArray.push(...threadsToAdd);
            }
            else {
                for (const match of threadsById) {
                    if (!/arch=intelgt/.test(match)) {
                        continue;
                    }
                    threadsArray.push(match);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            threadsArray.forEach((t: string) => {
                const threadProperties = t.split(",");
                const propertiesObject = Object.fromEntries(threadProperties.map((property: string) => {
                    const split = property.split("=");

                    return [split[0], split[1]];
                }));
                const threadWorkgroupIndex = threadProperties.findIndex((property) => property.includes("thread-workgroup"));
                const threadWorkgroup = threadProperties.slice(threadWorkgroupIndex, threadWorkgroupIndex + 3).join(",").split("=")[1];
                const parsedThreadWorkgroup = threadWorkgroup;


                masks.push({
                    fullname: propertiesObject.fullname,
                    file: propertiesObject.file,
                    line: propertiesObject.line,
                    name: this.threadsInfoArray[masks.length]?.name || propertiesObject["target-id"],
                    threadId: parseInt(threadProperties[0], 10),
                    executionMask: propertiesObject["execution-mask"],
                    hitLanesMask: propertiesObject["hit-lanes-mask"],
                    length: parseInt(propertiesObject["simd-width"], 10),
                    threadWorkgroup: parsedThreadWorkgroup,
                });
            });
            if (!masks.length) {
                return;
            }
            const currentThread = await getThread();

            await vscode.commands.executeCommand("setContext", "oneapi:haveSIMD", true);
            await this.simdViewProvider.setView(masks, currentThread);
            this.findAndAddSimdBreakPoints();
        }
    }

    public async fetcDevicesForAll(): Promise<void> {
        const session = vscode.debug.activeDebugSession;

        if (session) {
            await session.customRequest("threads");
            const evalresult = await session.customRequest("evaluate", { expression: "-exec -device-info", context: "repl" });

            const devicesInfo = this.parseDeviceInfo(evalresult);

            if (devicesInfo === undefined) {
                await vscode.commands.executeCommand("setContext", "oneapi:havedevice", false);
                return;
            }
            await vscode.commands.executeCommand("setContext", "oneapi:havedevice", true);
            await this.deviceViewProvider.setView(this.getDeviceNames(devicesInfo.devices));

        }
    }

    private getDeviceNames(devices: Device[]): SortedDevices {
        const devicesByGroups: SortedDevices = {};

        for (const device of devices) {
            if (devicesByGroups[device.thread_groups]) {
                devicesByGroups[device.thread_groups].push(device);
            } else {
                devicesByGroups[device.thread_groups] = [device];
            }
        }
        return devicesByGroups;
    }

    public parseDeviceInfo(evalresult: { result: string }): { devices: Device[] } | undefined {

        if (evalresult.result === "void") {
            return undefined;
        }

        const deviseList: string = evalresult.result;
        const parsedDeviseList = deviseList.split("\r\n");

        if (!parsedDeviseList || parsedDeviseList.length <= 2) {
            return undefined;
        }

        let devicesJSON = "";

        for (const elem of parsedDeviseList) {
            const elemJSON: string[] = elem.split(": ");

            if (elemJSON[0] === "devices") {
                devicesJSON = "{\"" + elemJSON[0] + "\"" + ":" + "[";

                const devicesList = elemJSON[1].split(/{([^}]+)}/g).slice(1, -1);

                for (const { deviseIndex, device } of devicesList.map((device, deviseIndex) => ({ deviseIndex, device }))) {
                    if (device.length < 3) {
                        continue;
                    }
                    devicesJSON += "{";

                    const property = device.split(",");
                    let jsonField;

                    for (const { itemIndex, item } of property.map((item, itemIndex) => ({ itemIndex, item }))) {
                        const field = item.split("=");

                        jsonField = "\"" + field[0].replace("-", "_") + "\"" + ":" + "\"" + field[1] + "\"";
                        devicesJSON += jsonField;
                        if (itemIndex !== property.length - 1) {
                            devicesJSON += ", ";
                        }
                    }

                    devicesJSON += "}";

                    if (deviseIndex !== devicesList.length - 1) {
                        devicesJSON += ", ";
                    }
                }

                devicesJSON += "]}";
            }
        }

        if (devicesJSON !== "") {
            try {
                const jsonObj = JSON.parse(devicesJSON);

                return jsonObj;
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    }

    public async simdBreakpointsHandler(bpEventList: vscode.BreakpointsChangeEvent): Promise<void> {
        if (bpEventList.added.length !== 0) {
            bpEventList.added.forEach(async bpEvent => {
                if (bpEvent.condition?.startsWith("-break-insert")) {
                    await this.createOrChangeBreakPoint(bpEvent as vscode.SourceBreakpoint);
                }
                return;
            });
        }

        if (bpEventList.changed.length !== 0) {
            bpEventList.changed.forEach(async bpEvent => {
                if (bpEvent.condition?.startsWith("-break-insert")) {
                    await this.createOrChangeBreakPoint(bpEvent as vscode.SourceBreakpoint, true);
                }
            });
        }

        if (bpEventList.removed.length !== 0) {
            bpEventList.removed.forEach(async bpEvent => {
                if (bpEvent.condition?.startsWith("-break-insert")) {
                    const session = await this.checkGbdOneapiSession();

                    this.removeSimdBreakPoint(bpEvent as vscode.SourceBreakpoint, session ? session : undefined);
                }
            });
        }
    }

    public async checkGbdOneapiSession(): Promise<vscode.DebugSession | undefined> {

        const session = vscode.debug.activeDebugSession;

        if (!session) {
            return undefined;
        }
        const evalresult = await session.customRequest("evaluate", { expression: "-exec thread", context: "repl" });

        if (!evalresult.result.includes("lane")) {
            return undefined;
        }

        return session;
    }

    public addSimdBreakPoints(bp: vscode.SourceBreakpoint): void {

        const bps: vscode.Breakpoint[] = [];

        bps.push(bp);
        vscode.debug.addBreakpoints(bps);
        return;
    }

    public async removeSimdBreakPoint(rbp: vscode.SourceBreakpoint, session?: vscode.DebugSession): Promise<void> {

        if (session) {
            const fileAndLine = this.bpToSourceAndLine(rbp, true);
            const cond = "-exec " + "clear " + fileAndLine;

            await session.customRequest("evaluate", { expression: cond, context: "repl" });

        }
        return;
    }

    public async findAndAddSimdBreakPoints(): Promise<void> {

        vscode.debug.breakpoints.forEach(async bpEvent => {
            if (bpEvent.condition?.startsWith("-break-insert")) {
                await this.createOrChangeBreakPoint(bpEvent as vscode.SourceBreakpoint, true);
            }
        });

        return;
    }

    public bpToSourceAndLine(bp: vscode.SourceBreakpoint, isNoZeroBased?: boolean): string {

        const filename = parse(bp.location.uri.path).base;
        let line = bp.location.range.start.line;

        if (isNoZeroBased) {
            line++;
        }

        const cond = filename + ":" + line;

        return cond;
    }

    public async createOrChangeBreakPoint(bpEvent: vscode.SourceBreakpoint, isChange?: boolean): Promise<void> {

        const session = await this.checkGbdOneapiSession();

        if (!session) {
            return;
        }

        if (isChange) {
            await this.removeSimdBreakPoint(bpEvent as vscode.SourceBreakpoint, session);
        }

        const bps = bpEvent as vscode.SourceBreakpoint;
        const fileAndLine = this.bpToSourceAndLine(bps, true);
        const cond = "-exec " + bpEvent.condition + " " + fileAndLine;
        const evalresult = await session.customRequest("evaluate", { expression: cond, context: "repl" });

        if (evalresult.result === "void") {
            await this.removeSimdBreakPoint(bpEvent as vscode.SourceBreakpoint);
            return;
        }
    }

    public async addSimdBreakPointsFromEditor(): Promise<void> {

        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const document = editor.document;
            const selections = editor.selections;
            const inputBoxText = {
                placeHolder: "Please specify <Thread ID>:<SIMD Lane> (Example: 2:3):"
            };

            const rawCondition = await vscode.window.showInputBox(inputBoxText);

            if (!rawCondition) {
                return;
            }

            const regex = /^\d+:(\d+(-\d+)?(,\d+(-\d+)?)*|\d+(,\d+(-\d+)?)+)$/;

            if (!regex.test(rawCondition)) {
                vscode.window.showErrorMessage("Invalid input format. Please use the '<Thread ID>:<SIMD Lane>' format, where lane can be specified as a range (e.g., 1-5), comma-separated values (e.g., 2,3,4,7) or combination.");
                return;
            }

            const condition = "-p " + rawCondition.split(":")[0] + " -l " + rawCondition.split(":")[1];
            const bp = new vscode.SourceBreakpoint(new vscode.Location(document.uri, new vscode.Position(selections[0].start.line, 0)), true, "-break-insert " + condition);

            if (bp) {
                this.addSimdBreakPoints(bp);
            }
        }
        return;
    }
}

export interface Device {
    device_name: string;
    thread_groups: string;
    location: string;
    number: number;
    sub_device: number;
    target_id: string;
    vendor_id: string;
}

export interface SortedDevices {
    [key: string]: Device[];
}

export interface Emask {
    name: string;
    fullname: string;
    file: string;
    line: string;
    threadId: number;
    executionMask: string;
    hitLanesMask: string;
    length: number;
    threadWorkgroup: string;
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

    constructor(private readonly simdtracker: SimdProvider) { }
    public onDidSendMessage(m: DebugProtocol.ProtocolMessage) {
        this.routeDebugMessage(m);
    }

    private routeDebugMessage(m: DebugProtocol.ProtocolMessage): void {
        if (m.type === "event") {
            const e = m as DebugProtocol.Event;

            switch (e.event) {
            case "stopped": {
                this.simdtracker.fetchEMaskForAll();
                this.simdtracker.fetcDevicesForAll();
                break;
            }
            default:
                break;
            }
        }
        return;
    }
}
