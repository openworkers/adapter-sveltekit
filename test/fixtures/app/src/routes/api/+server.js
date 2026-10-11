import { getRequestEvent } from '$app/server';

export async function GET({ cookies, locals }) {
  await Promise.resolve();
  const event = getRequestEvent();
  cookies.set('api', 'ok', { path: '/' });
  return Response.json({ marker: locals.marker, path: event.url.pathname });
}
