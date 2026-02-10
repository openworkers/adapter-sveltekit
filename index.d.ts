import { Adapter } from '@sveltejs/kit';

export interface AdapterOptions {
  /**
   * Output directory for the build
   * @default 'build'
   */
  outDir?: string;

  /**
   * Generate separate mini-workers for each API route.
   * Outputs to `build/functions/` with routing info in `routes.js`.
   * @default false
   */
  functions?: boolean;

  /**
   * Include shims for Node.js built-in modules (e.g. `path`, `fs`, `url`) to improve compatibility with existing npm packages.
   * Note: This may increase bundle size and is not necessary for all packages.
   * @default false
   */
  nodeCompat?: boolean;
}

export default function plugin(options?: AdapterOptions): Adapter;
