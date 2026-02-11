import adapter from '../../../dist/index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'test/fixtures/test-app/build',
      functions: true
    }),
    files: {
      assets: 'test/fixtures/test-app/static',
      routes: 'test/fixtures/with-cookies'
    }
  }
};

export default config;
