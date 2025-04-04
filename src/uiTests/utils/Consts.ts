/**
 * Copyright (c) 2023-2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { Breakpoint } from "./Debugging/Types";
import { HwInfo } from "./HardwareInfo/Types";

export const TEST_DIR = process.env.TEST_DIR ?? (() => { throw new Error("'TEST_DIR' env variable is not set!"); })();
export const VSCODE_PATH = `${TEST_DIR}/.vscode`;
export const TASKS_JSON_PATH = `${VSCODE_PATH}/tasks.json`;
export const DEFAULT_BREAKPOINT: Breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };
export const REMOTE_DEBUGGING = process.env.REMOTE_DEBUGGING?.toLowerCase() === "true";
export const REMOTE_USER: string | undefined = process.env.REMOTE_USER ?? (REMOTE_DEBUGGING ? (() => { throw new Error("'REMOTE_USER' env variable is not set!"); })() : undefined);
export const REMOTE_PASS: string | undefined = process.env.REMOTE_PASS ?? (REMOTE_DEBUGGING ? (() => { throw new Error("'REMOTE_PASS' env variable is not set!"); })() : undefined);
export const REMOTE_HOST: string | undefined = process.env.REMOTE_HOST ?? (REMOTE_DEBUGGING ? (() => { throw new Error("'REMOTE_HOST' env variable is not set!"); })() : undefined);

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
    },
    {
        Name: "Intel(R) Arc(TM) A380 Graphics",
        Cores: 128,
        "Vendor ID": "0x8086",
        "Target ID": "0x56a5",
        SimdWidth: 8
    }
];