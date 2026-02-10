import { Server, manifest, prerendered, base_path } from 'SERVER';

interface Env {
  ASSETS: BindingAssets;
  [key: string]: any;
}

const server = new Server(manifest);

const app_path = `/${manifest.appPath}`;
const immutable = `${app_path}/immutable/`;
const version_file = `${app_path}/version.json`;

// Shim caches API (not available in OpenWorkers)
if (typeof caches === 'undefined') {
  const noopCache: Cache = {
    match: async () => undefined,
    put: async () => {},
    delete: async () => false
  } as any;

  (globalThis as any).caches = {
    default: noopCache,
    open: async () => noopCache
  };
}

let origin: string;

const initialized = server.init({
  env: (globalThis.env ?? {}) as Env,
  read: async (file: string) => {
    const url = `${origin}/${file}`;
    const response = await (globalThis.env as Env).ASSETS.fetch(url);

    if (!response.ok) {
      throw new Error(`read(...) failed: could not fetch ${url} (${response.status} ${response.statusText})`);
    }

    return response.body!;
  }
});

const worker: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Expose env globally for SvelteKit
    globalThis.env = env;

    // Fix protocol when behind a reverse proxy (e.g. Cloudflare)
    const proto = req.headers.get('x-forwarded-proto');
    if (proto && !req.url.startsWith(proto)) {
      req = new Request(req.url.replace(/^http:/, `${proto}:`), req);
    }

    if (!origin) {
      origin = new URL(req.url).origin;
    }

    await initialized;

    let { pathname } = new URL(req.url);

    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      // ignore invalid URI
    }

    const stripped_pathname = pathname.replace(/\/$/, '');

    // Check if this is a static asset
    let is_static_asset = false;
    const filename = stripped_pathname.slice(base_path.length + 1);

    if (filename) {
      is_static_asset =
        manifest.assets.has(filename) ||
        manifest.assets.has(filename + '/index.html') ||
        filename in manifest._.server_assets ||
        filename + '/index.html' in manifest._.server_assets;
    }

    // Serve static assets and prerendered pages via ASSETS binding
    if (is_static_asset || prerendered.has(pathname) || pathname === version_file || pathname.startsWith(immutable)) {
      // For prerendered HTML pages, rewrite URL to .html file
      if (prerendered.has(pathname) && !pathname.includes('.')) {
        const htmlPath = pathname === '/' ? '/index.html' : `${pathname}.html`;
        return env.ASSETS.fetch(htmlPath);
      }

      return env.ASSETS.fetch(req);
    }

    // Trailing slash redirect for prerendered pages
    let location = pathname.at(-1) === '/' ? stripped_pathname : pathname + '/';

    if (location && prerendered.has(location)) {
      const search = new URL(req.url).search;
      if (search) location += search;

      return new Response('', {
        status: 308,
        headers: { location }
      });
    }

    // SSR for dynamic routes
    return server.respond(req, {
      platform: { env, ctx },
      getClientAddress() {
        return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '';
      }
    });
  }
};

export default worker;
