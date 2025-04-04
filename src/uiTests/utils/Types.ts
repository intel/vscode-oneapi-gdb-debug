/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

// #region Enums

export enum OneApiDebugPane {
    OneApiGpuThreads = "oneAPI GPU Threads Section",
    HardwareInfo = "Hardware Info Section",
    SelectedLane = "Selected Lane Section"
}

// #endregion

// #region Types

export type FsOptions = {
    remotePath: boolean;
}

/**
 * Represents the notification popup.
 */
export type NotificationPopup = {
    name: string;
    message: string;
    installButton: string;
    id?: string;
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
 * Possible debug panes.
 */
export type DebugPane = "Breakpoints Section" | "Call Stack Section" | `${OneApiDebugPane}`;

/**
 * OneAPI debug pane titles
 */
export type OneApiDebugPaneFrameTitle = "oneAPI GPU Threads" | "Hardware Info" | "Selected Lane";

// #endregion