/**
 * Copyright (c) 2024-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { NodeSSH } from "node-ssh";

// #region Enums

export enum OneApiDebugPane {
    OneApiGpuThreads = "oneAPI GPU Threads Section",
    HardwareInfo = "Hardware Info Section",
    SelectedLane = "Selected Lane Section"
}

// #endregion

// #region Types

export type RemoteTestOptions = {
    remoteTests: true;
    ssh: Promise<NodeSSH>;
    remoteUser: string;
    remotePass: string;
    remoteHost: string;
}

type LocalTestOptions = {
    remoteTests: false;
}

export type TestOptions = LocalTestOptions | RemoteTestOptions;

type RemoteFsOptions = {
    remotePath: true;
    ssh: Promise<NodeSSH>;
}

type LocalFsOptions = {
    remotePath: false;
};

export type CustomExtensionSection = { customName: string };
export type ExtensionSection = "Installed" | CustomExtensionSection;

export type FsOptions = LocalFsOptions | RemoteFsOptions;

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