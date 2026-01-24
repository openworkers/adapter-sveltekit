import { Server, manifest, prerendered, base_path } from 'SERVER';

/** @typedef {{ ASSETS: BindingAssets }} Env */

const server = new Server(manifest);

const app_path = `/${manifest.appPath}`;
const immutable = `${app_path}/immutable/`;
const version_file = `${app_path}/version.json`;

// Shim caches API (not available in OpenWorkers)
if (typeof caches === 'undefined') {
  /** @type {Cache} */
  const noopCache = /** @type {any} */ ({
    match: async () => undefined,
    put: async () => {},
    delete: async () => false
  });

  globalThis.caches = /** @type {any} */ ({
    default: noopCache,
    open: async () => noopCache
  });
}

/** @type {string} */
let origin;

const initialized = server.init({
  env: /** @type {Record<string, string>} */ (globalThis.env ?? {}),
  read: async (/** @type {string} */ file) => {
    const url = `${origin}/${file}`;
    const response = await /** @type {Env} */ (globalThis.env).ASSETS.fetch(url);

    if (!response.ok) {
      throw new Error(`read(...) failed: could not fetch ${url} (${response.status} ${response.statusText})`);
    }

    return response.body;
  }
});

/** @type {ExportedHandler<Env>} */
export default {
  async fetch(req, env, ctx) {
    // Expose env globally for SvelteKit
    globalThis.env = env;

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
