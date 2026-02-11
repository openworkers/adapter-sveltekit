/**
 * Integration test: verify that the handle() hook actually runs
 * and populates locals before the endpoint handler executes.
 */

import { describe, test, expect } from 'bun:test';
import { createTestWorker } from './helpers';

const withLocalsEndpoint = `export async function GET({ locals }) {
  return new Response(JSON.stringify({ user: locals.user }), {
    headers: { 'Content-Type': 'application/json' }
  });
}`;

const withoutLocalsEndpoint = `export async function GET({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}`;

const hooksCode = `export async function handle({ event, resolve }) {
  event.locals.user = { id: 'hook-user-42', name: 'Hook User' };
  return resolve(event);
}`;

describe('Hooks Integration', () => {
  test('handle() hook populates locals before handler runs', async () => {
    const { fetch } = await createTestWorker({
      endpointCode: withLocalsEndpoint,
      routePattern: '/api/me',
      hooksCode,
    });

    const response = await fetch('https://test.com/api/me');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toEqual({ id: 'hook-user-42', name: 'Hook User' });
  });

  test('locals is empty when endpoint does not use locals (no hooks)', async () => {
    const { fetch } = await createTestWorker({
      endpointCode: withoutLocalsEndpoint,
      routePattern: '/api/health',
      hooksCode,
    });

    const response = await fetch('https://test.com/api/health');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('locals is empty when no hooks file provided', async () => {
    const { fetch } = await createTestWorker({
      endpointCode: withLocalsEndpoint,
      routePattern: '/api/me',
    });

    const response = await fetch('https://test.com/api/me');
    const body = await response.json();

    expect(response.status).toBe(200);
    // Without hooks, locals is {} so locals.user is undefined
    expect(body.user).toBeUndefined();
  });
});
