/**
 * Mini-worker template for OpenWorkers Functions.
 * Wraps a SvelteKit API endpoint as a standalone worker.
 */

import * as handlers from 'ENDPOINT';

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

		// Build a minimal RequestEvent-like object
		const event = {
			request: req,
			url,
			params: ctx.params ?? {},
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
