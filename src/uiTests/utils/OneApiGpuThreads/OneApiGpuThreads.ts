/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { ExecuteInOneApiDebugPaneFrame, GetDebugPane, GetStringBetweenStrings, SetInputText, Wait } from "../CommonFunctions";
import { By, WebElement, Workbench } from "vscode-extension-tester";
import { SimdLane, SimdLaneDetails, Thread } from "./Types";

export async function GetGpuThreads(): Promise<Thread[]> {
    const gpuThreadsView = await GetDebugPane("oneAPI GPU Threads Section");
    const gpuThreadsViewClass = await gpuThreadsView?.getAttribute("class");

    if (!gpuThreadsViewClass?.includes("expanded")) {
        await gpuThreadsView?.click();
    }

    await SetInputText("> Intel oneAPI: Refresh SIMD Data");
    await Wait(3 * 1000);
    return await ExecuteInOneApiDebugPaneFrame(async(driver) => {
        const gpuThreadsObj: Thread[] = [];
        const gpuThreads = await driver.findElement(By.id("simd-view"));
        const gpuThreadsRows = await gpuThreads.findElements(By.css("#simd-view > tbody > tr"));

        for (const row of gpuThreadsRows) {
            const rowData = await row.findElements(By.css("td"));
            const rowParsed = [];
            const simdLanes: SimdLane[] = [];

            for (const data of rowData) {
                let cellGroup: WebElement | undefined = undefined;

                try { cellGroup = await data.findElement(By.className("cell-group")); }
                catch { /* empty */ }

                if (cellGroup) {
                    const lanes = await cellGroup.findElements(By.css("div"));

                    for (const lane of lanes) {
                        const customSymbol = await lane.getText();
                        const laneId = await lane.getAttribute("id");
                        const laneClass = await lane.getAttribute("class");
                        const simdDetails = JSON.parse(laneId) as SimdLaneDetails;
                        const current = laneClass.includes("current");
                        const active = laneClass.includes("colored");
                        const hit = laneClass.includes("hitCell");
                        const script = "return window.getComputedStyle(arguments[0],'::before').getPropertyValue('content')";
                        const driver = new Workbench().getDriver();
                        const indicator = await driver.executeScript(script, lane) as string;

                        simdLanes.push({
                            laneId: simdDetails.lane,
                            current: current,
                            state: hit ? "Hit" : active ? "Active" : "Inactive",
                            details: simdDetails,
                            indicator: indicator.replace(/"/g, ""),
                            handle: lane,
                            customSymbol: customSymbol
                        });
                        continue;
                    }
                }
                let location: string | undefined;

                const rowClass = await data.getAttribute("class");

                if (rowClass === "simdtooltip") {
                    try { location = await (await data.findElement(By.css("span"))).getAttribute("innerHTML");}
                    catch { /* empty */ }
                }
                const rowDataText = await data.getText();
                const index = rowData.indexOf(data);

                if (index === 0 ) {
                    rowParsed.push(GetStringBetweenStrings(rowDataText, "[", "]"));
                    rowParsed.push(GetStringBetweenStrings(rowDataText, "(", ")"));
                    continue;
                }
                if (index !== 4 ) { rowParsed.push(location || rowDataText); }
            }
            gpuThreadsObj.push({
                threadId: parseInt(rowParsed[0]),
                targetId: rowParsed[1],
                location: rowParsed[2].replace(/\s/g, ""),
                workGroup: rowParsed[3],
                simdLanes: simdLanes
            });
        }

        return gpuThreadsObj;
    }, "oneAPI GPU Threads");
}

export async function GetCurrentThread(threads?: Thread[]): Promise<Thread | undefined> {
    threads = threads ?? await GetGpuThreads();

    return threads.find(x => x.simdLanes.find(x => x.current));
}