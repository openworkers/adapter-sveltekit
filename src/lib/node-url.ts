/**
 * Minimal url shim for non-Node runtimes.
 * Stubs for packages that use bare 'url' instead of 'node:url'.
 */

export function pathToFileURL(p: string) { return new URL(`file://${p}`); }
export function fileURLToPath(u: string | URL) { return typeof u === 'string' ? u.replace('file://', '') : u.pathname; }

export default { pathToFileURL, fileURLToPath };
