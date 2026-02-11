/**
 * Integration test: verify that the handle() hook actually runs
 * and populates locals before the endpoint handler executes.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { buildFunctionWorker } from '../src/adapter/build-function';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

const testDir = '/tmp/adapter-sveltekit-test-hooks-integration';
const endpointsDir = `${testDir}/endpoints`;
const buildDir = `${testDir}/build`;

beforeAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }

  mkdirSync(endpointsDir, { recursive: true });
  mkdirSync(buildDir, { recursive: true });

  // Endpoint that reads locals.user
  writeFileSync(
    `${endpointsDir}/with-locals.ts`,
    `export async function GET({ locals }) {
  return new Response(JSON.stringify({ user: locals.user }), {
    headers: { 'Content-Type': 'application/json' }
  });
}`
  );

  // Endpoint that does NOT use locals
  writeFileSync(
    `${endpointsDir}/without-locals.ts`,
    `export async function GET({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}`
  );

  // Hooks file that sets locals.user
  writeFileSync(
    `${testDir}/hooks.server.js`,
    `export async function handle({ event, resolve }) {
  event.locals.user = { id: 'hook-user-42', name: 'Hook User' };
  return resolve(event);
}`
  );
});

describe('Hooks Integration', () => {
  test('handle() hook populates locals before handler runs', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/with-locals.ts`,
      outfile: `${buildDir}/with-hooks.js`,
      routePattern: '/api/me',
      hooksFile: `${testDir}/hooks.server.js`
    });

    const worker = await import(`${buildDir}/with-hooks.js`);
    const handler = worker.default;

    const req = new Request('https://test.com/api/me');
    const env = {};
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

    const response = await handler.fetch(req, env, ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toEqual({ id: 'hook-user-42', name: 'Hook User' });
  });

  test('locals is empty when endpoint does not use locals (no hooks)', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/without-locals.ts`,
      outfile: `${buildDir}/without-hooks.js`,
      routePattern: '/api/health',
      hooksFile: `${testDir}/hooks.server.js`
    });

    const worker = await import(`${buildDir}/without-hooks.js`);
    const handler = worker.default;

    const req = new Request('https://test.com/api/health');
    const env = {};
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

    const response = await handler.fetch(req, env, ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('locals is empty when no hooks file provided', async () => {
    await buildFunctionWorker({
      endpointFile: `${endpointsDir}/with-locals.ts`,
      outfile: `${buildDir}/no-hooks-file.js`,
      routePattern: '/api/me'
    });

    const worker = await import(`${buildDir}/no-hooks-file.js`);
    const handler = worker.default;

    const req = new Request('https://test.com/api/me');
    const env = {};
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

    const response = await handler.fetch(req, env, ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Without hooks, locals is {} so locals.user is undefined
    expect(body.user).toBeUndefined();
  });
});
