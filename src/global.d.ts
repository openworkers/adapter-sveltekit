declare global {
  // Extend globalThis with env for SvelteKit
  var env: { ASSETS: BindingAssets } | undefined;
}

export {};
