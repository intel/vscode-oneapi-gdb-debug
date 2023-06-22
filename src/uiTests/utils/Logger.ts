export interface ILogger {
    Info(message: string): void;
    Error(message: unknown): void;
    Pass(message: string): void;
    Exception(message: unknown): void;
}

export class ConsoleLogger implements ILogger {
    private get GetPrefix() {
        const date = new Date();

        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    Error(message: string): void {
        console.trace(`[${this.GetPrefix}] [ERROR] ${message}`);
    }
    Pass(message: string): void {
        console.log(`[${this.GetPrefix}] [PASS] ${message}`);
    }
    Exception(message: unknown): void {
        console.trace(`[${this.GetPrefix}] [EXCEPTION] ${message}`);
    }
    Info(message: string): void {
        console.log(`[${this.GetPrefix}] [INFO] ${message}`);
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
}