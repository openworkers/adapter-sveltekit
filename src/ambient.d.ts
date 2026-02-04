import type { SSRManifest } from '@sveltejs/kit';

declare module 'SERVER' {
  export const Server: typeof import('@sveltejs/kit').Server;
  export const manifest: SSRManifest;
  export const prerendered: Set<string>;
  export const base_path: string;
}

declare module 'MANIFEST' {
  export const manifest: SSRManifest;
  export const prerendered: Set<string>;
  export const base_path: string;
}

import type { RequestHandler } from '@openworkers/workers-types';

declare module 'ENDPOINT' {
  export const GET: RequestHandler;
  export const POST: RequestHandler;
  export const PUT: RequestHandler;
  export const PATCH: RequestHandler;
  export const DELETE: RequestHandler;
  export const OPTIONS: RequestHandler;
  export const HEAD: RequestHandler;
}

import type { Cookie } from '../node_modules/@sveltejs/kit/src/runtime/server/page/types.js';
import type { Cookies } from '@sveltejs/kit';

declare module 'lib:cookies' {
  export function getCookies(
    req: Request,
    url: URL
  ): {
    cookies: Cookies;
    new_cookies: Map<string, Cookie>;
    set_trailing_slash: (mode: 'ignore' | 'add' | 'remove') => void;
  };

  export function addCookiesToHeaders(headers: Headers, new_cookies: MapIterator<Cookie>): void;
}

declare module 'lib:routing' {
  export function extractParams(url: URL): Record<string, string>;
}

declare module 'sveltekit:routing' {
  export interface RouteParam {
    name: string;
    matcher?: string;
    optional: boolean;
    rest: boolean;
    chained: boolean;
  }

  export function parse_route_id(id: string): {
    pattern: RegExp;
    params: RouteParam[];
  };

  export function exec(
    match: RegExpExecArray,
    params: RouteParam[],
    matchers: Record<string, (value: string) => boolean>
  ): Record<string, string> | undefined;
}
