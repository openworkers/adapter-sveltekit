import { afterAll, describe, expect, test } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dir, '..');
const fixtures = path.join(import.meta.dir, 'fixtures');
const previousEnv = globalThis.env;
const previousStorage = globalThis.AsyncLocalStorage;

afterAll(() => {
  globalThis.env = previousEnv;
  globalThis.AsyncLocalStorage = previousStorage;
});

for (const kit of ['kit2', 'kit3']) {
  describe(kit, () => {
    for (const base of ['', '/prefix']) {
      test(`build and serve with base ${JSON.stringify(base)}`, async () => {
        const cwd = path.join(fixtures, kit);
        const functions = kit === 'kit3' && base !== '';
        for (const dir of ['src', 'static']) {
          rmSync(path.join(cwd, dir), { recursive: true, force: true });
          cpSync(path.join(fixtures, 'app', dir), path.join(cwd, dir), { recursive: true });
        }
        const vite =
          kit === 'kit3'
            ? path.join(cwd, 'node_modules/vite/bin/vite.js')
            : path.join(root, 'node_modules/vite/bin/vite.js');
        const child = Bun.spawn(['node', vite, 'build'], {
          cwd,
          env: { ...process.env, TEST_BASE: base, TEST_FUNCTIONS: String(functions) },
          stdout: 'pipe',
          stderr: 'pipe'
        });
        const [stdout, stderr, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited
        ]);
        expect(code, stdout + stderr).toBe(0);
        const warning = 'functions: true is not supported with SvelteKit 3; generating a single worker.';
        expect((stdout + stderr).includes(warning)).toBe(functions);
        const output = path.join(cwd, 'build');
        expect(readFileSync(path.join(output, '_worker.js'), 'utf8')).not.toContain('import.meta.dirname');
        expect(existsSync(path.join(output, 'functions'))).toBe(false);
        const routes = JSON.parse(readFileSync(path.join(output, '_routes.json'), 'utf8'));
        expect(routes.functions).toEqual([]);
        expect(routes.prerendered).toContain(`${base}/static-page/`);
        expect(routes.prerendered).toContain(`${base}/sitemap.xml`);
        expect(routes.static).toEqual([`${base}/hello.txt`]);
        expect(routes.immutable).toEqual([`${base}/_app/immutable/*`]);
        // The runner serves storage routes with the request path as the storage key
        for (const pattern of [...routes.static, ...routes.immutable.map((p: string) => p.slice(0, -2))]) {
          expect(existsSync(path.join(output, 'assets', pattern)), pattern).toBe(true);
        }

        globalThis.AsyncLocalStorage = AsyncLocalStorage;
        const assetRequests: string[] = [];
        const env = {
          TEST_BINDING: 'binding-ok',
          ASSETS: {
            async fetch(input: Request | string) {
              const url = new URL(typeof input === 'string' ? input : input.url, 'https://app.test');
              assetRequests.push(url.pathname);
              const file = path.join(output, 'assets', url.pathname);
              return existsSync(file)
                ? new Response(await Bun.file(file).arrayBuffer())
                : new Response('missing asset', { status: 404 });
            }
          }
        };
        globalThis.env = env as typeof globalThis.env;
        const workerPath = path.join(output, base ? '_worker-prefix.js' : '_worker-root.js');
        cpSync(path.join(output, '_worker.js'), workerPath);
        const worker = (await import(pathToFileURL(workerPath).href)).default;
        const call = (pathname: string, init?: RequestInit) =>
          worker.fetch(new Request(`https://app.test${base}${pathname}`, init), env, {
            waitUntil() {}
          }) as Promise<Response>;
        const ssr = await call('/');
        expect(ssr.status).toBe(200);
        expect(await ssr.text()).toContain('SSR hook-ok binding-ok');
        const api = await call('/api');
        expect(api.status).toBe(200);
        expect(api.headers.get('set-cookie')).toContain('api=ok');
        expect(await api.json()).toEqual({ marker: 'hook-ok', path: `${base}/api` });
        const action = await call('/', {
          method: 'POST',
          headers: { origin: 'https://app.test' },
          body: new URLSearchParams({ message: 'action-ok' })
        });
        expect(action.status).toBe(200);
        expect(action.headers.get('set-cookie')).toContain('session=saved');
        expect(await action.text()).toContain('action-ok');
        const stream = await call('/stream');
        expect(await stream.text()).toBe('first\nsecond\n');
        const read = await call('/read');
        expect(read.status).toBe(200);
        expect(await read.text()).toBe('server asset\n');
        const data = await call('/__data.json');
        expect(data.status).toBe(200);
        expect(await data.text()).toContain('hook-ok');
        const prerendered = await call('/static-page/');
        expect(prerendered.status).toBe(200);
        expect(await prerendered.text()).toContain('Prerendered page');
        const redirect = await call('/static-page?hello=world');
        expect(redirect.status).toBe(308);
        expect(redirect.headers.get('location')).toBe(`${base}/static-page/?hello=world`);
        const asset = await call('/hello.txt');
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe('static asset\n');
        expect(assetRequests).toContain(`${base}/static-page/index.html`);
        const sitemap = await call('/sitemap.xml');
        expect(sitemap.status).toBe(200);
        expect(await sitemap.text()).toBe('<urlset/>');
        const oldPage = await call('/old-page');
        expect(oldPage.status).toBe(200);
        expect(await oldPage.text()).toContain('url=static-page/');
        const version = await call('/_app/version.json');
        expect(version.status).toBe(200);
        expect(await version.json()).toHaveProperty('version');
        const missing = await call('/not-found');
        expect(missing.status).toBe(404);
      }, 30000);
    }
  });
}
