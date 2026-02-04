import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  return json({
    message: 'No cookies here',
    timestamp: Date.now()
  });
};
