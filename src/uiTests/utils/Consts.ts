/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

import { Breakpoint } from "./Types";

export const VSCODE_PATH = "../array-transform/.vscode";
export const TASKS_JSON_PATH = `${VSCODE_PATH}/tasks.json`;
export const DEFAULT_BREAKPOINT: Breakpoint = { fileName: "array-transform.cpp", lineNumber: 54 };