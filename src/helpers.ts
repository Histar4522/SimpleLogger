import * as util from "node:util";

/**
 * Converts a union type to an intersection type.
 * @template U - The union type to convert.
 */
export type UnionToIntersection<U> =
    (U extends any ? (x: U) => void : never) extends
        (x: infer I) => void ? I : never;

/**
 * Ensures a type is not `never`.
 * @template T - The type to check.
 */
export type NonNever<T> = [T] extends [never] ?  never : T;

/**
 * A function that returns a boolean based on the input value.
 * @template T - The type of the value to check.
 */
export type Predicate<T> = (value: T) => boolean;

/**
 * A placeholder for code that is still in progress.
 * @throws {Error} Always throws an "In progress" error.
 */
export function todo(): never {
    throw new Error("In progress")
}

/**
 * Logs the object to the console with a stack trace for debugging purposes.
 * @template T - The type of the object.
 * @param obj - The object to log.
 * @returns The original object.
 */
export function dbg<T>(obj: T): T {
    console.trace(`[DBG] ${util.inspect(obj)}`);
    return obj;
}

/**
 * A result type representing either success with a value or failure with an error.
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 */
export interface Result<T, E = unknown> {
    /** Whether the result is a success. */
    readonly success: boolean;

    /**
     * Unwraps the result, returning the value if successful or throwing the error if not.
     */
    unwrap(): T;

    /**
     * Unwraps the result, returning the value if successful or throwing the provided error if not.
     * @param message - The error message to throw if the result is a failure.
     */
    expect(message: string): T;

    /**
     * Returns the success value or the provided default value.
     * @param defaultValue - The value to return if the result is a failure.
     */
    unwrapElse(defaultValue: T): T;

    /**
     * Returns the success value or undefined.
     */
    getVal(): Undefinable<T>;

    /**
     * Returns the error value or undefined.
     */
    getErr(): Undefinable<E>;

    /**
     * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained `Ok` value.
     * @template U - The type of the new success value.
     * @param f - The function to apply to the success value.
     */
    map<U>(f: (value: T) => U): Result<U, E>;
}

class OkImpl<T, E> implements Result<T, E> {
    readonly success = true;

    constructor(private readonly value: T) {}

    unwrap(): T {
        return this.value;
    }

    expect(_message: string): T {
        return this.value;
    }

    unwrapElse(_defaultValue: T): T {
        return this.value;
    }

    getVal(): Undefinable<T> {
        return this.value;
    }

    getErr(): Undefinable<E> {
        return undefined;
    }

    map<U>(f: (value: T) => U): Result<U, E> {
        return new OkImpl<U, E>(f(this.value));
    }
}

class ErrImpl<T, E> implements Result<T, E> {
    readonly success = false;

    constructor(private readonly error: E) {}

    unwrap(): T {
        throw this.error;
    }

    expect(message: string): T {
        throw new Error(`${message}: ${util.inspect(this.error)}`);
    }

    unwrapElse(defaultValue: T): T {
        return defaultValue;
    }

    getVal(): Undefinable<T> {
        return undefined;
    }

    getErr(): Undefinable<E> {
        return this.error;
    }

    map<U>(_f: (value: T) => U): Result<U, E> {
        return new ErrImpl<U, E>(this.error);
    }
}

/**
 * Creates a successful result.
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 * @param value - The success value.
 */
export function Ok<T, E>(value: T): Result<T, E>
/**
 * Creates a successful result with no value.
 * @template E - The type of the error value.
 */
export function Ok<E>(): Result<undefined, E>
export function Ok<T, E>(value?: T): Result<T, E> {
    return new OkImpl(value as T);
}

/**
 * Creates a failed result.
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 * @param error - The error value.
 */
export function Err<T, E>(error: E): Result<T, E>
/**
 * Creates a failed result with no error value.
 * @template T - The type of the success value.
 */
export function Err<T>(): Result<T, undefined>
export function Err<T, E>(error?: E): Result<T, E> {
    return new ErrImpl(error as E);
}

/**
 * Asserts that a value is neither null nor undefined.
 * @template T - The type of the value.
 * @param value - The value to check.
 * @throws {Error} If the value is null or undefined.
 * @returns The non-null, non-undefined value.
 */
export function assertNonnull<T>(value: T): NonNullable<T> {
    if (value !== null && value !== undefined) {
        return value;
    } else {
        throw new Error("NonNullable assertion failed");
    }
}

/**
 * Represents a value that can be undefined.
 */
export type Undefinable<T> = T | undefined;

/**
 * Represents a value that can be null.
 */
export type Nullable<T> = T | null;

/**
 * Collects all values from an iterator or iterable into an array.
 * @template T - The type of values.
 * @param iter - The iterator or iterable to collect from.
 * @returns An array containing all collected values.
 */
export function collect<T>(iter: Iterator<T> | Iterable<T>): T[] {
    let it: Iterator<T>;
    const collection: T[] = [];
    if (Symbol.iterator in iter) {
        it = iter[Symbol.iterator]();
    } else {
        it = iter;
    }
    while (true) {
        const next = it.next();
        if (!next.done) {
            collection.push(next.value);
        } else {
            break;
        }
    }
    return collection;
}