# @openworkers/adapter-sveltekit

SvelteKit adapter for OpenWorkers.

## Installation

```bash
bun add -d @openworkers/adapter-sveltekit
```

## Usage

```js
// svelte.config.js
import adapter from '@openworkers/adapter-sveltekit';

export default {
  kit: {
    adapter: adapter({
      out: 'dist',      // Output directory (default: 'dist')
      functions: false  // Generate mini-workers for API routes (default: false)
    })
  }
};
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `out` | `string` | `'dist'` | Output directory for the build |
| `functions` | `boolean` | `false` | Generate separate mini-workers for each API route |

## Output

```
dist/
├── _worker.js     # Main SSR worker
├── _routes.json   # Route manifest for edge routing
├── assets/        # Static assets and prerendered pages
└── functions/     # Mini-workers for API routes (if functions: true)
    ├── api-hello.js
    └── api-users.js
```

## Functions Mode

When `functions: true`, the adapter generates a separate mini-worker for each `+server.ts` endpoint:

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

## License

MIT
