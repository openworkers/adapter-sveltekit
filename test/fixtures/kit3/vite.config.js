import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import adapter from '../../../dist/index.js';

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ functions: process.env.TEST_FUNCTIONS === 'true' }),
      paths: { base: process.env.TEST_BASE ?? '' }
    })
  ]
});
