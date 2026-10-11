# @openworkers/adapter-sveltekit

SvelteKit 2 and 3 adapter for OpenWorkers. Requires OpenWorkers runner 0.15.21 or later, 1.x included.

## Installation

```bash
bun add -d @openworkers/adapter-sveltekit
```

## Usage

### SvelteKit 3

```js
// vite.config.js
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@openworkers/adapter-sveltekit';

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter({ outDir: 'build' }) })]
});
```

SvelteKit 3 builds a single worker for SSR and API routes. If `functions: true`
is set, the adapter emits a warning and builds a single worker. It does not
generate a `functions/` directory; `_routes.json` contains an empty `functions` list.

### SvelteKit 2

```js
// svelte.config.js
import adapter from '@openworkers/adapter-sveltekit';

export default {
  kit: {
    adapter: adapter({
      outDir: 'build', // Output directory (default: 'build')
      functions: true // Generate mini-workers for API routes (default: false)
    })
  }
};
```

## Options

| Option       | Type      | Default   | Description                                                          |
| ------------ | --------- | --------- | -------------------------------------------------------------------- |
| `outDir`     | `string`  | `'build'` | Output directory for the build                                       |
| `functions`  | `boolean` | `false`   | Generate mini-workers on SvelteKit 2; warn and ignore on SvelteKit 3 |
| `nodeCompat` | `boolean` | `false`   | Include shims for Node.js built-in modules                           |

## Output

```
build/
├── _worker.js     # Main SSR worker
├── _routes.json   # Route manifest for edge routing
├── assets/        # Static assets and prerendered pages
└── functions/     # Mini-workers for API routes (if functions: true)
    ├── api-hello.js
    └── api-users.js
```

## Functions Mode

On SvelteKit 2, when `functions: true`, the adapter generates a separate mini-worker for each `+server.ts` endpoint:

- `/api/hello/+server.ts` → `functions/api-hello.js`
- `/api/users/+server.ts` → `functions/api-users.js`

The route mappings are included in `_routes.json`:

```js
{
  "functions": [
    { "pattern": "/api/hello", "worker": "functions/api-hello.js" },
    { "pattern": "/api/users", "worker": "functions/api-users.js" }
  ]
}
```

This prepares for native project routing in the OpenWorkers runner, where each function can be deployed as a separate worker for better isolation and scaling.

## TypeScript

For proper types on `platform.env`, add `@openworkers/workers-types`:

```bash
bun add -d @openworkers/workers-types
```

Then in `src/app.d.ts`:

```ts
/// <reference types="@openworkers/workers-types" />

declare global {
  namespace App {
    interface Platform {
      env: {
        KV: BindingKV;
        ASSETS: BindingAssets;
      };
    }
  }
}

export {};
```

## Deployment

Build your SvelteKit app, then deploy it with the [OpenWorkers CLI](https://github.com/openworkers/openworkers-cli):

```bash
# Build
bun run build

# Deploy
ow workers upload my-app ./build
```

For a first deployment, you'll need to set up the worker and its assets binding:

```bash
# Create the worker
ow workers create my-app -d "My SvelteKit App"

# Create a storage bucket for static assets
ow storage create my-storage

# Create an environment and bind the storage as ASSETS
ow env create my-app-env
ow env bind my-app-env ASSETS my-storage --type assets

# Link the environment to the worker
ow workers link my-app my-app-env
# Build and upload
bun run build
ow workers upload my-app ./build
```

## Examples

- [world-time-app](https://github.com/max-lt/world-time-app) — SSR-rendered clocks with server-side positioned hands
- [httpbin](https://github.com/max-lt/httpbin) — HTTP request testing tool
- [rock-paper-scissors](https://github.com/max-lt/rock-paper-scissors) — Provably fair Rock Paper Scissors game

## License

MIT

## Development

Use Node 22.17 or later for the SvelteKit 3 fixture builds.

```bash
bun install --frozen-lockfile
bun install --cwd test/fixtures/kit3 --frozen-lockfile
bun run build
bun run check
bun test
```

The compatibility tests build real SvelteKit 2 and 3 apps, then exercise the
bundled worker with SSR, hooks, bindings, cookies, form actions, streaming,
page data, static assets and prerendered pages. They also check a URL base path
and the SvelteKit 3 `functions` warning. SvelteKit 3 fixture dependencies have a
separate lockfile so the adapter's SvelteKit 2 build stays independent.
