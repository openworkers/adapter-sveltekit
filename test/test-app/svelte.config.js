import adapter from '../../dist/index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'test/test-app/build',
      functions: true
    }),
    files: {
      assets: 'test/test-app/static',
      routes: 'test/functions'
    }
  }
};

export default config;
