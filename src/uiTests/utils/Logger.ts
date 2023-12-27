export abstract class ILogger {
    abstract Info(message: string): void;
    abstract Error(message: unknown): void;
    abstract Pass(message: string): void;
    abstract Exception(message: unknown): void;
}

export class ConsoleLogger implements ILogger {
    Error(message: string): void {
        console.trace(`${this.GetPrefix()} [ERROR] ${message}`);
    }

    Pass(message: string): void {
        console.log(`${this.GetPrefix()} [PASS] ${message}`);
    }

    Exception(message: unknown): void {
        console.trace(`${this.GetPrefix()} [EXCEPTION] ${message}`);
    }

    Info(message: string): void {
        console.log(`${this.GetPrefix()} [INFO] ${message}`);
    }

    private GetTimestamp(): string {
        const date = new Date();

        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    private GetPrefix(): string {
        const char = "=";
        const [indent, location] = this.GetStackInfo();

        return `[${this.GetTimestamp()} at ${location}] ${char.repeat(indent)}>`;

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
    
    static InitLoggers(...loggers: ILogger[]) {
        Error.stackTraceLimit = Infinity;
        LoggerAggregator.loggers = loggers;
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

    static Exception(message: unknown): void {
        LoggerAggregator.loggers.forEach(logger => logger.Exception(message));
    }
}