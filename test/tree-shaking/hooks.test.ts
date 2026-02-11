/**
 * Test that hooks code is included/excluded based on locals usage
 * - With locals + hooks: should include handle() wrapper
 * - Without locals: should NOT include hooks code (tree-shaken)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { buildFunctionWorker } from '../../src/adapter/build-function';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const testDir = '/tmp/adapter-sveltekit-test-tree-shaking-hooks';
const outDir = `${testDir}/dist`;
const endpointsDir = `${testDir}/endpoints`;

beforeAll(() => {

  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  mkdirSync(outDir, { recursive: true });
  mkdirSync(endpointsDir, { recursive: true });

  // Endpoint that uses locals
  writeFileSync(
    `${endpointsDir}/with-locals.ts`,
    `export async function GET({ locals }) {
  return new Response(JSON.stringify(locals));
}`
  );

  // Endpoint that does NOT use locals
  writeFileSync(
    `${endpointsDir}/without-locals.ts`,
    `export async function GET({ request }) {
  return new Response("ok");
}`
  );

  // Fake hooks file
  writeFileSync(
    `${testDir}/hooks.server.js`,
    `export async function handle({ event, resolve }) {
  event.locals.user = { id: '123', name: 'Test' };
  return resolve(event);
}`
  );
});

describe('Hooks Tree-Shaking', () => {
  beforeAll(async () => {
    // Build with locals + hooks
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/with-locals.ts`,
      outfile: `${outDir}/with-hooks.js`,
      routePattern: '/api/test',
      hooksFile: `${testDir}/hooks.server.js`
    });

    // Build without locals (hooks file provided but not needed)
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/without-locals.ts`,
      outfile: `${outDir}/without-hooks.js`,
      routePattern: '/api/test',
      hooksFile: `${testDir}/hooks.server.js`
    });

    // Build with locals but NO hooks file
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/with-locals.ts`,
      outfile: `${outDir}/locals-no-hooks-file.js`,
      routePattern: '/api/test'
    });
  });

  test('should include hooks code when endpoint uses locals and hooks file exists', () => {
    const code = readFileSync(`${outDir}/with-hooks.js`, 'utf-8');

    // Should contain the hooks handle function body (inlined from hooks.server.js)
    expect(code).toContain('event.locals.user');

    // WITH_HOOKS should be true → the `if (true)` branch calls handle()
    expect(code).toContain('if (true)');
  });

  test('should exclude hooks code when endpoint does not use locals', () => {
    const code = readFileSync(`${outDir}/without-hooks.js`, 'utf-8');
    const codeWithHooks = readFileSync(`${outDir}/with-hooks.js`, 'utf-8');

    // Should be smaller than the version with hooks
    expect(code.length).toBeLessThan(codeWithHooks.length);

    // Should not contain the hooks handle function body
    expect(code).not.toContain('event.locals.user');

    console.log(`  With hooks:    ${(codeWithHooks.length / 1024).toFixed(1)} KB`);
    console.log(`  Without hooks: ${(code.length / 1024).toFixed(1)} KB`);
    console.log(`  Difference:    ${((codeWithHooks.length - code.length) / 1024).toFixed(1)} KB`);
  });

  test('should exclude hooks code when no hooks file is provided', () => {
    const code = readFileSync(`${outDir}/locals-no-hooks-file.js`, 'utf-8');

    // Should not contain the hooks handle function body
    expect(code).not.toContain('event.locals.user');
  });
});
