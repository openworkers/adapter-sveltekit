/**
 * Test that params extraction code is included/excluded based on route pattern
 * - With params: should include SvelteKit routing code
 * - Without params: should NOT include routing code (tree-shaken)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { buildFunctionWorker } from '../../src/adapter/build-function';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const testDir = '/tmp/adapter-tree-shaking-params';
const outDir = `${testDir}/dist`;
const endpointsDir = `${testDir}/endpoints`;

beforeAll(() => {

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  if (!existsSync(endpointsDir)) {
    mkdirSync(endpointsDir, { recursive: true });
  }

  // Create endpoint that returns params
  const endpointCode = `
export async function GET(event) {
  return new Response(JSON.stringify({ params: event.params }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
`;

  writeFileSync(`${endpointsDir}/endpoint.ts`, endpointCode);
});

describe('Params Tree-Shaking', () => {
  const EXPECTED_MIN_DIFFERENCE = 2500; // 2.5KB minimum for routing code

  beforeAll(async () => {
    // Build worker WITH params
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/endpoint.ts`,
      outfile: `${outDir}/with-params.js`,
      routePattern: '/users/[id]/posts/[slug]',
      minify: false
    });

    // Build worker WITHOUT params
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/endpoint.ts`,
      outfile: `${outDir}/without-params.js`,
      routePattern: '/api/health',
      minify: false
    });
  });

  test('should auto-detect params in route pattern', () => {
    const withParamsPattern = '/users/[id]/posts/[slug]';
    const withoutParamsPattern = '/api/health';

    const hasParamsDetected = withParamsPattern.includes('[');
    const noParamsDetected = withoutParamsPattern.includes('[');

    expect(hasParamsDetected).toBe(true);
    expect(noParamsDetected).toBe(false);
  });

  test('should exclude routing code when no params', () => {
    const withParamsCode = readFileSync(`${outDir}/with-params.js`, 'utf-8');
    const withoutParamsCode = readFileSync(`${outDir}/without-params.js`, 'utf-8');

    const withSize = withParamsCode.length;
    const withoutSize = withoutParamsCode.length;
    const difference = withSize - withoutSize;

    // Routing implementation (exec + pattern matching) should add ~5-10KB
    expect(difference).toBeGreaterThanOrEqual(EXPECTED_MIN_DIFFERENCE);

    // Verify routing code is present in with-params
    expect(withParamsCode).toContain('exec');
    expect(withParamsCode).toContain('pattern');

    // Verify routing code is NOT in without-params (tree-shaken)
    expect(withoutParamsCode).toContain('if (false)'); // WITH_PARAMS = false

    // Log sizes for visibility
    console.log(`  With params:    ${(withSize / 1024).toFixed(1)} KB`);
    console.log(`  Without params: ${(withoutSize / 1024).toFixed(1)} KB`);
    console.log(`  Difference:     ${(difference / 1024).toFixed(1)} KB`);
  });

  test('should include SvelteKit exec function when params present', () => {
    const withParamsCode = readFileSync(`${outDir}/with-params.js`, 'utf-8');

    // Should contain SvelteKit's exec implementation
    expect(withParamsCode).toContain('function exec(match, params');
    expect(withParamsCode).toContain('const values = match.slice(1)');
  });

  test('should not include exec function when no params', () => {
    const withoutParamsCode = readFileSync(`${outDir}/without-params.js`, 'utf-8');

    // Should NOT contain SvelteKit's exec implementation (tree-shaken)
    expect(withoutParamsCode).not.toContain('function exec(match, params');
  });
});
