/**
 * Minimal AsyncLocalStorage shim for OpenWorkers.
 *
 * OpenWorkers creates a fresh V8 context per request.
 * Module-level state is already isolated, so no real async tracking is needed.
 */

export class AsyncLocalStorage<T = any> {
  #store: T | undefined;

  run<R>(store: T, fn: (...args: any[]) => R, ...args: any[]): R {
    this.#store = store;
    return fn(...args);
  }

  getStore(): T | undefined {
    return this.#store;
  }

  // Stubs for API completeness
  enterWith(store: T): void {
    this.#store = store;
  }

  exit<R>(fn: (...args: any[]) => R, ...args: any[]): R {
    this.#store = undefined;
    return fn(...args);
  }

  disable(): void {
    this.#store = undefined;
  }

  static bind<T extends (...args: any[]) => any>(fn: T): T {
    return fn;
  }

  static snapshot(): <R>(fn: (...args: any[]) => R, ...args: any[]) => R {
    return (fn, ...args) => fn(...args);
  }
}
