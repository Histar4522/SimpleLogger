import Logger from "./simplelogger.js";

const logger = Logger.create({writeToFile: true}).getSubLogger("GENERAL");

logger.log("hello, this is a log")
logger.error("hello, this is an error")
logger.warn("hello, this is a warning")
logger.debug("hello, this is a debug")
logger.getSubLogger("OBJECT").log({key: "value", number: 1145, obj: {this: "is", nested: ["object", "!"]}});
logger.getParentLogger().error(new Error("test error!"))