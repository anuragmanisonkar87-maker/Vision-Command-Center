// Tiny in-memory TTL promise cache. Used by route loaders to warm data
// during hover/intent preload, then by components to read it instantly.
// Promises are cached (not just resolved values) so concurrent callers
// dedupe on the same in-flight request.

type Entry = { p: Promise<any>; t: number };
const store = new Map<string, Entry>();

export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.t < ttlMs) return hit.p as Promise<T>;
  const p = fn().catch((e) => {
    // Do not cache failures.
    if (store.get(key)?.p === p) store.delete(key);
    throw e;
  });
  store.set(key, { p, t: now });
  return p;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { store.clear(); return; }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
