export function load({ locals, platform }) {
  return { marker: locals.marker, binding: platform?.env.TEST_BINDING };
}

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    cookies.set('session', 'saved', { path: '/' });
    return { message: data.get('message') };
  }
};
