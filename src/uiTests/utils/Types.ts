/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

// #region Enums

export enum ConditionalBreakpointType {
    SimdCommand = "SimdCommand",
    SimdGui = "SimdGui",
    NativeCommand = "NativeCommand",
    NativeGui = "NativeGui",
}

export enum OneApiDebugPane {
    OneApiGpuThreads = "oneAPI GPU Threads Section",
    HardwareInfo = "Hardware Info Section",
    SelectedLane = "Selected Lane Section"
}

// #endregion

// #region Types

/**
 * Represents the notification popup.
 */
export type NotificationPopup = {
    name: string;
    message: string;
    installButton: string;
};

/**
 * VsCode task template.
 */
export type VsCodeTask = {
    label: string;
    command: string;
    type: string;
    problemMatcher?: [];
};

/**
 * Breakpoint template.
 */
export type Breakpoint = {
    fileName: string;
    lineNumber: number;
};

/**
 * Conditional breakpoint template.
 */
export type ConditionalBreakpoint = {
    type: ConditionalBreakpointType;
    condition: string;
} & Breakpoint;

/**
 * Possible debug panes.
 */
export type DebugPane = "Breakpoints Section" | `${OneApiDebugPane}`;

// #endregion