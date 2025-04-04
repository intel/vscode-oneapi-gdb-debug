/**
 * Copyright (c) 2023-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

import { Breakpoint } from "./Debugging/Types";

export const VSCODE_PATH = "../array-transform/.vscode";
export const TASKS_JSON_PATH = `${VSCODE_PATH}/tasks.json`;
export const DEFAULT_BREAKPOINT: Breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };