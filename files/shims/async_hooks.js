/**
 * Minimal AsyncLocalStorage shim for OpenWorkers.
 *
 * OpenWorkers creates a fresh V8 context per request.
 * Module-level state is already isolated, so no real async tracking is needed.
 */

export class AsyncLocalStorage {
	#store;

	run(store, fn, ...args) {
		this.#store = store;
		return fn(...args);
	}

	getStore() {
		return this.#store;
	}

	// Stubs for API completeness
	enterWith(store) {
		this.#store = store;
	}

	exit(fn, ...args) {
		this.#store = undefined;
		return fn(...args);
	}

	disable() {
		this.#store = undefined;
	}

	static bind(fn) {
		return fn;
	}

	static snapshot() {
		return (fn, ...args) => fn(...args);
	}
}
