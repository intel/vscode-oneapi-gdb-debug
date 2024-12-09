/**
 * Copyright (c) 2023-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { Breakpoint } from "./Debugging/Types";
import { HwInfo } from "./HardwareInfo/Types";

export const TEST_DIR = process.env.TEST_DIR ?? (() => { throw new Error("'TEST_DIR' env variable is not set!"); })();
export const VSCODE_PATH = `${TEST_DIR}/.vscode`;
export const TASKS_JSON_PATH = `${VSCODE_PATH}/tasks.json`;
export const DEFAULT_BREAKPOINT: Breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };
export const REMOTE_DEBUGGING = process.env.REMOTE_DEBUGGING?.toLowerCase() === "true";

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