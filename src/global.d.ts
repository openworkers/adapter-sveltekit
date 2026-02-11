declare global {
  // Extend globalThis with env for SvelteKit
  var env: { ASSETS: BindingAssets; [key: string]: any };

  // Build-time constants (defined via esbuild)
  const WITH_COOKIES: boolean;
  const WITH_PARAMS: boolean;
  const ROUTE_PATTERN: string;

  // Cache API types (not available in OpenWorkers runtime)
  var caches: CacheStorage | undefined;
}

export {};
