export const prerender = true;

export function GET() {
  return new Response('<urlset/>', { headers: { 'content-type': 'application/xml' } });
}
