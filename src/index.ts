import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, BuildOptions } from 'esbuild';
import type { Adapter, Builder } from '@sveltejs/kit';
import { buildFunctionWorker } from './adapter/build-function.js';

interface AdapterOptions {
  outDir?: string;
  functions?: boolean;
  nodeCompat?: boolean;
  debug?: {
    sourcemap?: boolean;
    prettier?: boolean;
    errors?: boolean;
  };
}

type Builder3 = Omit<Builder, 'config' | 'generateManifest'> & {
  config: { paths: { base: string } };
  manifest: { assets: Array<{ path: string }> };
  generateServerInstance(dest: string): void;
};

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const name = '@openworkers/adapter-sveltekit';
const version: string = pkg.version;

export default function (options: AdapterOptions = {}): Adapter {
  return {
    name,
    supports: {
      read: () => true
    },

    async adapt(builder: Builder | Builder3) {
      const dest = options.outDir ?? 'build';
      const assetsDir = `${dest}/assets`;
      const kit3 = 'generateServerInstance' in builder;
      const functionsEnabled = (options.functions ?? false) && !kit3;

      if (kit3 && options.functions) {
        builder.log.warn('functions: true is not supported with SvelteKit 3; generating a single worker.');
      }

      const nodeCompat = options.nodeCompat ?? false;
      const debug = options.debug ?? {};

      const files = fileURLToPath(new URL('.', import.meta.url).href);
      const tmp = builder.getBuildDirectory('openworkers-tmp');

      builder.rimraf(dest);
      builder.mkdirp(dest);
      builder.mkdirp(assetsDir);
      builder.mkdirp(tmp);

      const basePath = kit3 ? builder.config.paths.base : builder.config.kit.paths.base;

      // Assets are stored under the base path, so a request path is also its storage key
      const assetsBaseDir = `${assetsDir}${basePath}`;

      // Write client assets (returns list of files)
      const clientFiles = builder.writeClient(assetsBaseDir);

      // Write prerendered pages
      builder.writePrerendered(assetsBaseDir);

      // Separate static files from app files
      const appPath = builder.getAppPath();
      const appDir = appPath.slice(basePath.length);
      const staticFiles = clientFiles.filter((f) => !f.startsWith(`${appDir}/`));

      // Generate 404.html fallback
      const fallback = path.join(assetsDir, '404.html');

      if (!existsSync(fallback)) {
        writeFileSync(fallback, 'Not Found');
      }

      const entryPoint = `${tmp}/entry.js`;
      const serverPath = posixify(path.resolve(builder.getServerDirectory(), 'index.js'));
      const manifestPath = posixify(path.resolve(tmp, 'manifest.js'));
      let entry: string;

      if (kit3) {
        const generatedServer = posixify(path.resolve(tmp, 'server.js'));
        builder.generateServerInstance(generatedServer);
        entry =
          `export { server } from ${JSON.stringify(generatedServer)};\n` +
          `export const assets = new Set(${JSON.stringify(builder.manifest.assets.map((asset) => asset.path))});\n`;
      } else {
        writeFileSync(
          manifestPath,
          `export const manifest = ${builder.generateManifest({ relativePath: path.posix.relative(tmp, builder.getServerDirectory()) })};\n`
        );
        entry =
          `import { Server } from ${JSON.stringify(serverPath)};\n` +
          `import { manifest } from ${JSON.stringify(manifestPath)};\n` +
          `export const server = new Server(manifest);\n` +
          `export const assets = new Set([...manifest.assets, ...Object.keys(manifest._.server_assets)]);\n`;
      }

      writeFileSync(
        entryPoint,
        entry +
          `export const app_path = ${JSON.stringify(appPath)};\n` +
          `export const base_path = ${JSON.stringify(basePath)};\n` +
          `export const prerendered = new Map(${JSON.stringify(prerenderedFiles(builder.prerendered, basePath))});\n`
      );

      // Bundle main worker with esbuild
      const workerDest = `${dest}/_worker.js`;
      const shimsDir = posixify(path.resolve(files, 'shims'));

      await build({
        entryPoints: [`${files}/runtime/worker.js`],
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        mainFields: ['module', 'main'],
        outfile: workerDest,
        // Workers have no filesystem directory for SvelteKit's source-map lookup.
        define: kit3 ? { 'import.meta.dirname': 'undefined' } : undefined,
        alias: {
          SERVER: entryPoint,
          MANIFEST: entryPoint,
          'node:async_hooks': `${shimsDir}/async-hooks.js`,
          ...(nodeCompat
            ? {
                path: `${shimsDir}/node-path.js`,
                'node:path': `${shimsDir}/node-path.js`,
                fs: `${shimsDir}/node-fs.js`,
                'node:fs': `${shimsDir}/node-fs.js`,
                url: `${shimsDir}/node-url.js`,
                'node:url': `${shimsDir}/node-url.js`
              }
            : {})
        },
        external: ['node:*'],
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: true,
        treeShaking: true,
        banner: {
          js:
            `// Generated by ${name} v${version} at ${new Date().toISOString()}` +
            (nodeCompat ? `\nglobalThis.process = globalThis.process || { env: { NODE_ENV: "production" } };` : '')
        }
      } satisfies BuildOptions);

      // Generate mini-workers for API routes if enabled
      const functions: Array<{ pattern: string; worker: string }> = [];

      if (functionsEnabled) {
        builder.mkdirp(`${dest}/functions`);

        const serverDir = builder.getServerDirectory();
        const viteManifestPath = path.join(serverDir, '.vite/manifest.json');

        if (existsSync(viteManifestPath)) {
          const viteManifest = JSON.parse(readFileSync(viteManifestPath, 'utf-8'));
          const endpoints = extractEndpointsFromManifest(viteManifest, serverDir);

          // Resolve hooks file if the project has one
          const hooksEntry = viteManifest['src/hooks.server.ts'] || viteManifest['src/hooks.server.js'];

          const hooksFile = hooksEntry ? posixify(path.join(serverDir, hooksEntry.file)) : undefined;

          for (const endpoint of endpoints) {
            const routePattern = endpoint.pattern;
            // Use SvelteKit route syntax for worker filename
            const workerName = endpoint.route.replace(/\//g, '-').replace(/^-/, '') || 'index';
            const workerFile = `functions/${workerName}.js`;

            // Bundle using the template with ENDPOINT alias
            await buildFunctionWorker({
              endpointFile: posixify(endpoint.file),
              outfile: `${dest}/${workerFile}`,
              routePattern: endpoint.route,
              minify: true,
              debug,
              hooksFile
            });

            functions.push({
              pattern: routePattern,
              worker: workerFile
            });

            builder.log.minor(`  Generated function: ${routePattern} → ${workerFile}`);
          }
        }

        // Build page workers for routes with +page.server.ts
        for (const route of builder.routes) {
          // Skip prerendered pages
          if (route.prerender === true) continue;

          // Skip routes without page methods (API-only routes handled above)
          if (route.page.methods.length === 0) continue;

          // Skip the root layout-only routes
          if (!route.id) continue;

          const workerName = route.id.replace(/\//g, '-').replace(/^-/, '') || 'index';
          const workerFile = `functions/${workerName}.js`;

          // Generate a filtered manifest containing only this route
          const pageManifest = `${tmp}/manifest-${workerName}.js`;

          writeFileSync(
            pageManifest,
            `export const manifest = ${builder.generateManifest({
              relativePath: path.posix.relative(tmp, builder.getServerDirectory()),
              routes: [route]
            })};\n`
          );

          // Create entry point that imports Server + filtered manifest
          const pageEntry = `${tmp}/entry-${workerName}.js`;

          writeFileSync(
            pageEntry,
            `import { Server } from '${serverPath}';\n` +
              `import { manifest } from '${posixify(path.resolve(pageManifest))}';\n` +
              `export { Server, manifest };\n`
          );

          // Bundle page worker with esbuild
          await build({
            entryPoints: [`${files}/runtime/page-worker.js`],
            bundle: true,
            format: 'esm',
            platform: 'neutral',
            mainFields: ['module', 'main'],
            outfile: `${dest}/${workerFile}`,
            alias: {
              SERVER: pageEntry,
              'node:async_hooks': `${shimsDir}/async-hooks.js`,
              ...(nodeCompat
                ? {
                    path: `${shimsDir}/node-path.js`,
                    'node:path': `${shimsDir}/node-path.js`,
                    fs: `${shimsDir}/node-fs.js`,
                    'node:fs': `${shimsDir}/node-fs.js`,
                    url: `${shimsDir}/node-url.js`,
                    'node:url': `${shimsDir}/node-url.js`
                  }
                : {})
            },
            external: ['node:*'],
            minifySyntax: true,
            minifyWhitespace: true,
            minifyIdentifiers: true,
            treeShaking: true
          } satisfies BuildOptions);

          const pattern = convertRouteToPattern(route.id);

          functions.push({
            pattern,
            worker: workerFile
          });

          // SvelteKit fetches page data via __data.json for client-side navigation
          functions.push({
            pattern: pattern + '/__data.json',
            worker: workerFile
          });

          builder.log.minor(`  Generated page function: ${pattern} → ${workerFile}`);
        }
      }

      // Generate _routes.json for edge routing
      const routes = {
        // Immutable assets (hashed filenames, cache forever)
        immutable: [`/${appPath}/immutable/*`],
        // Static files from /static folder (robots.txt, favicon, etc.)
        static: staticFiles.map((f) => `${basePath}/${f}`),
        // Prerendered pages (serve from assets, no worker needed)
        prerendered: builder.prerendered.paths,
        // Functions (API routes as separate workers)
        functions: functions,
        // Everything else -> SSR
        ssr: ['/*']
      };

      writeFileSync(`${dest}/_routes.json`, JSON.stringify(routes, null, 2));

      builder.log.minor(`Wrote ${workerDest}`);
      builder.log.minor(`Wrote ${dest}/_routes.json`);

      if (functions.length > 0) {
        builder.log.minor(`Wrote ${functions.length} function workers to ${dest}/functions/`);
      }

      builder.log.minor(`Wrote ${assetsDir} (${builder.prerendered.paths.length} prerendered pages)`);
    }
  };
}

interface ViteManifestEntry {
  src?: string;
  file: string;
}

interface Endpoint {
  pattern: string;
  route: string;
  file: string;
}

/**
 * Extract endpoints from Vite manifest and convert SvelteKit routes to simple patterns
 */
function extractEndpointsFromManifest(manifest: Record<string, ViteManifestEntry>, serverDir: string): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [key, entry] of Object.entries(manifest)) {
    // Only process endpoint files (+server.ts/js)
    if (!key.includes('+server.ts') && !key.includes('+server.js')) continue;

    const sourcePath = entry.src;
    if (!sourcePath || !sourcePath.startsWith('src/routes/')) continue;

    // Extract route from source path: src/routes/status/[code]/[[reason]]/+server.ts
    const routePart = sourcePath.replace(/^src\/routes/, '').replace(/\/\+server\.(ts|js)$/, '');

    // Convert SvelteKit route syntax to simple wildcard patterns
    const pattern = convertRouteToPattern(routePart);

    // Get the built file path
    const file = path.join(serverDir, entry.file);

    endpoints.push({
      pattern, // For routing: /status/*/*
      route: routePart, // For filename: /status/[code]/[[reason]]
      file
    });
  }

  return endpoints;
}

/**
 * Convert SvelteKit route syntax to simple wildcard patterns
 * Examples:
 *   /status/[code]/[[reason]] becomes /status/star/star
 *   /range/[n] becomes /range/star
 *   /drip/[...params] becomes /drip/doublestar
 */
function convertRouteToPattern(route: string): string {
  if (!route || route === '/') return '/';

  const segments = route.split('/').filter(Boolean);
  const patternSegments = segments.map((segment: string) => {
    // Rest parameter: [...params] -> **
    if (segment.startsWith('[...') && segment.endsWith(']')) {
      return '**';
    }

    // Required or optional parameter: [param] or [[param]] -> *
    if ((segment.startsWith('[') && segment.endsWith(']')) || (segment.startsWith('[[') && segment.endsWith(']]'))) {
      return '*';
    }

    // Static segment: keep as-is
    return segment;
  });

  return '/' + patternSegments.join('/');
}

/**
 * Map each prerendered path (pages, endpoints and redirects) to its storage key.
 * Mirrors the output filenames of SvelteKit's prerenderer.
 */
function prerenderedFiles(prerendered: Builder['prerendered'], basePath: string): Array<[string, string]> {
  const file = (pathname: string, html: boolean) => {
    const name = pathname.slice(basePath.length + 1) || 'index.html';

    if (html && !name.endsWith('.html')) {
      return `${basePath}/${name}${name.endsWith('/') ? 'index.html' : '.html'}`;
    }

    return `${basePath}/${name}`;
  };

  return [
    ...Array.from(prerendered.pages, ([pathname, page]): [string, string] => [pathname, `${basePath}/${page.file}`]),
    ...Array.from(prerendered.assets.keys(), (pathname): [string, string] => [pathname, file(pathname, false)]),
    ...Array.from(prerendered.redirects.keys(), (pathname): [string, string] => [pathname, file(pathname, true)])
  ];
}

function posixify(str: string): string {
  return str.replace(/\\/g, '/');
}
