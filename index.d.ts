import { Adapter } from '@sveltejs/kit';

export interface AdapterOptions {
  /**
   * Output directory for the build
   * @default 'dist'
   */
  out?: string;

  /**
   * Generate separate mini-workers for each API route.
   * Outputs to `dist/functions/` with routing info in `routes.js`.
   * @default false
   */
  functions?: boolean;
}

export default function plugin(options?: AdapterOptions): Adapter;
