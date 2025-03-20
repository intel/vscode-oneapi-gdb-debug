import { Filter } from "./SimdProvider";

/**
 * Main function to build the final command string (e.g., `-exec -thread-filter ... && (extraFilter)`).
 */
export function buildFilterCommand(filter?: Filter): string | undefined {
    if (!filter) {
        return undefined;
    }

    const mainQuery = buildQueryString(filter).trim();

    if (!mainQuery && !filter.filter) {
        return undefined;
    }

    if (filter.filter) {
        // If mainQuery contains "&&", we assume there are coordinate conditions => keep "&&".
        // Otherwise, place the user filter with a space.
        const separator = mainQuery.includes("&&") ? " && " : " ";

        return `-exec -thread-filter --s ${mainQuery}${separator}(${filter.filter})`;
    }

    return `-exec -thread-filter --s ${mainQuery}`;
}


/**
 * Build the raw query string according to the rules for thread/lane
 * and the optional local/global/workGroup coordinates.
 */
function buildQueryString(filter: Filter): string {
    // Check special flags: -all / --all-lanes
    const finalFlag = checkSpecialFlags(filter.threadValue, filter.laneValue);

    if (finalFlag) {
        // If we have a special flag, skip normal parsing but still consider any coordinate conditions
        const extraConditions = buildCoordinateConditions(filter);

        // 1) If finalFlag is either "--selected-lanes" or "--all-lanes"
        // 2) There are no coordinate conditions
        // 3) There's also no user-defined filter
        // => We want no filter at all, so return ""
        const userHasNoFilter = !(filter.filter && filter.filter.trim());

        if (!extraConditions && userHasNoFilter && (finalFlag === "--selected-lanes" || finalFlag === "--all-lanes")) {
            // Return empty => leads to undefined in buildFilterCommand
            return "";
        }

        // Otherwise, if we still have finalFlag plus possible conditions
        if (extraConditions) {
            // Join them with a space, if you don't want && in front
            return `${finalFlag} ${extraConditions}`;
        }
        return finalFlag;
    }

    // If no finalFlag, handle normal thread/lane logic
    const threadPart = formatThreadValue(filter.threadValue);
    const lanePart = formatLaneValue(filter.laneValue, threadPart);
    let result = "";

    if (threadPart && lanePart) {
        result = `${threadPart}:${lanePart}`;
    } else if (threadPart) {
        result = threadPart;
    } else if (lanePart) {
        result = lanePart;
    }

    // Build coordinate conditions
    const extraConditions = buildCoordinateConditions(filter);

    if (extraConditions) {
        // Join with a space instead of &&
        if (result) {
            result += ` ${extraConditions}`;
        } else {
            result = extraConditions;
        }
    }

    return result.trim();
}


/**
 * Check if we have any of the special top-level flags:
 *   - threadValue=-all and laneValue=-all => output "--selected-lanes"
 *   - threadValue=-all and laneValue=--all-lanes => output "--all-lanes"
 */
function checkSpecialFlags(threadValue?: string, laneValue?: string): string {
    if (threadValue === "--selected-lanes" && laneValue === "--selected-lanes") {
        return "--selected-lanes";
    }
    if (threadValue === "--selected-lanes" && laneValue === "--all-lanes") {
        return "--all-lanes";
    }
    // Otherwise, no special flag
    return "";
}

/**
 * Format the threadValue unless it's a special flag.
 * If threadValue = "--selected-lanes", return "*".
 */
function formatThreadValue(threadValue?: string): string {
    if (!threadValue) {
        return "";
    }
    if (threadValue === "--selected-lanes") {
        // Previously returned "", but we need "*" so we get *:3 5 7
        return "*";
    }
    return formatRange(threadValue);
}

/**
 * Format the laneValue.
 *   - If laneValue === --all-lanes => "*"
 *   - If laneValue === -all and threadPart is not empty => "*"
 *   - Otherwise parse numeric or range
 */
function formatLaneValue(laneValue?: string, threadPart?: string): string {
    if (!laneValue) {
        return "";
    }

    if (laneValue === "--all-lanes") {
        return "*";
    }

    if (laneValue === "--selected-lanes") {
        // only if threadPart is nonempty (which might be "*")
        if (threadPart) {
            return "*";
        }
        return "";
    }

    // Otherwise parse numeric range
    return formatRange(laneValue);
}

/**
 * Convert commas to spaces, keep dashes as is, and handle "*" as is.
 *   "*" => "*"
 *   "1,2,3" => "1 2 3"
 *   "1-3" => "1-3"
 *   "1,3,5" => "1 3 5"
 */
function formatRange(value: string): string {
    if (value.trim() === "*") {
        return "*";
    }
    // Split on commas and join with spaces
    const parts = value.split(",").map((part) => part.trim());

    return parts.join(" ");
}

/**
 * Build conditions for localWorkItemValue, globalWorkItemValue, workGroupValue.
 * Combine them with " && " if multiple exist.
 */
function buildCoordinateConditions(filter: Filter): string {
    const conditions: string[] = [];

    if (filter.localWorkItemValue) {
        const local = parseCoordinates(filter.localWorkItemValue, "$_workitem_local_id");

        if (local) {
            conditions.push(local);
        }
    }

    if (filter.globalWorkItemValue) {
        const global = parseCoordinates(filter.globalWorkItemValue, "$_workitem_global_id");

        if (global) {
            conditions.push(global);
        }
    }

    if (filter.workGroupValue) {
        const group = parseCoordinates(filter.workGroupValue, "$_thread_workgroup");

        if (group) {
            conditions.push(group);
        }
    }

    if (!conditions.length) {
        return "";
    }
    // The conditions themselves are joined by &&, e.g.:
    // ($_workitem_local_id[2] == 0) && ($_workitem_global_id[1] == 0)
    return conditions.join(" && ");
}

/**
 * Parse coordinate-like input (e.g., "*,*,0") into dimension checks:
 *   "($_workitem_local_id[2] == 0)"
 * Skips "*" dimensions and expands dash ranges to OR conditions if needed.
 */
function parseCoordinates(input: string, variable: string): string {
    if (!input.trim()) {
        return "";
    }

    const components = input.split(",").map((part) => part.trim());
    const dimensionChecks: string[] = [];

    components.forEach((value, index) => {
        if (!value || value === "*") {
            // skip wildcard dimension
            return;
        }

        if (value.includes("-")) {
            // e.g.: "1-3" => expand to (x==1) || (x==2) || (x==3)
            const numericMatches = expandRange(value);

            if (numericMatches.length > 0) {
                const orClause = numericMatches
                    .map((num) => `(${variable}[${index}] == ${num})`)
                    .join(" || ");

                dimensionChecks.push(`(${orClause})`);
            }
        } else {
            // single numeric value
            dimensionChecks.push(`(${variable}[${index}] == ${value})`);
        }
    });

    return dimensionChecks.join(" && ");
}

/**
 * Expand a dash range like "1-3" into ["1","2","3"].
 * If invalid, returns an empty array.
 */
function expandRange(rangeStr: string): string[] {
    const [startStr, endStr] = rangeStr.split("-").map((x) => x.trim());
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (isNaN(start) || isNaN(end) || start > end) {
        return [];
    }

    const result: string[] = [];

    for (let i = start; i <= end; i++) {
        result.push(i.toString());
    }
    return result;
}
