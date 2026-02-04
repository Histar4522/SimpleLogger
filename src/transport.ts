import {Logger, LogMessage} from "./logger.js";

/**
 * Interface representing a destination for log messages.
 */
export interface LoggerTransport {
    /**
     * Accepts a log message for processing.
     * @param message - The log message to accept.
     */
    accept(message: LogMessage): Promise<void>;

    /**
     * Accepts an error logger for internal error reporting within the transport.
     * @param errLogger - The logger to use for reporting errors.
     */
    acceptErrorLogger(errLogger: Logger): void;
}