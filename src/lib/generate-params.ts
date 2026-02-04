/**
 * Generate a module that wraps SvelteKit's routing utilities
 * Reuses parseRouteId() and exec() instead of reimplementing
 */

import { parseRouteId } from './routing.js';

/**
 * Generate a module that exports an extractParams function
 * Uses SvelteKit's routing utilities under the hood
 */
export function generateParamsModule(routePattern: string): string {
  // Use SvelteKit's parser to get pattern and params
  const { pattern, params } = parseRouteId(routePattern);

  // Generate module that reuses SvelteKit's exec function
  return `import { exec } from 'sveltekit:routing';

const pattern = ${pattern};
const params = ${JSON.stringify(params)};

export function extractParams(url) {
  const match = pattern.exec(url.pathname);
  if (!match) return {};
  return exec(match, params, {}) || {};
}`;
}
