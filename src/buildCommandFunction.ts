import { Filter } from "./SimdProvider";

export function buildFilterCommand(filter?: Filter): string | undefined {
    if (!filter) {return undefined;}

    const mainQuery = buildQuery(filter);
    const userFilter = filter.filter?.trim();

    if (!mainQuery && !userFilter) {return undefined;}

    let command = "-exec -thread-filter";

    if (mainQuery) {command += ` ${mainQuery}`;}

    if (userFilter) {
        const separator = mainQuery && !isFlagOnly(mainQuery) ? " && " : " ";

        command += `${separator}(${userFilter})`;
    }

    return command;
}

function buildQuery(filter: Filter): string {
    const threadPart = formatValue(filter.threadValue);
    const lanePart = formatLane(filter.laneValue, !!threadPart);

    let query = threadPart;

    if (lanePart) {
        query += query
            ? needsColon(lanePart)
                ? `:${lanePart}`
                : ` ${lanePart}`
            : lanePart;
    }

    const coordinates = buildCoordinateConditions(filter);

    return [query.trim(), coordinates].filter(Boolean).join(" ").trim();
}

function formatValue(value?: string): string {
    if (!value) {return "";}
    return value === "*"
        ? "*"
        : value
            .split(",")
            .map((v) => v.trim())
            .join(" ");
}

function formatLane(laneValue?: string, hasThread: boolean = false): string {
    if (!laneValue || hasThread) {return "";}
    if (laneValue === "--all-lanes" || laneValue === "--selected-lanes") {
        return `${laneValue} --s`;
    }
    return formatValue(laneValue);
}

function needsColon(lanePart: string): boolean {
    return !(
        lanePart.includes("--all-lanes") || lanePart.includes("--selected-lanes")
    );
}

function buildCoordinateConditions(filter: Filter): string {
    const conditions: string[] = [];

    addCondition(filter.localWorkItemValue, "$_workitem_local_id", conditions);
    addCondition(filter.globalWorkItemValue, "$_workitem_global_id", conditions);
    addCondition(filter.workGroupValue, "$_thread_workgroup", conditions);

    return conditions.join(" && ");
}

function addCondition(
    value: string | undefined,
    variable: string,
    conditions: string[]
): void {
    const condition = parseCoordinates(value, variable);

    if (condition) {conditions.push(condition);}
}

function parseCoordinates(input: string | undefined, variable: string): string {
    if (!input) {return "";}

    const dimensions = input.split(/[,\.]/).map((v) => v.trim());
    const checks: string[] = [];

    dimensions.forEach((dim, idx) => {
        if (!dim || dim === "*") {return;}

        if (dim.includes("-")) {
            const rangeChecks = expandRange(dim)
                .map((num) => `(${variable}[${idx}] == ${num})`)
                .join(" || ");

            if (rangeChecks) {checks.push(`(${rangeChecks})`);}
        } else {
            checks.push(`(${variable}[${idx}] == ${dim})`);
        }
    });

    return checks.join(" && ");
}

function expandRange(range: string): string[] {
    const [start, end] = range.split("-").map(Number);

    if (isNaN(start) || isNaN(end) || start > end) {return [];}
    return Array.from({ length: end - start + 1 }, (_, i) =>
        (start + i).toString()
    );
}

function isFlagOnly(query: string): boolean {
    return /^--\S+(\s--\S+)*$/.test(query);
}
