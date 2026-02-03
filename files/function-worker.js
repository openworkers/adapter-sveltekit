/**
 * Mini-worker template for OpenWorkers Functions.
 * Lightweight wrapper that provides cookies, locals, and other SvelteKit features.
 */

import * as handlers from 'ENDPOINT';
import { parse, serialize } from 'cookie';

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

/**
 * Create a cookies object using the cookie library (same as SvelteKit)
 */
function createCookies(req, url, responseHeaders) {
  const header = req.headers.get('cookie') || '';
  const initial_cookies = parse(header);

  const defaults = {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.hostname === 'localhost' && url.protocol === 'http:' ? false : true
  };

  return {
    get(name, opts) {
      const cookies = parse(header, { decode: opts?.decode });
      return cookies[name];
    },
    getAll(opts) {
      const cookies = parse(header, { decode: opts?.decode });
      return Object.entries(cookies).map(([name, value]) => ({ name, value }));
    },
    set(name, value, opts) {
      if (opts?.path === undefined) {
        throw new Error('You must specify a `path` when setting cookies');
      }
      const cookie = serialize(name, value, { ...defaults, ...opts });
      responseHeaders.append('Set-Cookie', cookie);
    },
    delete(name, opts) {
      if (opts?.path === undefined) {
        throw new Error('You must specify a `path` when deleting cookies');
      }
      const cookie = serialize(name, '', { ...defaults, ...opts, maxAge: 0 });
      responseHeaders.append('Set-Cookie', cookie);
    },
    serialize(name, value, opts) {
      if (opts?.path === undefined) {
        throw new Error('You must specify a `path` when serializing cookies');
      }
      return serialize(name, value, { ...defaults, ...opts });
    }
  };
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
    const responseHeaders = new Headers();

    // Build a minimal RequestEvent-like object
    const event = {
      request: req,
      url,
      params,
      cookies: createCookies(req, url, responseHeaders),
      locals: {},
      platform: { env, ctx },
      getClientAddress() {
        return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '';
      },
      setHeaders(headers) {
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders.set(key, value);
        }
      }
    };

    try {
      const response = await handler(event);

      // Merge Set-Cookie and custom headers into response
      for (const [key, value] of responseHeaders.entries()) {
        response.headers.append(key, value);
      }

      return response;
    } catch (error) {
      console.error(`[Function] Error in ${method} handler:`, error);

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
