/**
 * Minimal fs shim for non-Node runtimes.
 * Stubs for packages that use bare 'fs' instead of 'node:fs'.
 */

export function existsSync() { return false; }
export function readFileSync() { return ''; }

export default { existsSync, readFileSync };
