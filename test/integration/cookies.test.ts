/**
 * Test adapter with real function that sets multiple cookies
 * Uses the EXACT same build process as production
 */

import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { createTestWorker } from './helpers';

describe('Adapter: Multiple Cookies', () => {
  test('should set multiple cookies correctly', async () => {
    const { fetch } = await createTestWorker({
      endpointFile: join(process.cwd(), 'test/fixtures/with-cookies/+server.ts'),
      routePattern: '/api/test',
    });

    const response = await fetch('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

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
