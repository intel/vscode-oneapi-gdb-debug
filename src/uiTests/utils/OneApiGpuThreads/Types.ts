/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { WebElement } from "vscode-extension-tester";

/**
 * OneAPI GPU thread.
 */
export type Thread = {
    threadId: number;
    targetId: string;
    location: string;
    workGroup: string;
    simdLanes: SimdLane[];
};

/**
 * GPU thread SIMD lane.
 */
export type SimdLane = {
    laneId: number;
    current: boolean;
    state: "Active" | "Inactive" | "Hit";
    details: SimdLaneDetails;
    indicator: string | undefined;
    handle: WebElement;
};

/**
 * GPU thread SIMD lane details.
 */
export type SimdLaneDetails =  {
    lane: number;
    name: string;
    threadId: number;
    executionMask: string;
    hitLanesMask: string;
    length: number;
};