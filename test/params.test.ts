import { describe, test, expect, beforeAll } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildFunctionWorker } from '../src/adapter/build-function';

const testDir = '/tmp/adapter-sveltekit-test-params';
const endpointsDir = `${testDir}/endpoints`;
const buildDir = `${testDir}/build`;

beforeAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  mkdirSync(endpointsDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  // Create test endpoint with params
  const endpointCode = `
export async function GET(event) {
  const { id, slug } = event.params;
  return new Response(JSON.stringify({ id, slug }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
`;

  writeFileSync(`${endpointsDir}/params.ts`, endpointCode);
});

describe('Adapter: Params Extraction', () => {
  test('should generate params extraction code for required params', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/params.ts`,
      outfile: `${buildDir}/params.js`,
      routePattern: '/api/users/[id]/posts/[slug]',
      minify: false
    });

    const builtCode = await Bun.file(`${buildDir}/params.js`).text();

    // Verify SvelteKit's routing code is used
    expect(builtCode).toContain('pattern.exec(url.pathname)');
    expect(builtCode).toContain('exec(match, params');
    expect(builtCode).toContain('"id"');
    expect(builtCode).toContain('"slug"');
  });

  test('should handle optional params', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/params.ts`,
      outfile: `${buildDir}/optional.js`,
      routePattern: '/status/[code]/[[reason]]',
      minify: false
    });

    const builtCode = await Bun.file(`${buildDir}/optional.js`).text();

    // Verify optional param metadata is present
    expect(builtCode).toContain('"reason"');
    expect(builtCode).toMatch(/"optional":\s*true/);
  });

  test('should handle rest params', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/params.ts`,
      outfile: `${buildDir}/rest.js`,
      routePattern: '/drip/[...params]',
      minify: false
    });

    const builtCode = await Bun.file(`${buildDir}/rest.js`).text();

    // Verify rest param metadata
    expect(builtCode).toMatch(/"rest":\s*true/);
  });

  test('should not include params code when no params', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/params.ts`,
      outfile: `${buildDir}/no-params.js`,
      routePattern: '/api/health',
      minify: false
    });

    const builtCode = await Bun.file(`${buildDir}/no-params.js`).text();

    // Verify WITH_PARAMS is false (tree-shaked)
    expect(builtCode).toContain('if (false)');
  });
});
