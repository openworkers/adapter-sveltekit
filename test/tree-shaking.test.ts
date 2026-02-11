/**
 * Test that cookie module is included/excluded based on usage
 * - With cookies: should include cookie implementation
 * - Without cookies: should NOT include cookie code (tree-shaken)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { buildFunctionWorker } from '../src/adapter/build-function';
import { detectCookiesUsage } from '../src/adapter/detect-cookies';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const outDir = 'test/dist';
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

describe('Cookie Tree-Shaking', () => {
  const withCookiesEndpoint = join(process.cwd(), 'test/functions/+server.ts');
  const withoutCookiesEndpoint = join(process.cwd(), 'test/functions-no-cookies/+server.ts');
  const EXPECTED_MIN_DIFFERENCE = 10000; // 10KB minimum

  beforeAll(async () => {
    // Build both workers
    await buildFunctionWorker({
      endpointFile: withCookiesEndpoint,
      outfile: join(process.cwd(), 'test/dist/with-cookies.js'),
      routePattern: '/with-cookies'
    });

    await buildFunctionWorker({
      endpointFile: withoutCookiesEndpoint,
      outfile: join(process.cwd(), 'test/dist/without-cookies.js'),
      routePattern: '/without-cookies'
    });
  });

  test('should auto-detect cookie usage', () => {
    const withCookiesDetected = detectCookiesUsage(withCookiesEndpoint);
    const withoutCookiesDetected = detectCookiesUsage(withoutCookiesEndpoint);

    expect(withCookiesDetected).toBe(true);
    expect(withoutCookiesDetected).toBe(false);
  });

  test('should exclude cookie code when not used', () => {
    const withCookiesCode = readFileSync('test/dist/with-cookies.js', 'utf-8');
    const withoutCookiesCode = readFileSync('test/dist/without-cookies.js', 'utf-8');

    const withSize = withCookiesCode.length;
    const withoutSize = withoutCookiesCode.length;
    const difference = withSize - withoutSize;

    // Cookie implementation should add ~15-20KB
    expect(difference).toBeGreaterThanOrEqual(EXPECTED_MIN_DIFFERENCE);

    // Log sizes for visibility
    console.log(`  With cookies:    ${(withSize / 1024).toFixed(1)} KB`);
    console.log(`  Without cookies: ${(withoutSize / 1024).toFixed(1)} KB`);
    console.log(`  Difference:      ${(difference / 1024).toFixed(1)} KB`);
  });
});
