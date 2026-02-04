import {randomUUID, UUID} from "node:crypto";
import {assertNonnull, Err, Nullable, Ok, Predicate, Result} from "./helpers.js";

/**
 * Manages event registration, firing, and callback lifecycle.
 *
 * The `EventSchema` should be an object type where:
 * - Each key is a string representing the event name.
 * - Each value is an array of types representing the arguments passed to callbacks.
 *
 * @example
 * ```ts
 * type MyEvents = {
 *   "onLogin": [username: string, timestamp: number],
 *   "onLogout": [username: string],
 *   "onServerStart": [config: Record<string, unknown>],
 *   "onServerClose": [],
 * };
 * const eventBus = new EventBus<MyEvents>();
 * ```
 *
 * @template EventSchema - The schema defining available events and their callback arguments.
 * @template EventKey - A union of string keys from the EventSchema.
 */
export class EventBus<
        EventSchema extends Record<string, unknown[]> = AnyEvent,
        EventKey extends string = Extract<keyof EventSchema, string>>
    {
    private readonly scopes: Record<string, ScopeEntry<EventSchema, EventKey>>;
    private readonly events: Record<string, EventMetadata>;
    private readonly handlers: { [K in string]: HandlerList<EventSchema[K]> };
    private readonly registrations: Record<UUID, HandlerRef>;

    constructor() {
        this.scopes = Object.create(null);
        this.events = Object.create(null);
        this.handlers = Object.create(null);
        this.registrations = Object.create(null);
    }

    /**
     * Creates a new event that can be listened to.
     * @param name The name of the event.
     * @param allowAsync Whether the event supports asynchronous callbacks.
     */
    define(name: EventKey, allowAsync?: boolean) {
        if (name in this.events) {
            throw new Error(`Event '${name}' already exist`);
        }
        const metadata: EventMetadata = {
            name: name,
            allowAsync: allowAsync ?? false,
        };
        this.events[name] = metadata;
        this.handlers[name] = {
            property: metadata,
            callbacks: []
        };
    };

    /**
     * Registers a synchronous callback for an event.
     * @param name The name of the event.
     * @param callback The callback function to execute.
     * @returns A unique identifier for the registered callback.
     */
    onSync<Name extends EventKey>(name: Name, callback: SyncCallback<EventSchema[Name]>): UUID
    /** @internal */
    onSync<Name extends EventKey>(name: Name, callback: SyncCallback<EventSchema[Name]>, scopeId: string): UUID
    onSync<Name extends EventKey>(name: Name, callback: SyncCallback<EventSchema[Name]>, scopeId?: string): UUID {
        if (name in this.events) {
            const uuid: UUID = randomUUID();
            const callbackWrapped: EventCallbackSync<EventSchema[Name]> = {
                async: false,
                identifier: uuid,
                call: callback,
            };
            const eventCallbackList = assertNonnull(this.handlers[name as string]);
            this.registrations[uuid] = {
                eventName: name,
                index: eventCallbackList.callbacks.length,
                scopeId: scopeId ?? "",
            };
            (eventCallbackList.callbacks as any[]).push(callbackWrapped);
            return uuid;
        } else {
            throw new Error(`Registering sync callbacks to unknown event '${name}'`);
        }
    }

    /**
     * Registers an asynchronous callback for an event.
     * @param name The name of the event.
     * @param callback The asynchronous callback function to execute.
     * @returns A unique identifier for the registered callback.
     */
    onAsync<Name extends EventKey>(name: Name, callback: AsyncCallback<EventSchema[Name]>): UUID
    /** @internal */
    onAsync<Name extends EventKey>(name: Name, callback: AsyncCallback<EventSchema[Name]>, scopeId: string): UUID
    onAsync<Name extends EventKey>(name: Name, callback: AsyncCallback<EventSchema[Name]>, scopeId?: string): UUID {
        if (name in this.events) {
            if (!this.events[name]?.allowAsync) {
                throw new Error(`Registering async callbacks to '${name}' that does not allow async callbacks`);
            }
            const uuid: UUID = randomUUID();
            const callbackWrapped: EventCallbackAsync<EventSchema[Name]> = {
                async: true,
                identifier: uuid,
                call: callback,
            };
            const eventCallbackList = assertNonnull(this.handlers[name as string]);
            this.registrations[uuid] = {
                eventName: name,
                index: eventCallbackList.callbacks.length,
                scopeId: scopeId ?? "",
            };
            (eventCallbackList.callbacks as any[]).push(callbackWrapped);
            return uuid;
        } else {
            throw new Error(`Registering async callbacks to unknown event '${name}'`);
        }
    }

    /**
     * Retrieves information about a registered callback.
     * @param identifier The unique identifier of the callback.
     * @internal
     */
    getCallbackInfo(identifier: UUID): { eventName: string, scopeId: string } {
        const entry = this.registrations[identifier];
        if (entry) {
            const {eventName, index, scopeId} = entry;
            const eventCallbackList = assertNonnull(this.handlers[eventName as string]);
            if (eventCallbackList.callbacks[index]) {
                return {eventName, scopeId};
            }
        }
        throw new Error(`Callback with id '${identifier}' not found`);
    }

    /**
     * Deletes a registered callback.
     * @param identifier The unique identifier of the callback to delete.
     */
    off(identifier: UUID) {
        const entry = this.registrations[identifier];
        if (entry) {
            const {eventName, index} = entry;
            const eventCallbackList = assertNonnull(this.handlers[eventName as string]);
            eventCallbackList.callbacks[index] = null;
        } else {
            throw new Error(`Callback with id '${identifier}' not found`);
        }
    }

    /**
     * Fires a synchronous event, executing all registered callbacks.
     * @param name The name of the event.
     * @param args The arguments to pass to the callbacks.
     */
    emit<Name extends string = EventKey>(name: Name, ...args: EventSchema[Name]): void {
        const eventInfo = this.events[name as string];
        if (eventInfo) {
            if (eventInfo.allowAsync) {
                throw new Error(`Cannot synchronously fire event '${name}' which allows async callback`);
            }
        } else {
            throw new Error(`Event '${name}' not found`);
        }
        const eventCallbackList = assertNonnull(this.handlers[name as string]);
        for (const eventElement of eventCallbackList.callbacks) {
            eventElement?.call(...args);
        }
    }

    /**
     * Fires an asynchronous event, executing all registered callbacks sequentially.
     * @param name The name of the event.
     * @param args The arguments to pass to the callbacks.
     */
    async emitAsync<Name extends string= EventKey>(name: Name, ...args: EventSchema[Name]): Promise<void> {
        const eventInfo = this.events[name as string];
        if (!eventInfo) {
            throw new Error(`Event '${name}' not found`);
        }
        const eventCallbackList = assertNonnull(this.handlers[name as string]);
        for (const eventElement of eventCallbackList.callbacks) {
            await eventElement?.call(...args);
        }
    }

    /**
     * Returns a list of all registered events and their properties.
     */
    listEvents(): EventMetadata[] {
        return Object.values(this.events);
    }

    /**
     * Returns a list of all registered callbacks and their properties.
     */
    listCallbacks(filter?: Predicate<RegistrationInfo>): RegistrationInfo[] {
        let info: RegistrationInfo[] = [];
        for (const callbackId in this.registrations) {
            let callbackLocation = this.registrations[callbackId as UUID];
            info.push({
                UUID: callbackId as UUID,
                scopeId: callbackLocation.scopeId,
                eventName: callbackLocation.eventName,
            })
        }
        return filter ? info.filter(filter) : info;
    }

    /**
     * Freezes a callback scope, preventing further callback registrations or deletions.
     * @param name The unique identifier of the callback scope.
     */
    freezeScope(name: string): void {
        const entry = this.scopes[name];
        if (!entry) {
            throw new Error(`Cannot freeze callback scope '${name}' because it does not exist`);
        }
        entry.frozen = true;
    }

    /**
     * Unfreezes a callback scope.
     * @param name The unique identifier of the callback scope.
     */
    unfreezeScope(name: string): void {
        const entry = this.scopes[name];
        if (!entry) {
            throw new Error(`Cannot unfreeze callback scope '${name}' because it does not exist`);
        }
        entry.frozen = false;
    }

    /**
     * Checks if a callback scope is frozen.
     * @param name The unique identifier of the callback scope.
     */
    isFrozen(name: string): boolean {
        const entry = this.scopes[name];
        if (!entry) {
            throw new Error(`Callback scope '${name}' does not exist`);
        }
        return entry.frozen;
    }

    /**
     * Creates a new EventScope instance for a specific component or module.
     * @param scopeId A unique identifier for the scope (e.g., component name).
     */
    scope(scopeId: string): EventScope<EventSchema, EventKey> {
        if (scopeId.length === 0) {
            throw new Error(`Scope ID must not be empty because it is reserved to indicate callbacks registered directly on the bus`);
        }
        if (!scopeId.match(/^\w+$/)) {
            throw new Error(`Scope ID must only contain lower, upper case letters, numbers and underscore`);
        }
        if (scopeId in this.scopes) {
            throw new Error(`Event scope with ID '${scopeId}' has already been created`);
        }

        const manager = new EventScopeImpl<EventSchema, EventKey>(this, scopeId);
        this.scopes[scopeId] = {
            instance: manager,
            frozen: false
        };
        return manager;
    }
}

/**
 * A generic type representing an event schema with no restrictions on event names or argument types.
 */
export type AnyEvent = {
    [P in string]: unknown[]
}

/**
 * A generic type representing an event schema with restrictions on event names only.
 */
export type NamedEvents<Names extends string[]> = {
    [P in Names[number]]: unknown[]
}

/**
 * A synchronous callback function.
 * @template Args - The types of the arguments passed to the callback.
 */
export type SyncCallback<Args extends unknown[] = unknown[]> = (...args: Args) => void;

/**
 * An asynchronous callback function.
 * @template Args - The types of the arguments passed to the callback.
 */
export type AsyncCallback<Args extends unknown[] = unknown[]> = (...args: Args) => Promise<void>;

/**
 * A scope for registering and deleting callbacks for a specific component.
 */
export interface EventScope<
    EventSchema extends Record<string, unknown[]> = AnyEvent,
    EventKey extends string = Extract<keyof EventSchema, string>>
{
    /**
     * Checks if the callback scope is frozen.
     */
    isFrozen(): boolean;
    /**
     * Registers a synchronous callback for an event.
     * @param name The name of the event.
     * @param callback The callback function to execute.
     */
    onSync<Name extends EventKey>(name: Name, callback: SyncCallback<EventSchema[Name]>): Result<UUID>;
    /**
     * Registers an asynchronous callback for an event.
     * @param name The name of the event.
     * @param callback The asynchronous callback function to execute.
     */
    onAsync<Name extends EventKey>(name: Name, callback: AsyncCallback<EventSchema[Name]>): Result<UUID>;
    /**
     * Deletes a registered callback.
     * @param identifier The unique identifier of the callback to delete.
     */
    off(identifier: UUID): Result<void>;
    /**
     * Returns a list of all registered events and their properties.
     */
    listEvents(): EventMetadata[];
    /**
     * Returns a list of all registered callbacks through this scope.
     */
    listCallbacks(): RegistrationInfo[];
}

/**
 * Properties of an event.
 */
export interface EventMetadata {
    /** The name of the event. */
    name: string;
    /** Whether the event supports asynchronous callbacks. */
    allowAsync: boolean;
}

class EventScopeImpl<
    EventSchema extends Record<string, unknown[]> = AnyEvent,
    EventKey extends string = Extract<keyof EventSchema, string>>
    implements EventScope<EventSchema, EventKey>
{
    constructor(
        private readonly eventBus: EventBus<EventSchema, EventKey>,
        private readonly scopeId: string
    ) {
    }

    listCallbacks(filter?: Predicate<RegistrationInfo>): RegistrationInfo[] {
        let callbacks = this.eventBus.listCallbacks().filter(cb =>
            cb.scopeId == this.scopeId
        );
        return filter ? callbacks.filter(filter) : callbacks;
    }

    isFrozen(): boolean {
        return this.eventBus.isFrozen(this.scopeId);
    }

    off(identifier: UUID): Result<void> {
        if (this.isFrozen()) {
            return Err(new Error("This callback scope has already been frozen."));
        }
        try {
            const {scopeId} = this.eventBus.getCallbackInfo(identifier);
            if (scopeId !== this.scopeId) {
                return Err(new Error("Cannot delete a callback that is not registered using this scope"));
            }
            this.eventBus.off(identifier);
            return Ok();
        } catch (e) {
            return Err(e instanceof Error ? e : new Error(String(e)));
        }
    }

    listEvents(): EventMetadata[] {
        return this.eventBus.listEvents();
    }

    onAsync<Name extends EventKey>(name: Name, callback: AsyncCallback<EventSchema[Name]>): Result<UUID> {
        if (this.isFrozen()) {
            return Err(new Error("This callback scope has already been frozen."));
        }
        try {
            const uuid = this.eventBus.onAsync(name, callback, this.scopeId);
            return Ok(uuid);
        } catch (e) {
            return Err(e instanceof Error ? e : new Error(String(e)));
        }
    }

    onSync<Name extends EventKey>(name: Name, callback: SyncCallback<EventSchema[Name]>): Result<UUID> {
        if (this.isFrozen()) {
            return Err(new Error("This callback scope has already been frozen."));
        }
        try {
            const uuid = this.eventBus.onSync(name, callback, this.scopeId);
            return Ok(uuid);
        } catch (e) {
            return Err(e instanceof Error ? e : new Error(String(e)));
        }
    }
}

export interface RegistrationInfo {
    UUID: UUID,
    scopeId: string,
    eventName: string,
}

interface HandlerRef {
    eventName: string;
    index: number;
    scopeId: string;
}

interface ScopeEntry<
    EventSchema extends Record<string, unknown[]> = AnyEvent,
    EventKey extends string = Extract<keyof EventSchema, string>>
{
    instance: EventScope<EventSchema, EventKey>;
    frozen: boolean;
}

interface HandlerList<T extends unknown[]> {
    property: EventMetadata;
    callbacks: Nullable<EventCallback<T>>[];
}

type EventCallback<T extends unknown[]> = EventCallbackSync<T> | EventCallbackAsync<T>;

interface EventCallbackSync<T extends unknown[]> {
    async: false;
    identifier: UUID;
    call: SyncCallback<T>;
}

interface EventCallbackAsync<T extends unknown[]> {
    async: true;
    identifier: UUID;
    call: AsyncCallback<T>;
}
