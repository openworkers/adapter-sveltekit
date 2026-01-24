import { Adapter } from '@sveltejs/kit';

export interface AdapterOptions {
  /**
   * Output directory for the build
   * @default 'dist'
   */
  out?: string;
}

export default function plugin(options?: AdapterOptions): Adapter;
