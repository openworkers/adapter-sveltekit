export async function handle({ event, resolve }) {
  event.locals.marker = 'hook-ok';
  return resolve(event);
}
