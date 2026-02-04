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
    entryPoints: ['src/worker.ts'],
    outfile: 'dist/worker.js',
    external: ['SERVER', 'MANIFEST', 'node:async_hooks']
  },
  // Function worker (lib modules are aliased at build time per endpoint)
  {
    entryPoints: ['src/function-worker.ts'],
    outfile: 'dist/function-worker.js',
    alias: {
      'sveltekit:cookie': join(process.cwd(), 'node_modules/@sveltejs/kit/src/runtime/server/cookie.js'),
      'sveltekit:routing': join(process.cwd(), 'node_modules/@sveltejs/kit/src/utils/routing.js')
    },
    external: ['ENDPOINT', 'lib:cookies', 'lib:routing', 'node:async_hooks']
  }
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
