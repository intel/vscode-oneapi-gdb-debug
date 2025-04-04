/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

/**
 * Types of avaialable conditional breakpoints.
 */
export enum ConditionalBreakpointType {
    SimdCommand = "SimdCommand",
    SimdGui = "SimdGui",
    NativeCommand = "NativeCommand",
    NativeGui = "NativeGui",
}

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