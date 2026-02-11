import { build, type BuildOptions } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const builds: BuildOptions[] = [
  // Adapter entry point
  {
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    alias: {
      'sveltekit:routing': join(process.cwd(), 'node_modules/@sveltejs/kit/src/utils/routing.js')
    },
    external: ['node:*', 'esbuild', '@sveltejs/kit'],
    platform: 'node'
  },
  // Main worker
  {
    entryPoints: ['src/runtime/worker.ts'],
    outfile: 'dist/runtime/worker.js',
    external: ['SERVER', 'MANIFEST', 'node:async_hooks']
  },
  // Function worker (runtime modules are aliased at build time per endpoint)
  {
    entryPoints: ['src/runtime/function-worker.ts'],
    outfile: 'dist/runtime/function-worker.js',
    alias: {
      'sveltekit:cookie': join(process.cwd(), 'node_modules/@sveltejs/kit/src/runtime/server/cookie.js'),
      'sveltekit:routing': join(process.cwd(), 'node_modules/@sveltejs/kit/src/utils/routing.js')
    },
    external: ['ENDPOINT', 'lib:cookies', 'lib:routing', 'lib:hooks', 'node:async_hooks']
  },
  // Runtime: cookies
  {
    entryPoints: ['src/runtime/cookies.ts'],
    outfile: 'dist/runtime/cookies.js',
    alias: {
      'sveltekit:cookie': join(process.cwd(), 'node_modules/@sveltejs/kit/src/runtime/server/cookie.js')
    }
  },
  // Runtime: routing
  {
    entryPoints: ['src/runtime/routing.ts'],
    outfile: 'dist/runtime/routing.js',
    alias: {
      'sveltekit:routing': join(process.cwd(), 'node_modules/@sveltejs/kit/src/utils/routing.js')
    }
  },
  // Async hooks shim
  { entryPoints: ['src/shims/async-hooks.ts'], outfile: 'dist/shims/async-hooks.js' },
  // Node compat shims
  { entryPoints: ['src/shims/node-path.ts'], outfile: 'dist/shims/node-path.js' },
  { entryPoints: ['src/shims/node-fs.ts'], outfile: 'dist/shims/node-fs.js' },
  { entryPoints: ['src/shims/node-url.ts'], outfile: 'dist/shims/node-url.js' }
];

const commonOptions: BuildOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser'
};

console.log('Building adapter files...\n');

mkdirSync('dist', { recursive: true });

for (const config of builds) {
  await build({ ...commonOptions, ...config });
  console.log(`✓ ${config.outfile}`);
}

copyFileSync('index.d.ts', 'dist/index.d.ts');
console.log('✓ dist/index.d.ts');

console.log('\nBuild complete!');
