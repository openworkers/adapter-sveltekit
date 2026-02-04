import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { name } = await request.json();
  const playerId = crypto.randomUUID();

  cookies.set('player', playerId, {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365
  });

  cookies.set('session', 'test-session-123', {
    path: '/',
    httpOnly: true,
    maxAge: 3600
  });

  return json({
    success: true,
    playerId,
    name
  });
};
