/**
 * Mini-worker template for OpenWorkers Functions.
 * Lightweight wrapper that provides cookies, locals, and other SvelteKit features.
 */

import * as handlers from 'ENDPOINT';

import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

interface Env {
  ASSETS?: BindingAssets;
  [key: string]: any;
}

const worker: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    globalThis.env = env as any;

    // Fix protocol when behind a reverse proxy (e.g. Cloudflare)
    const proto = req.headers.get('x-forwarded-proto');
    if (proto && !req.url.startsWith(proto)) {
      req = new Request(req.url.replace(/^http:/, `${proto}:`), req);
    }

    const method = req.method as keyof typeof handlers;
    const handler = handlers[method] as RequestHandler | undefined;

    if (!handler) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: Object.keys(handlers).join(', ') }
      });
    }

    const url = new URL(req.url);

    // Extract params using generated code (no runtime parser needed)
    let params = {};
    if (WITH_PARAMS) {
      const { extractParams } = await import('lib:routing');
      params = extractParams(url);
    }

    const responseHeaders = new Headers();

    let cookiesData: Awaited<ReturnType<typeof import('lib:cookies')['getCookies']>> | undefined;

    if (WITH_COOKIES) {
      const { getCookies } = await import('lib:cookies');
      cookiesData = getCookies(req, url);

      // CRITICAL: Initialize normalized_url so cookies.set() works
      cookiesData.set_trailing_slash('ignore');
    }

    const noopSpan = {} as RequestEvent['tracing']['root'];

    // Build a minimal RequestEvent-like object
    const event: RequestEvent = {
      fetch: globalThis.fetch.bind(globalThis),
      request: req,
      url,
      params,
      cookies: ((WITH_COOKIES && cookiesData?.cookies) || undefined)!,
      locals: {},
      platform: { env, ctx },
      route: { id: ROUTE_PATTERN },
      isDataRequest: false,
      isSubRequest: false,
      isRemoteRequest: false,
      tracing: { enabled: false, root: noopSpan, current: noopSpan },
      getClientAddress() {
        return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '';
      },
      setHeaders(headers: Record<string, string>) {
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders.set(key, String(value));
        }
      }
    };

    const resolve = async (resolvedEvent: RequestEvent): Promise<Response> => {
      const response = await handler(resolvedEvent);

      // Add cookies to response headers (SvelteKit's Set-Cookie)
      if (WITH_COOKIES && cookiesData?.new_cookies) {
        const { addCookiesToHeaders } = await import('lib:cookies');
        addCookiesToHeaders(response.headers, cookiesData.new_cookies.values());
      }

      // Merge custom headers into response
      for (const [key, value] of responseHeaders.entries()) {
        response.headers.append(key, value);
      }

      return response;
    };

    try {
      if (WITH_HOOKS) {
        const { handle } = await import('lib:hooks');
        return await handle({ event, resolve });
      } else {
        return await resolve(event);
      }
    } catch (error: any) {
      // SvelteKit Redirect (duck-typed to avoid duplicate class from bundling)
      if (error?.status >= 300 && error?.status < 400 && error?.location) {
        return new Response(null, {
          status: error.status,
          headers: { Location: error.location }
        });
      }

      // SvelteKit HttpError (duck-typed to avoid duplicate class from bundling)
      if (error?.status && error?.body) {
        return Response.json(error.body, {
          status: error.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.error(`[Function] Error in ${method} handler:`, error);

      return Response.json(
        { error: 'Internal Server Error' },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
};

export default worker;
