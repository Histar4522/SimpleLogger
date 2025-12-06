/**
 * Simple Logger is a simplified logger module that helps you create logs easily.
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
    FATAL: 3,
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
        case 3:
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
     * Whether logs should be exported to the console.
     *
     * Default Value: <code>true</code>
     */
    writeToConsole: boolean;

    /**
     * Whether logs should be exported to a file.
     *
     * Default Value: <code>false</code>
     */
    writeToFile: boolean;

    /**
     * The path of the file that the logs will be exported to.
     *
     * Any <code>%NOW%</code> will be replaced by the current type with format yyyy-mm-dd-hh-mm-ss
     *
     * Default Value: <code>./%NOW%.log</code>
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
     * by 4 spaces.
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
 * objects is converted to string as {@linkcode Error.stack} to show stack trace.
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
 *     at <anonymous> (test.ts:10:32)
 *     at ModuleJob.run (node:internal/modules/esm/module_job:377:25)
 *     at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:671:26)
 *     at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
 * ```
 *
 * If the program crashed, the error will be appended at the end of the file using the following format:
 *
 * ```txt
 * ================================================================================================
 *
 *     At Sun Nov 30 2025 09:57:13 GMT-0500 (Eastern Standard Time) (Epoch: 1764514633473)
 *
 *     Program crashed because of: unhandledRejection
 *
 *     Error: This is A simple Error
 *         at file:///test.js:57:15
 *         at ModuleJob.run (node:internal/modules/esm/module_job:377:25)
 *         at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:671:26)
 *         at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
 *
 * ================================================================================================
 * ```
 */
export interface ILogger {
    /**
     * Create a line of log with level INFO.
     */
    log(...data: any[]): void;

    /**
     * An alias for {@linkcode log}
     */
    info(...data: any[]): void;

    /**
     * Create a line of log with level ERROR.
     */
    error(...data: any[]): void;

    /**
     * An alias of {@linkcode error}
     */
    err(...data: any[]): void;

    /**
     * Create a line of log with level DEBUG.
     */
    debug(...data: any[]): void;

    /**
     * Create a line of log with level WARN.
     */
    warn(...data: any[]): void;

    /**
     * Create a line of log with level FATAL.
     */
    fatal(...data: any[]): void;

    /**
     * Create a sub logger that will automatically add a flag to indicate context.
     *
     * @param field - The flag that will be added.
     */
    getSubLogger(field: string): ILogger;

    /**
     * Get the parent logger from which the sub logger derived.
     *
     * If the logger itself is the root one, then it will be returned.
     */
    getParentLogger(): ILogger;

    /**
     * Write all logs to disk immediately.
     *
     * @see {@linkcode flushAsync} Asynchronous version
     */
    flushSync(): void;

    /**
     * Write all logs to disk immediately.
     *
     * @see {@linkcode flushAsync} Synchronous version
     */
    flushAsync(): Promise<void>;

    /**
     * Set a custom exit message that will be appended to the end of the program.
     *
     * When this is set, the default one will not be shown.
     */
    setExitMessage(message?: ExitMessage): void;

    /**
     * Clear the exit message that has been set.
     */
    clearExitMessage(): void;
}

/**
 * An entry for {@linkcode ExitMessage}.
 *
 * When it is T, the value will be used;
 *
 * When it is a function, you can gain access to the default value. You may return a processes value or nothing as adopt
 * the default value.
 */
export type ExitMessageContent<T> = T | ((defaultMessage: DefaultExitMessage) => T | undefined);

/**
 * An exit message. When any of the entries  is undefined, the default value of it will be used.
 */
export interface ExitMessage {
    /**
     * The type of exit. Will be shown at 'The program ________ because of: xxxx'
     *
     * Default: <code>undefined</code> (Use default value)
     */
    exitType?: "crashed" | "terminated" | "exited" | "ended" | string;

    /**
     * The reason of exit. Will be shown at 'The program exited because of: ________'
     *
     * Default: <code>undefined</code> (Use default value)
     */
    reason?: ExitMessageContent<string>;

    /**
     * Further information about why the program exit.
     *
     * Default: <code>undefined</code> (Use default value)
     */
    detail?: ExitMessageContent<any>;
}

/**
 * A default exit message.
 */
export interface DefaultExitMessage {
    /**
     * The type of exit. Will be shown at 'The program ________ because of: xxxx'
     */
    exitType: "crashed" | "terminated" | "exited" | "ended" | string;

    /**
     * The reason of exit. Will be shown at 'The program exited because of: ________'
     */
    reason: string;

    /**
     * Further information about why the program exit.
     *
     * Will be shown at the bottom of the message.
     */
    detail?: any;
}

function renderExitMessage(defaultMessage: DefaultExitMessage, customMessage?: ExitMessage): string {
    const exitType = customMessage?.exitType ?? defaultMessage.exitType;

    let reason: string;
    const reasonContent = customMessage?.reason;
    if (typeof reasonContent === "string") {
        reason = reasonContent;
    } else if (typeof reasonContent === "function") {
        reason = reasonContent(defaultMessage) ?? defaultMessage.reason;
    } else {
        reason = defaultMessage.reason;
    }

    let detail: any;
    const detailContent = customMessage?.detail;
    if (typeof detailContent === "function") {
        detail = detailContent(defaultMessage) ?? defaultMessage.detail;
    } else if (detailContent !== undefined) {
        detail = detailContent;
    } else {
        detail = defaultMessage.detail;
    }

    const renderedDetail = detail === undefined ? "" : util.inspect(detail, {colors: false})
        .replace(/\r?\n/g, "\n    ");

    return `

================================================================================================

    At ${new Date().toString()} (Epoch: ${Date.now()})

    Program ${exitType} because of: ${reason}

    ${renderedDetail}

================================================================================================
`;
}

class WriteHelper {
    private readonly path: string;
    private temporaryStorage: string[] = [""];
    private readonly flushSize = 64;
    private isWriting: boolean = false;
    private customExitMessage?: ExitMessage;

    constructor(path_: string) {
        this.path = path_.replace(/%NOW%/g, getFormattedTime(false, true));
        fs.mkdirSync(path.dirname(this.path), {recursive: true});
        fs.writeFileSync(this.path, "");
        this.registerExitCallbacks();
        this.flush()
    }

    setCustomExitMessage(exitMessage?: ExitMessage){
        this.customExitMessage = exitMessage
    }

    write(content: string) {
        this.temporaryStorage.push(content);
        if (this.temporaryStorage.length >= this.flushSize && !this.isWriting) {
            this.flush();
        }
    }

    flush(): void {
        this.flushAsync().then(() => {});
    }

    async flushAsync() {
        this.isWriting = true;
        const storage = this.temporaryStorage;
        this.temporaryStorage = [];
        try {
            await fs.promises.appendFile(this.path, storage.join(""))
        } catch (err) {
            console.error(`[${getFormattedTime(true)}][ERROR][LOGGER] Failed to flush buffer inside logger.`);
            console.error(`[${getFormattedTime(true)}][ERROR][LOGGER] ${util.inspect(err, {colors: false})}`);
            storage.push(...this.temporaryStorage);
            this.temporaryStorage = storage;
        } finally {
            this.isWriting = false;
        }
    }

    flushSync() {
        this.isWriting = true;
        const storage = this.temporaryStorage;
        this.temporaryStorage = [];
        try {
            fs.appendFileSync(this.path, storage.join(""));
        } catch (err) {
            console.error(`[${getFormattedTime(true)}][ERROR][LOGGER] Failed to flush buffer inside logger.`);
            console.error(`[${getFormattedTime(true)}][ERROR][LOGGER] ${util.inspect(err, {colors: false})}`);
        }
        this.isWriting = false
    }

    private registerExitCallbacks() {
        process.on('exit', () => {
            if (this.customExitMessage) {
                this.write(renderExitMessage({
                    exitType: "exited",
                    reason: "unknown",
                }, this.customExitMessage));
            }
            this.flushSync();
        });
        process.on('SIGINT', () => {
            this.write(renderExitMessage({
                exitType: "exited",
                reason: "SIGINT",
                detail: "Program terminated by Ctrl+C",
            }, this.customExitMessage));
            this.flushSync();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            this.flushSync();
            this.write(renderExitMessage({
                exitType: "exited",
                reason: "SIGTERM",
            }, this.customExitMessage));
            process.exit(0);
        });
        process.on('uncaughtException', (err, type) => {
            const exitMessage = renderExitMessage({
                exitType: "crashed",
                reason: type,
                detail: err,
            }, this.customExitMessage);
            console.error(exitMessage);
            this.write(exitMessage);
            this.flushSync();
            process.exit(1);
        });
        process.on('uncaughtRejection', (err) => {
            const exitMessage = renderExitMessage({
                exitType: "crashed",
                reason: "_uncaughtRejection",
                detail: err,
            }, this.customExitMessage);
            console.error(exitMessage);
            this.write(exitMessage);
            this.flushSync();
            process.exit(1);
        });
    }
}

class Logger implements ILogger {
    private readonly writeToConsole: boolean;
    private readonly writeToFile: boolean;
    private readonly path: string;
    private readonly writeHelper?: WriteHelper;
    private readonly doMillisecond: boolean;
    private readonly logLevelConsole: number;
    private readonly logLevelFile: number;
    private readonly organizeMultilineInput: boolean;

    constructor(options?: Partial<LoggerOptions>) {
        const options0 = options ?? {};
        this.doMillisecond = options0.recordMillisecond ?? false;
        this.writeToConsole = options0.writeToConsole ?? true;
        this.writeToFile = options0.writeToFile ?? false;
        this.logLevelFile = options0.filtering?.file ?? LogLevels.DEBUG;
        this.logLevelConsole = options0.filtering?.console ?? LogLevels.DEBUG;
        this.organizeMultilineInput = options0.organizeMultilineInput ?? true;
        this.path = options0.path ? path.resolve(options0.path) :
            path.join(".", "%NOW%.log");
        if (this.writeToFile) {
            this.writeHelper = new WriteHelper(this.path);
        }
    }

    flushSync(): void {
        if (this.writeToFile) {
            this.writeHelper?.flushSync();
        }
    }
    async flushAsync(): Promise<void> {
        if (this.writeToFile) {
            await this.writeHelper?.flushAsync();
        }
    }
    setExitMessage(message?: ExitMessage): void {
        this.writeHelper?.setCustomExitMessage(message);
    }
    clearExitMessage(): void {
        this.setExitMessage();
    }

    getSubLogger(field: string): ILogger {
        return new NestedLogger(this, field);
    }

    getParentLogger(): ILogger {
        return this;
    }

    private getLogEntry(...data: any[]): string {
        let formattedLog = `[${getFormattedTime(this.doMillisecond)}]`;
        for (let entry of data.slice(0, -1)) {
            formattedLog += `[${entry}]`
        }
        const lastEntry = data[data.length - 1];
        if (lastEntry instanceof Error) {
            formattedLog += ` ${lastEntry.stack}`
        } else if (typeof lastEntry === "string") {
            let entry = lastEntry;
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
            this.writeHelper?.write(`${entry}\n`);
        }
    }

    private record(levelOfLog: LogLevel, ...data: any[]): void {
        this.recordEntry(this.getLogEntry(getLevelName(levelOfLog), ...data), getLogMethod(levelOfLog), levelOfLog);
    }

    log(...data: any[]) {
        this.record(LogLevels.INFO, ...data);
    }

    info(...data: any[]) {
        this.log(...data)
    }

    error(...data: any[]) {
        this.record(LogLevels.ERROR, ...data);
    }

    err(...data: any[]) {
        this.error(...data)
    }

    debug(...data: any[]) {
        this.record(LogLevels.DEBUG, ...data);
    }

    warn(...data: any[]) {
        this.record(LogLevels.WARN, ...data);
    }

    fatal(...data: any[]) {
        this.record(LogLevels.FATAL, ...data);
    }
}

class NestedLogger implements ILogger {
    private readonly logger: ILogger;
    private readonly field: string;

    constructor(logger: ILogger, field: string) {
        this.field = field;
        this.logger = logger;
    }

    flushSync(): void {
        this.logger.flushSync();
    }
    async flushAsync(): Promise<void> {
        await this.logger.flushAsync()
    }
    setExitMessage(message?: ExitMessage): void {
        this.logger.setExitMessage(message)
    }
    clearExitMessage(): void {
        this.logger.clearExitMessage();
    }

    getSubLogger(field: string): ILogger {
        return new NestedLogger(this, field);
    }

    getParentLogger(): ILogger {
        return this.logger;
    }

    debug(...data: any[]): void {
        this.logger.debug(this.field, ...data);
    }

    error(...data: any[]): void {
        this.logger.error(this.field, ...data);
    }

    err(...data: any[]) {
        this.error(...data)
    }

    log(...data: any[]): void {
        this.logger.log(this.field, ...data);
    }

    info(...data: any[]): void {
        this.log(...data)
    }

    warn(...data: any[]): void {
        this.logger.warn(this.field, ...data);
    }

    fatal(...data: any[]): void {
        this.logger.fatal(this.field, ...data);
    }
}

export default {
    /**
     * Create a new {@linkcode ILogger} instance.
     *
     * Note that this function may invoke a synchronous write to filesystem.
     */
    create: (options?: Partial<LoggerOptions>): ILogger => {
        return new Logger(options);
    },

    /**
     * The asynchronous version of {@linkcode default.create}
     */
    createAsync: async (options?: Partial<LoggerOptions>): Promise<ILogger> => {
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                try {
                    resolve(new Logger(options));
                } catch (err) {
                    reject(err)
                }
            })
        });
    },
}
