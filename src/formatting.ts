import * as util from "node:util";
import {Predicate, UnionToIntersection} from "./helpers.js";

/**
 * A function responsible for transforming a specific input value into a string or an object
 * ready for inspection.
 *
 * @template T - The expected input type for this specific placeholder.
 * @param unformatted - The raw value passed to the {@link Formatter.render} method.
 * @returns A string representation or an object that will be processed by {@link util.inspect}.
 */
export type Replacer<T = unknown> = (unformatted: T) => string | unknown;

/**
 * A TypeScript assertion function used to validate and narrow the type of value at runtime.
 *
 * @template T - The type that the value is asserted to be.
 * @template From - The type of the input to validate
 * @param value - The unknown input to validate.
 * @throws {Error} Should throw an error with a descriptive message if validation fails.
 */
export type TypeChecker<T extends From, From = unknown> = (value: From) => asserts value is T;

/**
 * A mapper function that transforms a value.
 * @template T - The type of the input value.
 * @template U - The type of the output value.
 */
export type Mapper<T, U> = (value: T) => U;

/**
 * A default mapper that returns the input value as-is.
 */
export const VOID_MAPPER = <T>(value: T): T => value;

export interface FormatterFactoryLiteral {

    /**
     * Add a static string to the template.
     *
     * @param string static string to be added to the template
     */
    text(string: string): FormatterFactoryReplacer & FormatterFactoryLiteral;

    /**
     * Add a static string from inspecting an object to the template.
     * Inspection will be done immediately when the method is called.
     *
     * @param object object to be inspected
     */
    text(object: unknown): FormatterFactoryReplacer & FormatterFactoryLiteral;

    /**
     * Add an empty string to the template. Equivalent to calling `.text("")`
     */
    text(): FormatterFactoryReplacer & FormatterFactoryLiteral;

    /**
     * Finalize and construct the {@link Formatter}
     */
    build(): Formatter;
}

export interface FormatterFactoryReplacer<T = unknown> {
    /**
     * Completes the definition of a placeholder by inspecting the object.
     *
     * @returns The builder state for adding the next static text segment.
     */
    format(): FormatterFactoryLiteral & FormatterFactoryReplacer;

    /**
     * Completes the definition of a placeholder by providing a final transformation function.
     *
     * @param replacer - A function that takes the validated input and returns a string or object.
     * @returns The builder state for adding the next static text segment.
     */
    format(replacer: Replacer<T>): FormatterFactoryLiteral & FormatterFactoryReplacer;

    /**
     * Adds a custom runtime validation check and narrows the TypeScript type for
     * the current placeholder.
     *
     * Predefined checkers can be found at {@link TypeCheckers}
     *
     * This method "collapses" multiple checks into a single wrapper layer for performance.
     *
     * @template U - The new type the value will be narrowed to.
     * @param checker - An assertion function that validates the input.
     * @returns A new replacer state narrowed to type `U`.
     */
    check<U extends T>(checker: TypeChecker<U, T>): FormatterFactoryReplacer<U>;

    // map<U> (mapper: (value: T) => U): FormatterFactoryReplacer<U>;
}

/**
 * A compiled template capable of rendering values into a formatted string.
 *
 * Instances of this class are immutable and should be created via {@link Formatter.builder} or
 * {@link Formatter.buildJoin}. It ensures that the number of provided values matches the number
 * of placeholders defined during the building process.
 */
export class Formatter {
    private readonly literals: string[];
    private readonly replacers: Replacer[];

    private static readonly FN_REPLACE_KEEP: Replacer = (x: unknown): unknown => x;

    /** @internal */
    constructor(literals: string[], replacers: Replacer[]) {
        if (literals.length - 1 != replacers.length) {
            throw new Error("Illegal argument length");
        }
        this.literals = literals;
        this.replacers = replacers;
        Object.freeze(literals);
        Object.freeze(replacers);
    }

    /**
     * Renders the template by interleaving literals with the provided dynamic values.
     *
     * @param values - The values to be injected into the placeholders. Must match the
     * count and types defined in the builder.
     * @returns The final concatenated string.
     * @throws {Error} If the number of values is incorrect or if a {@link TypeChecker} fails.
     */
    render(...values: unknown[]): string {
        if (values.length != this.replacers.length) {
            throw new Error(`Not enough or excess parameters: require ${this.replacers.length} but received ${values.length}`)
        }

        let result = [this.literals[0]];
        for (let i = 0; i < this.replacers.length; i++) {
            let val;

            try {
                val = this.replacers[i](values[i])
            } catch (e) {
                throw new Error(`Error occurred while formatting argument ${i} with value ${inspectObject(values[i])}`, {cause: e});
            }

            result.push(typeof val === "string" ? val : inspectObject(val));
            result.push(this.literals[i + 1]);
        }
        return result.join();
    }

    /**
     * Initializes a new builder for creating a {@link Formatter}.
     *
     * The builder is by default immutable. A new instance will be created for every call of
     * {@link FormatterFactoryLiteral.text} and {@link FormatterFactoryReplacer.format}. You can add an optional
     * parameter `mutable` to change the state.
     *
     * @returns A builder instance that can start with either text or a value placeholder.
     */
    static builder(): FormatterFactoryLiteral & FormatterFactoryReplacer

    /**
     * Initializes a new fluent builder for creating a {@link Formatter}.
     *
     * @param mutable - Whether the instance created is mutable or immutable.
     * @returns A builder instance that can start with either text or a value placeholder.
     */
    static builder(mutable: boolean): FormatterFactoryLiteral & FormatterFactoryReplacer

    static builder(mutable?: boolean): FormatterFactoryLiteral & FormatterFactoryReplacer {
        return new FormatterBuilder(mutable ?? false);
    }

    /**
     * Create a simple formatter by inserting inspected objects in between.
     */
    static buildJoin(...pattern: string[]): Formatter {
        const compile: Replacer[] = [];
        for (let i = 0; i < pattern.length - 1; i++) {
            compile.push(Formatter.FN_REPLACE_KEEP);
        }
        return new Formatter(pattern, compile);
    }
}

/**
 * A predefined collections of {@link TypeChecker}.
 */
export const TypeCheckers = {
    /**l
     * Check whether the value provided is a number.
     */
    NUMBER: (value: unknown): asserts value is number => {
        if (typeof value !== "number") {
            throw new Error(`${inspectObject(value)} is not a number`)
        }
    },

    /**
     * Check whether the value provided is an integer.
     */
    INTEGER: (value: number): asserts value is number => {
        if (!Number.isInteger(value)) {
            throw new Error(`${inspectObject(value)} is not a integer`)
        }
    },

    /**
     * Check whether the value provided is a string.
     */
    STRING: (value: unknown): asserts value is string => {
        if (typeof value !== "string") {
            throw new Error(`${inspectObject(value)} is not a string`)
        }
    },

    /**
     * Check whether the value provided is a boolean.
     */
    BOOLEAN: (value: unknown): asserts value is boolean => {
        if (typeof value !== "boolean") {
            throw new Error(`${inspectObject(value)} is not a boolean`)
        }
    },

    /**
     * Check whether the value provided is a {@link Date}.
     */
    DATE: (value: unknown): asserts value is Date => {
        if (!(value instanceof Date)) {
            throw new Error(`${inspectObject(value)} is not a instance of Date`)
        }
    },

    /**
     * Check whether the value provided is a valid array.
     */
    ARRAY: (value: unknown): asserts value is unknown[] => {
        if (!Array.isArray(value)) {
            throw new Error(`${inspectObject(value)} is not a array`)
        }
    },

    /**
     * Check whether every entry of the array provided matches the provided {@link TypeChecker}.
     *
     * @param typeChecker - The type checker that is used to check every entry of the array.
     */
    EVERY_MATCH: <U extends T, T>(typeChecker: TypeChecker<U, T>): TypeChecker<U[], T[]> => {
        return (entries: T[]): asserts entries is U[] => {
            for (let i = 0; i < entries.length; i++){
                const entry = entries[i];
                try {
                    typeChecker(entry);
                } catch (e) {
                    throw new Error(`Entry ${i} in array does not pass the checker`, {
                        cause: e,
                    })
                }
            }
        }
    },

    /**
     * Check the validity of a string by a {@link RegExp}.
     *
     * @param regex - The {@link RegExp} used to check the string.
     */
    REGEX: (regex: RegExp): TypeChecker<string, string> => {
        return (value: string): asserts value is string => {
            if (!regex.test(value)) {
                throw new Error(`RegExp test failed for ${inspectObject(value)} with pattern ${inspectObject(regex)}`)
            }
        }
    },

    /**
     * Check the validity of a number by a range.
     *
     * @param min inclusive minimum value to be accepted.
     * @param max exclusive maximum value to be accepted.
     */
    RANGE: (min: number, max: number): TypeChecker<number, number> => {
        return (value: number): asserts value is number => {
            if (value >= max || value < min) {
                throw new Error(`${value} out of range of [${min}, ${max})`)
            }
        }
    },

    /**
     * Check whether the value provided exists. That is the value is neither `null` nor `undefined`.
     */
    NONNULL: <T>(value: T): asserts value is NonNullable<T> => {
        if (value === null || value === undefined) {
            throw new Error("Empty value")
        }
    },

    /**
     * Check whether the value is included in the collections.
     *
     * @param possibilities - The collection of all allowed values.
     */
    ENTRY_OF: <Arr extends readonly Orig[], Orig = unknown>(...possibilities: Arr): TypeChecker<Arr[number], Orig> => {
        return (value: Orig) => {
            for (const possibility of possibilities) {
                if (value === possibility) {
                    return;
                }
            }
            throw new Error(`Value ${inspectObject(value)} is unable to pass any of the provided values`)
        }
    },

    /**
     * Check whether the value passes any of the {@link TypeChecker}.
     *
     * @param checkers - The list of all checkers to be satisfied.
     */
    OR: <
        Orig,
        Checkers extends readonly TypeChecker<any, Orig>[],
        Target extends Orig = Checkers[number] extends TypeChecker<infer T, Orig> ? T : never
        >(...checkers: Checkers): TypeChecker<Target, Orig> => {
        return (value: Orig): asserts value is Target => {
            let errors: any[] = [];
            for (const checker of checkers) {
                try {
                    checker(value);
                    return;
                } catch (e) {
                    errors.push(e);
                }
            }
            throw new Error(`Value ${inspectObject(value)} is unable to pass any of the checkers`, {
                cause: errors,
            })
        }
    },

    /**
     * Check whether the value passes all of the {@link TypeChecker}.
     *
     * Under most circumstances chaining multiple {@link FormatterFactoryReplacer.check} would be clearer.
     *
     * @param checkers - The list of all checkers to be satisfied.
     */
    AND: <
        Orig,
        Checkers extends readonly TypeChecker<any, Orig>[],
        TargetRaw = UnionToIntersection<Checkers[number] extends TypeChecker<infer T extends Orig, Orig> ? T : never>,
        Target extends Orig = [TargetRaw] extends [never] ? never : TargetRaw & Orig
    >(...checkers: Checkers): TypeChecker<Target, Orig> => {
        return (value: Orig): asserts value is Target => {
            for (let i = 0; i < checkers.length; i++){
                const checker: TypeChecker<any, Orig> = checkers[i];
                try {
                    checker(value);
                } catch (e) {
                    throw new Error(`Value ${inspectObject(value)} failed to pass checker ${i}`, {
                        cause: e,
                    })
                }
            }

        }
    },

    FROM_PREDICATE: <T = unknown>(predicate: Predicate<T>, error?: unknown | ((value: T) => unknown)): TypeChecker<T, T> => {
        return (value: T): asserts value is T => {
            if (!predicate(value)) {
                if (typeof error == "function") {
                    throw new Error(`Value ${value} is unable to pass the predicate`, {
                        cause: error(value),
                    })
                } else if (typeof error == "string") {
                    throw new Error(`Value ${value} is unable to pass the predicate`, {
                        cause: new Error(error),
                    })
                } else {
                    throw new Error(`Value ${value} is unable to pass the predicate`, {
                        cause: error,
                    })
                }
            }
        }
    }
} as const;

const enum FormatFactoryElementType {
    LITERAL,
    REPLACER,
}

class FormatterBuilder implements FormatterFactoryLiteral, FormatterFactoryReplacer {

    private readonly sequence: FormatFactoryElementType[];
    private readonly literals: string[];
    private readonly replacers: Replacer[];
    private readonly mutable: boolean;

    /** @internal */
    constructor(mutable: boolean, literals?: string[], replacers?: Replacer[], sequence?: FormatFactoryElementType[]) {
        this.mutable = mutable;
        this.literals = literals ?? [];
        this.replacers = replacers ?? [];
        this.sequence = sequence ?? [];
    }
    check<U>(checker: TypeChecker<U>): FormatterFactoryReplacer<U> {
        return new FormatFactoryWrapper(this, checker);
    }

    build(): Formatter {
        let literals = [];
        let replacers = [];

        let iLiterals = 0;
        let iReplacers = 0;
        for (let i = 0; i < this.sequence.length; i++) {
            const currentState = this.sequence[i];
            const lastState = this.sequence[i-1];
            if (currentState == FormatFactoryElementType.REPLACER) {
                if (lastState == FormatFactoryElementType.REPLACER) {
                    literals.push("");
                } else if (lastState == undefined) {
                    literals.push("");
                }
                replacers.push(this.replacers[iReplacers]);
                iReplacers++;
            } else {
                if (lastState == FormatFactoryElementType.LITERAL) {
                    literals[literals.length - 1] += this.literals[iLiterals];
                } else {
                    literals.push(this.literals[iLiterals])
                }
                iLiterals++;
            }
        }
        if (this.sequence[this.sequence.length - 1] == FormatFactoryElementType.REPLACER) {
            literals.push("");
        }

        return new Formatter(literals, replacers);
    }

    format(): FormatterFactoryLiteral & FormatterFactoryReplacer
    format(replacer: Replacer): FormatterFactoryLiteral & FormatterFactoryReplacer
    format(replacer?: Replacer): FormatterFactoryLiteral & FormatterFactoryReplacer{
        if (this.mutable) {
            this.replacers.push(replacer ?? inspectObject);
            this.sequence.push(FormatFactoryElementType.REPLACER);
            return new FormatterBuilder(this.mutable, this.literals, this.replacers, this.sequence);
        } else {
            const replacers = [...this.replacers];
            const sequence = [...this.sequence];
            replacers.push(replacer ?? inspectObject);
            sequence.push(FormatFactoryElementType.REPLACER);
            return new FormatterBuilder(this.mutable, this.literals, replacers, sequence);
        }
    }

    text(): FormatterFactoryReplacer & FormatterFactoryLiteral
    text(string: string): FormatterFactoryReplacer & FormatterFactoryLiteral
    text(object: unknown): FormatterFactoryReplacer & FormatterFactoryLiteral
    text(object?: unknown): FormatterFactoryReplacer & FormatterFactoryLiteral {
        let string: string;
        if (object == undefined) {
            string = "";
        } else if (typeof object == "string") {
            string = object;
        } else {
            string = inspectObject(object);
        }
        if (this.mutable) {
            this.literals.push(string);
            this.sequence.push(FormatFactoryElementType.LITERAL);
            return new FormatterBuilder(this.mutable, this.literals, this.replacers, this.sequence);
        } else {
            const literals = [...this.literals];
            const sequence = [...this.sequence];
            literals.push(string);
            sequence.push(FormatFactoryElementType.LITERAL);
            return new FormatterBuilder(this.mutable, literals, this.replacers, sequence);
        }
    }
}

class FormatFactoryWrapper<T> implements FormatterFactoryReplacer<T> {
    private readonly factory: FormatterFactoryReplacer;
    private readonly checker: TypeChecker<T>;
    // private readonly mapper: Mapper<unknown, T>;

    constructor(factory: FormatterFactoryReplacer, checker: TypeChecker<T>) {
        this.factory = factory;
        this.checker = checker;
        // this.mapper = mapper;
    }

    // map<U>(mapper: (value: T) => U): FormatterFactoryReplacer<U> {
    //     throw new Error("Method not implemented.");
    // }

    format(): FormatterFactoryLiteral & FormatterFactoryReplacer
    format(replacer: Replacer<T>): FormatterFactoryLiteral & FormatterFactoryReplacer
    format(replacer?: Replacer<T>): FormatterFactoryLiteral & FormatterFactoryReplacer{
        return this.factory.format(
            value => {
                this.checker(value);
                return (replacer ?? inspectObject)(value)
            }
        )
    }

    check<U extends T>(checker: TypeChecker<U, T>): FormatterFactoryReplacer<U> {
        return new FormatFactoryWrapper(this.factory, value => {
            this.checker(value);
            checker(value);
        });
    }
}

function inspectObject(val: unknown): string {
    return util.inspect(val, {colors: false, compact: true});
}