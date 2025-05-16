/**
 * Copyright (c) 2025 Intel Corporation
 * SPDX-License-Identifier: MIT
 */
import { Filter } from "./SimdProvider";

/**
 * Builds the full -exec -thread-filter command with thread/lane/coordinate/user filters.
 * Automatically omits unnecessary parts, e.g., lane when thread is set,
 * or "&&" when no coordinates exist before a user filter.
 */
export function buildFilterCommand(filter?: Filter): string | undefined {
    if (!filter) {
        return undefined;
    }
    // Treat empty filter object (from gatherFilterData) as undefined
    const isThreadAll = filter.threadValue === "All" || filter.threadValue === "";

    const isEmpty =
        (!filter.filter || filter.filter === "") &&
        isThreadAll &&
        (!filter.localWorkItemValue || filter.localWorkItemValue === "") &&
        (!filter.globalWorkItemValue || filter.globalWorkItemValue === "") &&
        (!filter.workGroupValue || filter.workGroupValue === "");

    if (isThreadAll) {
        filter.threadValue = "";
    }

    if (isEmpty) {
        return undefined;
    }

    const mainQuery = buildQuery(filter);
    const userFilter = filter.filter?.trim();

    if (!mainQuery && !userFilter) {
        return undefined;
    }

    let command = "-exec -thread-filter";

    // Remove the internal tag used to detect presence of coordinates
    const noCoord = mainQuery.includes("__NO_COORD__");
    const cleanedMainQuery = mainQuery.replace(" __NO_COORD__", "");

    if (cleanedMainQuery) {
        command += ` ${cleanedMainQuery}`;
    }

    if (userFilter) {
        // Add "&&" before user filter only if there is a non-flag main query AND coordinates exist
        const separator =
            cleanedMainQuery && !isFlagOnly(cleanedMainQuery) && !noCoord
                ? " && "
                : " ";

        command += `${separator}(${userFilter})`;
    }

    return command;
}

/**
 * Constructs the main part of the thread-filter query: thread + lane + coordinates.
 * If only thread exists (no coordinates), marks this with a `__NO_COORD__` tag.
 */
function buildQuery(filter: Filter): string {
    const threadPart = formatValue(filter.threadValue);
    const hasThread = !!filter.threadValue?.trim();
    const lanePart = formatLane(filter.laneValue, hasThread);
    
    // If no thread specified but lane exists, set thread to "*"
    let query = threadPart;

    if (lanePart) {
        // If lanePart has value but doesn't include special flags and there's no thread, prepend "*:"
        if (!hasThread && lanePart.length > 0 && !lanePart.includes("--all-lanes") && !lanePart.includes("--selected-lanes")) {
            query = "*";
            query += `:${lanePart}`;
        } else {
            query += query
                ? needsColon(lanePart, hasThread)
                    ? `:${lanePart}`
                    : ` ${lanePart}`
                : lanePart;
        }
    }

    const coordinates = buildCoordinateConditions(filter);
    const parts = [query.trim(), coordinates].filter(Boolean);

    if (parts.length === 1 && !coordinates) {
        // Signal to the caller that there are no coordinates,
        // used to suppress extra "&&" before user filters
        return parts[0] + " __NO_COORD__";
    }

    return parts.join(" ").trim();
}

function needsColon(lanePart: string, hasThread: boolean): boolean {
    // If '--all-lanes' is present and a thread is specified, use colon with '*'
    if (hasThread && lanePart.includes("--all-lanes")) {
        return true;
    }

    // If '--selected-lanes' is present, never use colon
    if (lanePart.includes("--selected-lanes")) {
        return false;
    }

    // Fallback to original logic for other lane flags
    return !(
        lanePart.includes("--all-lanes") || lanePart.includes("--selected-lanes")
    );
}

/**
 * Formats comma-separated thread values.
 */
function formatValue(value?: string): string {
    if (!value) {
        return "";
    }
    return value === "*"
        ? "*"
        : value
            .split(",")
            .map((v) => v.trim())
            .join(" ");
}

/**
 * Formats the lane part.
 * If thread is present and '--all-lanes' is used, returns '*'.
 * If thread is present and '--selected-lanes' is used, suppresses lane.
 * Otherwise returns laneValue with '--s'.
 */
function formatLane(laneValue?: string, hasThread: boolean = false): string {
    if (!laneValue) {
        return "";
    }

    const trimmed = laneValue.trim();

    if (trimmed === "--all-lanes") {
        return hasThread ? "*" : formatValue(`${trimmed} --s`);
    }

    if (trimmed === "--selected-lanes") {
        return hasThread ? "" : formatValue(`${trimmed} --s`);
    }

    // Default: any other custom lane value
    return formatValue(trimmed);
}

/**
 * Returns true if the query consists only of flags like `--all-lanes --s`
 */
function isFlagOnly(query: string): boolean {
    return /^--\S+(\s--\S+)*$/.test(query);
}

/**
 * Builds all coordinate conditions (local/global/workgroup)
 */
function buildCoordinateConditions(filter: Filter): string {
    const conditions: string[] = [];

    addCondition(filter.localWorkItemValue, "$_workitem_local_id", conditions);
    addCondition(filter.globalWorkItemValue, "$_workitem_global_id", conditions);
    addCondition(filter.workGroupValue, "$_thread_workgroup", conditions);

    return conditions.join(" && ");
}

/**
 * Adds a parsed coordinate condition (if valid)
 */
function addCondition(
    value: string | undefined,
    variable: string,
    conditions: string[]
): void {
    const condition = parseCoordinates(value, variable);

    if (condition) {
        conditions.push(condition);
    }
}

/**
 * Converts a 1D, 2D, or 3D coordinate string (e.g. "1,2,3") into filter conditions.
 * Handles ranges like "4-6".
 */
function parseCoordinates(input: string | undefined, variable: string): string {
    if (!input) {
        return "";
    }

    const dimensions = input.split(",").map((v) => v.trim());
    const checks: string[] = [];

    dimensions.forEach((dim, idx) => {
        if (!dim || dim === "*") {
            return;
        }

        if (dim.includes("-")) {
            const rangeChecks = expandRange(dim)
                .map((num) => `(${variable}[${idx}] == ${num})`)
                .join(" || ");

            if (rangeChecks) {
                checks.push(`(${rangeChecks})`);
            }
        } else {
            checks.push(`(${variable}[${idx}] == ${dim})`);
        }
    });

    return checks.join(" && ");
}

/**
 * Expands a numeric range like "4-6" into ["4", "5", "6"]
 */
function expandRange(range: string): string[] {
    const [start, end] = range.split("-").map(Number);

    if (isNaN(start) || isNaN(end) || start > end) {
        return [];
    }
    return Array.from({ length: end - start + 1 }, (_, i) =>
        (start + i).toString()
    );
}
