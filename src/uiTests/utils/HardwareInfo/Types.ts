/**
 * Copyright (c) 2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

/**
 * Represents the Hardware info pane.
 */
export type HwInfo = {
    [key: string]: string | undefined | number;
    Name: string;
    Cores: number | string;
    Location?: string;
    Number?: number | string;
    "Sub device"?: string;
    "Vendor ID": string;
    "Target ID": string;
    SimdWidth: number;
}