import adapter from '../../../dist/index.js';

export default {
  kit: { adapter: adapter(), paths: { base: process.env.TEST_BASE ?? '' } }
};
