import { buildFunctionWorker } from '../../src/adapter/build-function';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

const testDir = '/tmp/adapter-sveltekit-test-integration';
let counter = 0;

type TestWorkerOptions = {
  /** SvelteKit route pattern, e.g. '/api/users/[id]' */
  routePattern: string;
  /** Hooks source code (optional) */
  hooksCode?: string;
} & (
  | { endpointCode: string; endpointFile?: never }
  | { endpointFile: string; endpointCode?: never }
);

/**
 * Build a function worker and return a fetch function.
 */
export async function createTestWorker(options: TestWorkerOptions) {
  const id = counter++;
  const dir = `${testDir}/${id}`;

  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });

  let endpointFile: string;

  if (options.endpointFile) {
    endpointFile = options.endpointFile;
  } else {
    endpointFile = `${dir}/+server.ts`;
    writeFileSync(endpointFile, options.endpointCode!);
  }

  let hooksFile: string | undefined;

  if (options.hooksCode) {
    hooksFile = `${dir}/hooks.server.js`;
    writeFileSync(hooksFile, options.hooksCode);
  }

  const outfile = `${dir}/worker.js`;

  await buildFunctionWorker({
    endpointFile,
    outfile,
    routePattern: options.routePattern,
    hooksFile,
  });

  const worker = await import(outfile);
  const handler = worker.default;

  return {
    async fetch(url: string, init?: RequestInit): Promise<Response> {
      const req = new Request(url, init);
      const env = {};
      const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
      return handler.fetch(req, env, ctx);
    },
  };
}
