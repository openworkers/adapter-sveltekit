declare module 'SERVER' {
  export const Server: typeof import('@sveltejs/kit').Server;
  export const manifest: import('@sveltejs/kit').SSRManifest;
  export const prerendered: Set<string>;
  export const base_path: string;
}
