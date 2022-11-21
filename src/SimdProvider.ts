/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

"use strict";
import * as vscode from "vscode";

// import {  InvalidatedEvent } from 'vscode-debugadapter';
// import { EventEmitter } from 'events'
import { DebugProtocol } from "vscode-debugprotocol";
import { DeviceViewProvider } from "./viewProviders/deviceViewProvider";
import { SIMDViewProvider } from "./viewProviders/SIMDViewProvider";
 
interface ThreadInfo {
    index: number;
    threadId: number;
    name: string;
}

export interface CurrentThread {
    name: string;
    lane: number;
}
 
export class SimdProvider {
 
    private threadsInfoArray: ThreadInfo[] = [];

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

        //We need to test if multi debug sessions get effected by this, we might need to initialize multiple instances of this object :/
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            console.log("Debug Session " + session.id + " terminated");
            this.simdViewProvider.cleanView();
        }));
        
        context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(e => {
            console.log(e);
        }));
        
    }
    set threadsInfo(value: ThreadInfo[]){
        this.threadsInfoArray = value;
    }
 
    get threadsInfo():ThreadInfo[]{
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

            const masks: Emask[] = []; // optimise?
            let simd_with = 0;
            let execution_mask  = "0";
            let hit_lane_mask  = "0";
            let func  = "";
            let target_id  = "";
            let thread_id = 0;
            let i = 0;

            // If there are no GPU threads
            if (!evalresult.result.includes(("arch=intelgt"))) {
                return;
            }
            
            // Roughly divide the string by threads
            const rougeThreads = evalresult.result.split("{id=");
            
            for (const t of rougeThreads) {
                // Process only GPU threads
                if (!t.includes(("arch=intelgt"))) {
                    continue;
                }

                const property = t.split(",");

                for (const item of property)
                {
                    thread_id = property[0];
                    const pair = item.split("=");

                    if(pair[0] === "func") {
                        func = pair[1].replace(/[{}]/g, "");
                    }
                    if(pair[0] === "hit-lanes-mask") {
                        hit_lane_mask =pair[1]?.replace(/[{}]/g, "");
                    }
                    if(pair[0] === "execution-mask") {
                        execution_mask = pair[1].replace(/[{}]/g, "");
                    }
                    if(pair[0] === "simd-width") {
                        simd_with = parseInt(pair[1].replace(/[{}]/g, ""), 16);
                    }
                    if(pair[0] === "target-id") {
                        target_id = pair[1];
                    }
                }

                masks.push({ func: func, name: this.threadsInfoArray[i]?.name || target_id , threadId: thread_id, executionMask: execution_mask, hitLanesMask: hit_lane_mask, length: simd_with });
                i++;
            }
 
 
            if (!masks.length) {
                return; //exit, no simd detected
            }
            const currentThread = await this.getCurrentThread();

            this.simdViewProvider.setView(masks, currentThread);
        }
    }

    public async fetcDevicesForAll(): Promise<void> {
        const session = vscode.debug.activeDebugSession;

        if (session) {
            await session.customRequest("threads");
            const evalresult = await session.customRequest("evaluate", { expression: "-exec -device-info", context: "repl" });

            const devicesInfo = this.parseDeviceInfo(evalresult);

            if ( devicesInfo === undefined) {
                this.deviceViewProvider.setErrorView();
                return;
            }
            
            this.deviceViewProvider.setView(this.getDeviceNames(devicesInfo.devices));
        }
    }

    private getDeviceNames(devices: Device[]): SortedDevices {
        const devicesByGroups: SortedDevices = {};

        for (const device of devices){
            if(devicesByGroups[device.thread_groups]){
                devicesByGroups[device.thread_groups].push(device);
            } else {
                devicesByGroups[device.thread_groups] = [device];
            }
        }
        return devicesByGroups;
    }

    public parseDeviceInfo(evalresult : {result: string} ): {devices:Device[]} | undefined {

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
                    devicesJSON += "{";

                    const property = device.split(",");
                    let jsonField;

                    for (const { itemIndex, item } of property.map((item, itemIndex) => ({ itemIndex, item }))) {
                        const field = item.split("=");

                        jsonField = "\"" + field[0].replace("-","_") + "\"" + ":" + "\"" + field[1] + "\"";
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
            } catch(e) {
                return undefined;
            }
        }
        return undefined;
    }

    public async getCurrentThread(): Promise<CurrentThread | undefined> {
        const session = vscode.debug.activeDebugSession;

        if (session) {
            await session.customRequest("threads");
            const evalresult = await session.customRequest("evaluate", { expression: "-exec thread", context: "repl" });
            
            if (evalresult.result === "void") {
                return undefined;
            }

            const threadInfo = evalresult.result.replace(/[({})]/g, "").split(" ");

            return {
                name: `${threadInfo[4]} ${threadInfo[5]}`,
                lane: +threadInfo[7].replace(/[^0-9]/g, "")
            };
        }
        return undefined;
    }

    public async swithSIMDLane(oldSimdLane : string | undefined): Promise<void> {
        if (!oldSimdLane) {
            return;
        }

        const newSimdLane = await vscode.window.showInputBox({
            placeHolder: oldSimdLane,
            title: "Type new SIMD lane"
        });

        const session = vscode.debug.activeDebugSession;

        if (session) {
            await session.customRequest("threads");
            const evalresult = await session.customRequest("evaluate", { expression: "-exec thread "+ newSimdLane, context: "repl" });
            
            if (evalresult.result === "void") {
                return;
            }
            // this.sendEvent(new InvalidatedEvent( ['variables'] )); 
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
     func: string;
     threadId: number;
     executionMask: string;
     hitLanesMask: string;
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
 
    constructor(private readonly simdtracker: SimdProvider) {}
 
    public onDidSendMessage(m: DebugProtocol.ProtocolMessage) {
        this.routeDebugMessage(m);
    }
 
    private routeDebugMessage(m: DebugProtocol.ProtocolMessage): void {
        if (m.type === "event") {
            const e = m as DebugProtocol.Event;
 
            switch (e.event) {
            case "stopped": {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const stopped = e as DebugProtocol.StoppedEvent;

                this.simdtracker.fetchEMaskForAll();
                this.simdtracker.fetcDevicesForAll();
            }}}
        return;
    }}
 