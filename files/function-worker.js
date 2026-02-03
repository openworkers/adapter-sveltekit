/**
 * Mini-worker template for OpenWorkers Functions.
 * Wraps a SvelteKit API endpoint as a standalone worker.
 */

import * as handlers from 'ENDPOINT';

/**
 * Extract route params from URL pathname based on SvelteKit route pattern
 * @param {string} pathname - URL pathname (e.g., "/stream/42")
 * @param {string} pattern - SvelteKit route pattern (e.g., "/stream/[n]")
 * @returns {Record<string, string>} - Extracted params (e.g., {n: "42"})
 */
function extractParams(pathname, pattern) {
	const params = {};
	const patternSegments = pattern.split('/').filter(Boolean);
	const pathSegments = pathname.split('/').filter(Boolean);

	for (let i = 0; i < patternSegments.length; i++) {
		const patternSegment = patternSegments[i];

		// Rest parameter: [...rest]
		if (patternSegment.startsWith('[...') && patternSegment.endsWith(']')) {
			const paramName = patternSegment.slice(4, -1);
			params[paramName] = pathSegments.slice(i).join('/');
			break;
		}

		// Optional parameter: [[optional]]
		if (patternSegment.startsWith('[[') && patternSegment.endsWith(']]')) {
			const paramName = patternSegment.slice(2, -2);
			if (i < pathSegments.length) {
				params[paramName] = pathSegments[i];
			}
			continue;
		}

		// Regular parameter: [param]
		if (patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
			const paramName = patternSegment.slice(1, -1);
			params[paramName] = pathSegments[i];
			continue;
		}
	}

	return params;
}

export default {
	async fetch(req, env, ctx) {
		globalThis.env = env;

		const method = req.method;
		const handler = handlers[method];

		if (!handler) {
			return new Response('Method Not Allowed', {
				status: 405,
				headers: { Allow: Object.keys(handlers).join(', ') }
			});
		}

		const url = new URL(req.url);

		// Extract params from URL based on route pattern
		const params = extractParams(url.pathname, ROUTE_PATTERN);

		// Build a minimal RequestEvent-like object
		const event = {
			request: req,
			url,
			params,
			platform: { env, ctx },
			getClientAddress() {
				return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '';
			}
		};

		try {
			return await handler(event);
		} catch (error) {
			console.error(`[Function] Error in ${method} handler:`, error);

			return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}
};
