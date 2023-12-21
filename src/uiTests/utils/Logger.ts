export interface ILogger {
    Info(message: string): void;
    Error(message: unknown): void;
    Pass(message: string): void;
    Exception(message: unknown): void;
    Step(label: string, fn: () => Promise<void>): Promise<void>;
}

export class ConsoleLogger implements ILogger {
    private indent: number = 0;
    private get GetPrefix() {
        const date = new Date();

        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    Error(message: string): void {
        console.trace(`[${this.GetPrefix}]${" ".repeat(this.indent)} [ERROR] ${message}`);
    }
    Pass(message: string): void {
        console.log(`[${this.GetPrefix}]${" ".repeat(this.indent)} [PASS] ${message}`);
    }
    Exception(message: unknown): void {
        console.trace(`[${this.GetPrefix}]${" ".repeat(this.indent)} [EXCEPTION] ${message}`);
    }
    Info(message: string): void {
        console.log(`[${this.GetPrefix}]${" ".repeat(this.indent)} [INFO] ${message}`);
    }
    async Step(label: string, fn: () => Promise<void>): Promise<void> {
        const charsLength = Math.max(Math.floor((process.stdout.columns - (label.length + 4)) / 2), 0);
        const char = "=";

        console.log(`${char.repeat(charsLength)} ${label} ${char.repeat(charsLength)}`);
        this.indent += 4;
        try {
            await fn();
        } catch (e) {
            this.Exception(e);
            throw e;
        } finally {
            this.indent -= 4;
            console.log("\n");
        }
    }
}

export class LoggerAggregator implements ILogger {
    private loggers: ILogger[];
    
    constructor(loggers: ILogger[]) {
        this.loggers = loggers;
    }

    Info(message: string): void {
        this.loggers.forEach(logger => logger.Info(message));
    }
    Error(message: unknown): void {
        this.loggers.forEach(logger => logger.Error(message));
    }
    Pass(message: string): void {
        this.loggers.forEach(logger => logger.Pass(message));
    }
    Exception(message: unknown): void {
        this.loggers.forEach(logger => logger.Exception(message));
    }
    async Step(label: string, fn: () => Promise<void>): Promise<void> {
        for (const logger of this.loggers) {
            await logger.Step(label, fn);
        }
    }
}