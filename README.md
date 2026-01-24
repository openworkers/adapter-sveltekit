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
      out: 'dist' // default
    })
  }
};
```

## Output

```
dist/
  worker.js    # Worker entry point
  routes.js    # Route manifest for edge routing
  assets/      # Static assets and prerendered pages
```

## License

MIT
