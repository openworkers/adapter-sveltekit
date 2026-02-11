import { build, BuildOptions } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { detectCookiesUsage } from './detect-cookies.js';
import { detectLocalsUsage } from './detect-locals.js';
import { generateParamsModule } from './generate-params.js';

export interface FunctionBuildOptions extends Pick<BuildOptions, 'minify' | 'outfile'> {
  /** Path to the endpoint file (+server.ts) */
  endpointFile: string;
  /** Output file path */
  outfile: string;
  /** Route pattern (e.g. '/api/users/[id]') */
  routePattern: string;
  /** Minify output */
  minify?: boolean;
  /** Debug options */
  debug?: {
    sourcemap?: boolean;
    prettier?: boolean;
  };
  /** Path to compiled hooks.server.js (if project has hooks) */
  hooksFile?: string;
}

/**
 * Build a function worker using the adapter's template
 * This is the EXACT same build process used in production
 */
export async function buildFunctionWorker(options: FunctionBuildOptions): Promise<void> {
  const { endpointFile, outfile, routePattern, minify = false, debug = {}, hooksFile } = options;

  // Auto-detect if endpoint uses cookies
  const usesCookies = detectCookiesUsage(endpointFile);

  // Auto-detect if endpoint uses locals (only relevant if hooks file exists)
  const usesLocals = detectLocalsUsage(endpointFile);
  const withHooks = usesLocals && !!hooksFile;

  // Auto-detect if route has params
  const hasParams = routePattern.includes('[');

  // Create temporary params module using SvelteKit's routing utilities
  const tempDir = mkdtempSync(path.join(tmpdir(), 'adapter-params-'));
  const paramsModulePath = path.join(tempDir, 'params.js');
  const paramsModuleCode = generateParamsModule(routePattern);
  writeFileSync(paramsModulePath, paramsModuleCode);

  // Resolve paths relative to adapter root
  // In dev: import.meta.url is src/adapter/build-function.ts -> need ../..
  // In prod (bundled): import.meta.url is dist/index.js -> need ..
  const urlPath = fileURLToPath(import.meta.url);
  const isDist = urlPath.includes('/dist/');
  const adapterRoot = fileURLToPath(new URL(isDist ? '..' : '../..', import.meta.url));
  const files = path.join(adapterRoot, 'dist');

  const functionTemplate = path.join(files, 'runtime/function-worker.js');
  const libCookies = path.join(files, 'runtime/cookies.js');
  const svelteKitCookie = path.join(process.cwd(), 'node_modules/@sveltejs/kit/src/runtime/server/cookie.js');
  const svelteKitRouting = path.join(process.cwd(), 'node_modules/@sveltejs/kit/src/utils/routing.js');

  const external = ['node:*'];
  if (!usesCookies) {
    external.push('cookie');
  }

  try {
    await build({
      entryPoints: [functionTemplate],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      outfile,
      alias: {
        ENDPOINT: endpointFile,
        'lib:cookies': libCookies,
        'lib:routing': paramsModulePath,
        'sveltekit:cookie': svelteKitCookie,
        'sveltekit:routing': svelteKitRouting,
        ...(withHooks ? { 'lib:hooks': hooksFile! } : {})
      },
      external,
      sourcemap: debug.sourcemap ? 'external' : false,
      minifySyntax: minify,
      minifyIdentifiers: minify,
      minifyWhitespace: minify,
      treeShaking: true,
      legalComments: 'none',
      define: {
        ROUTE_PATTERN: JSON.stringify(routePattern),
        WITH_COOKIES: JSON.stringify(usesCookies),
        WITH_PARAMS: JSON.stringify(hasParams),
        WITH_HOOKS: JSON.stringify(withHooks)
      }
    });

    if (debug.prettier) {
      try {
        const prettier = await import('prettier');
        const raw = readFileSync(outfile, 'utf-8');
        const formatted = await prettier.format(raw, { parser: 'meriyah' });
        writeFileSync(outfile, formatted);
      } catch {
        console.warn('debug.prettier requires prettier to be installed: bun i -d prettier');
      }
    }
  } finally {
    // Cleanup temporary params file
    try {
      unlinkSync(paramsModulePath);
      // Try to remove the temp directory (will fail if not empty, which is fine)
      unlinkSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
