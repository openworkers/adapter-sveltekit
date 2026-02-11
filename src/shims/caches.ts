// Shim caches API (not available in OpenWorkers)
if (typeof caches === 'undefined') {
  const noopCache: Cache = {
    match: async () => undefined,
    put: async () => {},
    delete: async () => false
  } as any;

  (globalThis as any).caches = {
    default: noopCache,
    open: async () => noopCache
  };
}
