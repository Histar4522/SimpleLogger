/**
 * Simple logger is a simplified logger module that could help you create log in ease.
 *
 * To start using it, create a logger with {@linkcode default.create}.
 *
 * @see {@linkcode default.create}
 * @see {@linkcode ILogger}
 *
 * @module simplelogger
 * @author HepaticSteatosis
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";

function getFormattedTime(doMillisecond?: boolean, noSpace?: boolean): string {
    const dateObject = new Date();
    const year = dateObject.getFullYear().toString();
    const month = (dateObject.getMonth() + 1).toString().padStart(2, "0");
    const day = dateObject.getDate().toString().padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const hour = dateObject.getHours().toString().padStart(2, "0");
    const minute = dateObject.getMinutes().toString().padStart(2, "0");
    const second = dateObject.getSeconds().toString().padStart(2, "0");
    const millisecond = doMillisecond ?
        dateObject.getMilliseconds().toString().padStart(3, "0") : "";
    const time = noSpace ? `${hour}-${minute}-${second}${doMillisecond ? "-" : ""}${millisecond}`
        : `${hour}:${minute}:${second}${doMillisecond ? ":" : ""}${millisecond}`;
    return `${date}${noSpace ? "-" : " "}${time}`;
}

/**
 * Constants that represents the level of logs.
 */
export const LogLevels = {
    DEBUG: -1,
    INFO: 0,
    WARN: 1,
    ERROR: 2,
} as const;

function getLevelName(level: LogLevel): string {
    const name = Object.keys(LogLevels).find(key => LogLevels[key as keyof typeof LogLevels] === level);
    return name ?? "UNKNOWN";
}

function getLogMethod(level: LogLevel): ((...data: any[]) => void) {
    switch (level) {
        case -1:
            return console.debug;
        case 0:
            return console.log;
        case 1:
            return console.warn;
        case 2:
            return console.error;
        default:
            return console.log;
    }
}

function organizeString(input: string) {
    return input.replace(/\r?\n/g, '\n    ');

}

/**
 * The log filtering policy.
 *
 * See it's fields for more information.
 */
export interface LogFilteringPolicy {
    /**
     * The minimum level of log that would be shown on console.
     *
     * Should be one of the {@linkcode LogLevels}
     *
     * Default Value: {@linkcode LogLevels.DEBUG}
     */
    console: LogLevel;

    /**
     * The minimum level of log that would be written to file.
     *
     * Should be one of the {@linkcode LogLevels}
     *
     * Default Value: {@linkcode LogLevels.DEBUG}
     */
    file: LogLevel;
}

/**
 * Type that represents the level of log.
 *
 * Value should be one of the {@linkcode LogLevels}
 */
export type LogLevel = typeof LogLevels[keyof typeof LogLevels]

/**
 * The config options for creating an {@linkcode ILogger} instance
 */
export interface LoggerOptions {
    /**
     * Whether the log should be exported to console.
     *
     * Default Value: <code>true</code>
     */
    writeToConsole: boolean;

    /**
     * Whether the log should be exported to a file.
     *
     * Default Value: <code>false</code>
     */
    writeToFile: boolean;

    /**
     * The path of the file that the log are going to be exported to.
     *
     * Default Value: <code>./yyyy-mm-dd-hh-mm-ss.log</code>
     */
    path: string;

    /**
     * Whether each line of log should show milliseconds.
     *
     * Default Value: <code>false</code>
     */
    recordMillisecond: boolean;

    /**
     * The log filtering policy.
     *
     * @see {@linkcode LogFilteringPolicy}
     */
    filtering: Partial<LogFilteringPolicy>;

    /**
     * Whether input with multi lines should be organized to the format that each line after the first one is retracted
     * by 4 spaces
     *
     * Default Value: <code>true</code>
     */
    organizeMultilineInput: boolean;
}

/**
 * A Logger instance. Call any of the {@linkcode log}, {@linkcode warn}, {@linkcode error}, {@linkcode debug} to write
 * a line of log.
 *
 * To create a ILogger instance, call {@linkcode default.create}. This method may invoke a synchronous filesystem write
 * call to create a log file.
 *
 * Note that every method accepts any amount of parameters. Only the last parameter will be recorded as log, and the
 * rest will be considered as context flags and surrounded by <code>[]</code>.
 *
 * Objects and Errors is treated differently: {@linkcode util.inspect} is called on an object to stringify it; error
 * objects is converted to string using as {@linkcode Error.stack} to show stack trace.
 *
 * Call {@linkcode getSubLogger} to create another instance of ILogger, where context flags will be added automatically.
 *
 * Examples:
 * ```typescript
 * const logger = Logger.create({writeToFile: true}).getSubLogger("GENERAL");
 * logger.log("hello, this is a log");
 * logger.error("hello, this is an error");
 * logger.warn("hello, this is a warning");
 * logger.debug("hello, this is a debug");
 * logger.getSubLogger("OBJECT").log({key: "value", number: 1145, obj: {this: "is", nested: ["object", "!"]}});
 * logger.getParentLogger().error(new Error("test error!"));
 * ```
 *
 * Logs Exported:
 * ```log
 * [2025-11-29 16:08:37][INFO][GENERAL] hello, this is a log
 * [2025-11-29 16:08:37][ERROR][GENERAL] hello, this is an error
 * [2025-11-29 16:08:37][DEBUG][GENERAL] hello, this is a debug
 * [2025-11-29 16:08:37][WARN][GENERAL] hello, this is a warning
 * [2025-11-29 16:08:37][INFO][GENERAL][OBJECT] { key: 'value', number: 1145, obj: { this: 'is', nested: [ 'object', '!' ] } }
 * [2025-11-29 16:08:37][ERROR] Error: test error!
 *     at <anonymous> (W:\Workspaces\WebStormWorkspaces\SimpleLogger\test.ts:10:32)
 *     at ModuleJob.run (node:internal/modules/esm/module_job:377:25)
 *     at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:671:26)
 *     at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
 * ```
 */
export interface ILogger {
    /**
     * Create a line of log with level INFO.
     */
    log(...strings: any[]): void;

    /**
     * Create a line of log with level ERROR.
     */
    error(...strings: any[]): void;

    /**
     * Create a line of log with level DEBUG.
     */
    debug(...strings: any[]): void;

    /**
     * Create a line of log with level WARN.
     */
    warn(...strings: any[]): void;

    /**
     * Create a sub logger that will automatically add a flag to indicate context.
     *
     * @param field - The flag that will be added
     */
    getSubLogger(field: string): ILogger;

    /**
     * Get the parent logger from which the sub logger derived.
     *
     * If the logger itself is the root one, then itself will be returned.
     */
    getParentLogger(): ILogger;
}

class Logger implements ILogger {
    private readonly writeToConsole: boolean;
    private readonly writeToFile: boolean;
    private readonly path: string;
    private readonly doMillisecond: boolean;
    private readonly logLevelConsole: number;
    private readonly logLevelFile: number;
    private readonly organizeMultilineInput: boolean;

    constructor(options: Partial<LoggerOptions>) {
        this.doMillisecond = options.recordMillisecond ?? false;
        this.writeToConsole = options.writeToConsole ?? true;
        this.writeToFile = options.writeToFile ?? false;
        this.logLevelFile = options.filtering?.file ?? LogLevels.DEBUG;
        this.logLevelConsole = options.filtering?.console ?? LogLevels.DEBUG;
        this.organizeMultilineInput = options.organizeMultilineInput ?? true;
        this.path = options.path ? path.resolve(options.path) :
            path.join(".", `${getFormattedTime(false, true)}.log`);
        if (this.writeToFile) {
            fs.writeFileSync(this.path, "");
        }
    }

    getSubLogger(field: string): ILogger {
        return new NestedLogger(this, field);
    }

    getParentLogger(): ILogger {
        return this;
    }

    private getLogEntry(...strings: any[]): string {
        let formattedLog = `[${getFormattedTime(this.doMillisecond)}]`
        for (let entry of strings.slice(0, -1)) {
            formattedLog += `[${entry}]`
        }
        const lastEntry = strings[strings.length - 1];
        if (lastEntry instanceof Error) {
            formattedLog += ` ${lastEntry.stack}`
        } else if (typeof lastEntry === "string") {
            let entry = lastEntry
            if (this.organizeMultilineInput) {
                entry = organizeString(entry);
            }
            formattedLog += ` ${entry}`
        } else {
            formattedLog += ` ${util.inspect(lastEntry, {colors: false, compact: true})}`
        }
        return formattedLog;
    }

    private recordEntry(entry: string, method: ((arg0: string) => void), levelOfLog: LogLevel): void {
        if (this.writeToConsole && levelOfLog >= this.logLevelConsole) {
            method(entry);
        }
        if (this.writeToFile && levelOfLog >= this.logLevelFile) {
            fs.promises.appendFile(this.path, `${entry}\n`).catch(err => {
                console.error(this.getLogEntry("ERROR", "LOGGER", "Unable to write to file"));
                console.error(this.getLogEntry("ERROR", "LOGGER", err));
            });
        }
    }

    private record(levelOfLog: LogLevel, ...strings: any[]): void {
        this.recordEntry(this.getLogEntry(getLevelName(levelOfLog), ...strings), getLogMethod(levelOfLog), levelOfLog);
    }

    log(...strings: any[]) {
        this.record(LogLevels.INFO, ...strings);
    }

    error(...strings: any[]) {
        this.record(LogLevels.ERROR, ...strings);
    }

    debug(...strings: any[]) {
        this.record(LogLevels.DEBUG, ...strings);
    }

    warn(...strings: any[]) {
        this.record(LogLevels.WARN, ...strings);
    }

}

class NestedLogger implements ILogger {
    private readonly logger: ILogger;
    private readonly field: string;

    constructor(logger: ILogger, field: string) {
        this.field = field;
        this.logger = logger;
    }

    getSubLogger(field: string): ILogger {
        return new NestedLogger(this, field);
    }

    getParentLogger(): ILogger {
        return this.logger;
    }

    debug(...strings: any[]): void {
        this.logger.debug(this.field, ...strings);
    }

    error(...strings: any[]): void {
        this.logger.error(this.field, ...strings);
    }

    log(...strings: any[]): void {
        this.logger.log(this.field, ...strings);
    }

    warn(...strings: any[]): void {
        this.logger.warn(this.field, ...strings);
    }
}

export default {
    /**
     * Create a new {@linkcode ILogger} instance.
     *
     * Note that this function may invoke a synchronous write to filesystem.
     */
    create: (options: Partial<LoggerOptions>): ILogger => {
        return new Logger(options);
    },
}
