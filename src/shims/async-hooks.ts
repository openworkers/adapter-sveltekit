/**
 * node:async_hooks for OpenWorkers. Runner 0.15.21 and later (runtime-v8
 * 0.15.19, wintertc 0.1.9) provide AsyncLocalStorage on AsyncContext, which
 * keeps the store across awaits and restores the previous one after run().
 */

export const AsyncLocalStorage = globalThis.AsyncLocalStorage;

export default { AsyncLocalStorage };
