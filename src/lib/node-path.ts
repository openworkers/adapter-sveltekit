/**
 * Minimal path shim for non-Node runtimes.
 * Stubs for packages that use bare 'path' instead of 'node:path'.
 */

export const sep = '/';
export function dirname(p: string) { return p.replace(/\/[^/]*$/, '') || '/'; }
export function join(...parts: string[]) { return parts.join('/').replace(/\/+/g, '/'); }
export function resolve(...parts: string[]) { return join(...parts); }
export function relative(_from: string, _to: string) { return _to; }
export function isAbsolute(p: string) { return p.startsWith('/'); }

export default { sep, dirname, join, resolve, relative, isAbsolute };
