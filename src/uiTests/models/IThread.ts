import { WebElement } from "vscode-extension-tester";

/**
 * Gpu thread.
 */
export interface IThread {
    threadId: number;
    targetId: string;
    location: string;
    workGroup: string;
    simdLanes: SimdLane[];
}

export interface SimdLane {
    laneId: number;
    current: boolean;
    state: "Active" | "Inactive" | "Hit";
    details: SimdLaneDetails;
    indicator: string | undefined;
    handle: WebElement;
}

export interface SimdLaneDetails {
    lane: number;
    name: string;
    threadId: number;
    executionMask: string;
    hitLanesMask: string;
    length: number;
}