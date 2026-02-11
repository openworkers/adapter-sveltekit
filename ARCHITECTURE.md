# Architecture

## Directory structure

```
src/
├── index.ts              # Adapter entry point (build-time)
├── adapter/              # Build-time: runs during `adapt()`
│   ├── build-function.ts # Bundles mini-workers for API routes
│   ├── detect-cookies.ts # Static analysis: does endpoint use cookies?
│   └── generate-params.ts# Generates route param extractors from SvelteKit patterns
├── runtime/              # Runtime: runs inside OpenWorkers
│   ├── worker.ts         # Main SSR worker (uses server.respond())
│   ├── function-worker.ts# Mini-worker template for API routes
│   ├── cookies.ts        # Cookie helpers (wraps SvelteKit internals)
│   └── routing.ts        # Route matching (re-exports SvelteKit's parseRouteId)
└── shims/                # Polyfills for missing Node APIs
    ├── async-hooks.ts    # Stub for node:async_hooks (SvelteKit imports it)
    ├── node-path.ts      # Minimal path module (nodeCompat option)
    ├── node-fs.ts        # Stub fs module (nodeCompat option)
    └── node-url.ts       # Minimal url module (nodeCompat option)
```

## Three phases

### 1. Build-time (`src/index.ts` + `src/adapter/`)

Runs on the developer's machine during `vite build`. The adapter:

1. Writes client assets and prerendered pages to `build/assets/`
2. Generates a manifest module with the route table
3. Bundles the main SSR worker with esbuild (`runtime/worker.ts` + app server)
4. Optionally generates separate mini-workers for each `+server.ts` endpoint

### 2. Runtime (`src/runtime/`)

Runs inside OpenWorkers when a request arrives.

- **`worker.ts`** (main worker): Initializes the SvelteKit `Server`, serves static assets via the `ASSETS` binding, and delegates dynamic requests to `server.respond()`. Hooks (`hooks.server.ts`) run here.
- **`function-worker.ts`** (mini-workers): Lightweight handler that calls endpoint handlers (`GET`, `POST`, ...) directly without `server.respond()`. This means **hooks do NOT run** and `locals` is always `{}`.
- **`cookies.ts`**: Re-exports SvelteKit's internal cookie functions. Used at **runtime** by function workers via the `lib:cookies` alias (resolves to `dist/runtime/cookies.js`).
- **`routing.ts`**: Re-exports SvelteKit's internal routing functions. Used at **build-time only** by `generate-params.ts` (for `parseRouteId`). The built `dist/runtime/routing.js` is dead code — no worker ever imports it. It lives in `runtime/` because it wraps SvelteKit runtime internals, but it could arguably live in `adapter/`.

### 3. Shims (`src/shims/`)

Polyfills injected via esbuild aliases to replace Node built-ins that don't exist in the OpenWorkers runtime:

- `node:async_hooks` is always shimmed (SvelteKit imports `AsyncLocalStorage`)
- `path`, `fs`, `url` are shimmed only when `nodeCompat: true`

## How esbuild aliases work

The adapter uses esbuild's `alias` option to resolve virtual imports at bundle time:

| Import | Resolves to | Phase |
|---|---|---|
| `SERVER` / `MANIFEST` | Generated manifest module | Main worker build |
| `ENDPOINT` | The actual `+server.ts` file | Function worker build |
| `lib:cookies` | `dist/runtime/cookies.js` | Function worker build |
| `lib:routing` | Generated params extractor (temp file) | Function worker build |
| `sveltekit:cookie` | SvelteKit's internal cookie module | Adapter + function build |
| `sveltekit:routing` | SvelteKit's internal routing module | Adapter + function build |
| `node:async_hooks` | `dist/shims/async-hooks.js` | Main worker build |

### cookies.ts vs routing.ts — why they differ

Both files are thin re-exports of SvelteKit internals, but they work very differently:

**`cookies.ts`** is a true runtime module. `function-worker.ts` declares `lib:cookies` as an external import, and at per-endpoint build time, `build-function.ts` aliases it to `dist/runtime/cookies.js`. The cookie code ends up in the final worker bundle.

**`routing.ts`** is build-time only. `generate-params.ts` imports `parseRouteId` from it to **generate** a params extractor module (a temp `.js` file with the route's regex baked in). That generated module imports `exec` from `sveltekit:routing` directly — it never goes through `routing.ts`. At per-endpoint build time, `lib:routing` aliases to the generated temp file, not to `dist/runtime/routing.js`. So `dist/runtime/routing.js` is built but never imported by anything.

## Build flow

```
vite build
  └─ adapter.adapt()
       ├─ writeClient() + writePrerendered() → build/assets/
       ├─ generate manifest.js (routes, prerendered set)
       ├─ esbuild: worker.ts + manifest → build/_worker.js
       └─ (if functions: true)
            └─ for each +server.ts:
                 └─ esbuild: function-worker.ts + endpoint → build/functions/<name>.js
```

## Why `locals: {}` in function-worker

The main worker runs `server.respond()` which executes the full SvelteKit request lifecycle, including `hooks.server.ts` where `event.locals` is typically populated.

Function workers bypass this entirely -- they call endpoint handlers directly. There is no `handle()` hook in the pipeline, so `locals` stays as an empty object. This is a deliberate trade-off for performance: function workers are smaller and faster, but they cannot rely on hook-injected data.

## Error handling in function-worker (duck-typing)

SvelteKit's `redirect()` and `error()` throw class instances. When bundled separately, the function-worker gets its own copy of these classes, so `instanceof` checks fail.

Instead, function-worker uses duck-typing:
- **Redirect**: `error.status >= 300 && error.status < 400 && error.location`
- **HttpError**: `error.status && error.body`

This works regardless of how the error class was instantiated.
