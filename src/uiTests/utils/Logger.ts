/**
 * Copyright (c) 2023-2024 Intel Corporation
 * SPDX-License-Identifier: MIT
 */

export abstract class ILogger {
    abstract Info(message: string): void;
    abstract Error(message: unknown): void;
    abstract Pass(message: string): void;
}

export class ConsoleLogger implements ILogger {
    Error(message: string): void {
        console.trace(this.Message(`[ERROR] ${message}`));
    }

    Pass(message: string): void {
        console.log(this.Message(`[PASS] ${message}`));
    }

    Info(message: string): void {
        console.log(this.Message(`[INFO] ${message}`));
    }

    private Message(message: string): string {
        const [indent, location] = this.GetStackInfo();
        const part1 = `[${this.GetTimestamp()}] ${"=".repeat(indent)}> ${message}`;
        const part2 = `[at ${location}]`;
        const spaces = process.stdout.columns - part1.length - part2.length - 2;

        return `${part1} ${spaces <= 0 ? "\n" : " ".repeat(spaces)} ${part2}`;
    }

    private GetTimestamp(): string {
        const date = new Date();

        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    private GetStackInfo(): [number, string] {
        const stack = (new Error().stack ?? "").split("\n").filter(x => /\.ts/.exec(x));
        const indent = Math.max(stack.length - 5, 1);
        const location = /(?=[^\/]*$).*\.ts\:\d+\:\d+/.exec(stack[5]);

        return [indent, location?.pop() ?? ""];
    }
}

export abstract class LoggerAggregator extends ILogger {
    private static loggers: ILogger[];
    private constructor() {
        super();
    }
    static InitLoggers(...loggers: ILogger[]) {
        if (!LoggerAggregator.loggers) {
            Error.stackTraceLimit = Infinity;
            LoggerAggregator.loggers = loggers;
        }
    }

    static Info(message: string): void {
        LoggerAggregator.loggers.forEach(logger => logger.Info(message));
    }

    static Error(message: unknown): void {
        LoggerAggregator.loggers.forEach(logger => logger.Error(message));
    }

    static Pass(message: string): void {
        LoggerAggregator.loggers.forEach(logger => logger.Pass(message));
    }
    async Step(label: string, fn: () => Promise<void>): Promise<void> {
        for (const logger of this.loggers) {
            await logger.Step(label, fn);
        }
    }
}