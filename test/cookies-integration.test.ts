/**
 * Test adapter with real function that sets multiple cookies
 * Uses the EXACT same build process as production
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { buildFunctionWorker } from '../src/adapter/build-function';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const outDir = 'test/dist';
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

describe('Adapter: Multiple Cookies', () => {
  let worker: any;

  beforeAll(async () => {
    // Build the function worker using production build process
    await buildFunctionWorker({
      endpointFile: join(process.cwd(), 'test/functions/+server.ts'),
      outfile: join(process.cwd(), 'test/dist/cookies-worker.js'),
      routePattern: '/api/test'
    });

    worker = await import('./dist/cookies-worker.js');
  });

  test('should set multiple cookies correctly', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' })
    });

    const env = {};
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

    const handler = worker.default as Pick<Required<ExportedHandler<unknown>>, 'fetch'>;
    const response: Response = await handler.fetch(request, env, ctx);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.name).toBe('Alice');
    expect(body.playerId).toBeDefined();

    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThanOrEqual(2);

    // Check player cookie
    const playerCookie = cookies.find((c) => c.startsWith('player='));
    expect(playerCookie).toBeDefined();
    expect(playerCookie).toContain('HttpOnly');
    expect(playerCookie).toContain('SameSite=Lax');

    // Check session cookie
    const sessionCookie = cookies.find((c) => c.startsWith('session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
  });
});
