import * as simplelogger from "./simplelogger.js";
import {DefaultExitMessage} from "./simplelogger.js";

const logger = simplelogger.default.create({
    writeToFile: true,
    recordMillisecond: true,
});

logger.setExitMessage({
    reason: "fatalError",
    detail: "WTF",
});

throw new Error("FUCK");