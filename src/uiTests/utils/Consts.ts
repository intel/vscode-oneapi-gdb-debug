/**
 * Copyright (c) 2023-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { Breakpoint } from "./Debugging/Types";
import { HwInfo } from "./HardwareInfo/Types";

export const VSCODE_PATH = "../array-transform/.vscode";
export const TASKS_JSON_PATH = `${VSCODE_PATH}/tasks.json`;
export const DEFAULT_BREAKPOINT: Breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };

/**
 * Supported devices list.
 */
export const DEVICES: HwInfo[] = [
    {
        Name: "Intel(R) Arc(TM) A730M Graphics",
        Cores: 384,
        "Vendor ID": "0x8086",
        "Target ID": "0x5691",
        SimdWidth: 8
    }
];