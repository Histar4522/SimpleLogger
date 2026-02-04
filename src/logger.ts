import {LoggerTransport} from "./transport.js";

/**
 * Enum representing different log levels.
 */
export enum LogLevel {
    /** Detailed debug information. */
    Debug = "debug",
    /** General information about program execution. */
    Info = "info",
    /** Potential issues that don't stop the program. */
    Warning = "warning",
    /** Error that might allow the program to continue. */
    Error = "error",
    /** Severe error that leads to program termination. */
    Fatal = "fatal",
}

/**
 * Interface representing a log message.
 */
export interface LogMessage {
    /** The severity level of the log message. */
    level: LogLevel,
    /** The actual message being logged. */
    message: unknown,
    /** The timestamp when the message was logged. */
    timestamp: number,
    /** Additional context associated with the log message. */
    context: unknown[],
}

/**
 * Interface for rendering log messages.
 */
export interface MessageRenderer {
    /**
     * Renders a log message into a string.
     * @param message - The log message to render.
     * @returns The rendered string.
     */
    render(message: LogMessage): string;

    /**
     * Consumes an error logger for internal error reporting.
     * @param errLogger - The logger to use for reporting errors.
     */
    consumeErrorLogger(errLogger: Logger): void;
}

/**
 * Main logger class for recording messages at various levels.
 */
export class Logger {

    private readonly transports: LoggerTransport[];

    /**
     * Creates a new Logger instance.
     * @param transports - Transports to which log messages will be sent.
     */
    constructor(...transports: LoggerTransport[]) {
        this.transports = transports;
    }

    /**
     * Logs a message at a specific level.
     * @param level - The log level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    log(level: LogLevel, message: unknown, ...context: unknown[]): void {
        const packedMessage: LogMessage = {
            level, message, context, timestamp: Date.now()
        };
        for (const transport of this.transports) {
            transport.accept(packedMessage);
        }
    }

    /**
     * Logs a message at the Debug level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    debug(message: unknown, ...context: unknown[]): void {
        this.log(LogLevel.Debug, message, ...context);
    }

    /**
     * Logs a message at the Info level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    info(message: unknown, ...context: unknown[]): void{
        this.log(LogLevel.Info, message, ...context);
    }

    /**
     * Logs a message at the Warning level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    warning(message: unknown, ...context: unknown[]): void {
        this.log(LogLevel.Warning, message, ...context);
    }

    /**
     * Logs a message at the Error level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    error(message: unknown, ...context: unknown[]): void {
        this.log(LogLevel.Error, message, ...context);
    }

    /**
     * Logs a message at the Fatal level.
     * @param message - The message to log.
     * @param context - Additional context.
     */
    fatal(message: unknown, ...context: unknown[]): void {
        this.log(LogLevel.Fatal, message, ...context);
    }
}