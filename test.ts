import Logger from "./simplelogger.js";

/**
 * Calculates C = A * B for two random N x N matrices.
 * Complexity: O(N^3). Stresses CPU floating-point arithmetic and memory.
 * @param N The dimension of the square matrices.
 * @returns The resulting value of C[0][0].
 */
function heavyMatrixMultiply(N: number): string {
    const A: bigint[][] = [];
    const B: bigint[][] = [];
    const C: bigint[][] = [];

    for (let i = 0; i < N; i++) {
        A[i] = [];
        B[i] = [];
        C[i] = new Array<bigint>(N).fill(0n);

        for (let j = 0; j < N; j++) {
            A[i][j] = randomBigInt(100);
            B[i][j] = randomBigInt(100);
        }
    }

    // Perform C = A * B
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            let sum = 0n;
            for (let k = 0; k < N; k++) {
                sum += A[i][k] * B[k][j];
            }
            C[i][j] = sum;
        }
    }

    let value = 0n

    C.forEach(e => {
        e.forEach(l => {
            value ^= l;
        });
    });

    return String(value);
}

const digits = "0123456789";

function randomBigInt(digit: number): bigint {
    let value = ""
    for (let i = 0; i < digit; i++) {
        value += digits.charAt(Math.floor(Math.random() * 10));
    }
    return BigInt(value);
}

const logger = Logger.create({writeToFile: true, recordMillisecond: true}).getSubLogger("GENERAL");

logger.log("hello, this is a log")
logger.error("hello, this is an error")
logger.warn("hello, this is a warning")
logger.debug("hello, this is a debug")
logger.getSubLogger("OBJECT").log({key: "value", number: 1145, obj: {this: "is", nested: ["object", "!"]}});
logger.getParentLogger().error(new Error("test error!"))

for (let i = 1; i < 100; i++) {
    logger.log(`${i}: ${heavyMatrixMultiply(128)}`);
    if (Math.random() < 0.05) {
        throw (() => {
            const err: any = new SyntaxError("This is A simple Error");
            err.reason = "This is a simple error reason";
            err.code = 113244;
            err.cause = new Error("Another simple error")
            return err;
        })();
    }
}


