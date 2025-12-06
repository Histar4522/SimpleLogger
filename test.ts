import * as simplelogger from "./simplelogger.js";
import {DefaultExitMessage} from "./simplelogger.js";

const logger = simplelogger.default.create({
    writeToFile: true,
    recordMillisecond: true,
});

for (let i = 0; i < 120; i++) {
    logger.log("CYCLE", i)
}
logger.fatal("test fatal");
logger.fatal("test fatal");
logger.fatal("test fatal");

logger.setExitMessage({
    reason: "fatalErrorTest",
    detail: new Error("Fatal Error Message Test"),
});

process.exit(1);