import { Server, manifest } from 'SERVER';
import '../shims/caches.js';

interface Env {
  ASSETS: BindingAssets;
  [key: string]: any;
}

const server = new Server(manifest);

let origin: string;

const initialized = server.init({
  env: (globalThis.env ?? {}) as Env,
  read: async (file: string) => {
    const url = `${origin}/${file}`;
    const response = await globalThis.env.ASSETS.fetch(url);

    if (!response.ok) {
      throw new Error(`read(...) failed: could not fetch ${url} (${response.status} ${response.statusText})`);
    }

    return response.body!;
  }
});

const worker: ExportedHandler<Env> = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Fix protocol when behind a reverse proxy (e.g. Cloudflare)
    const proto = req.headers.get('x-forwarded-proto');

    if (proto && !req.url.startsWith(proto)) {
      req = new Request(req.url.replace(/^http:/, `${proto}:`), req);
    }

    if (!origin) {
      origin = new URL(req.url).origin;
    }

    await initialized;

    return server.respond(req, {
      platform: { env, ctx },
      getClientAddress() {
        return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '';
      }
    });
  }
};

export default worker;
