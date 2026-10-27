// Persistent user preference for Delegation grid column order.
// Order is stored as a list of column keys; unknown/new keys append at the end.
// The first column (row_no) is locked and never reorderable.

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY_ORDER = "delegation.grid.order.v1";

const safeStore = (): Store | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const LOCKED_FIRST_KEYS = ["row_no"] as const;

export function isLockedFirst(key: string): boolean {
  return (LOCKED_FIRST_KEYS as readonly string[]).includes(key);
}

export function loadOrder(store: Store | null = safeStore()): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(KEY_ORDER);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(keys: string[], store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY_ORDER, JSON.stringify(keys));
  } catch {
    /* ignore quota */
  }
}

export function resetOrder(store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    store.removeItem(KEY_ORDER);
  } catch {
    /* ignore */
  }
}

/**
 * Apply a saved order to a list of columns. Locked-first keys are pinned
 * to the head in their natural order; remaining columns follow the saved
 * order; any unknown keys append at the end in their original order.
 */
export function applyOrder<T extends { key: string }>(cols: T[], order: string[]): T[] {
  const byKey = new Map(cols.map((c) => [c.key, c] as const));
  const used = new Set<string>();
  const head: T[] = [];
  for (const k of LOCKED_FIRST_KEYS) {
    const c = byKey.get(k);
    if (c) { head.push(c); used.add(k); }
  }
  const ordered: T[] = [];
  for (const k of order) {
    if (used.has(k)) continue;
    const c = byKey.get(k);
    if (c) { ordered.push(c); used.add(k); }
  }
  const tail: T[] = [];
  for (const c of cols) {
    if (!used.has(c.key)) tail.push(c);
  }
  return [...head, ...ordered, ...tail];
}

/**
 * Move a column from one index to another in the visible order, respecting
 * locked-first columns (which cannot be moved and cannot be displaced).
 * Both indexes refer to positions in the current `keys` list.
 */
export function reorderKeys(keys: string[], fromIdx: number, toIdx: number): string[] {
  if (fromIdx === toIdx) return keys;
  if (fromIdx < 0 || fromIdx >= keys.length) return keys;
  const movingKey = keys[fromIdx];
  if (isLockedFirst(movingKey)) return keys;
  // Clamp drop position so it cannot land before the last locked column.
  const lockedCount = keys.filter((k) => isLockedFirst(k)).length;
  const safeTo = Math.max(lockedCount, Math.min(keys.length - 1, toIdx));
  const next = keys.slice();
  next.splice(fromIdx, 1);
  const adjusted = fromIdx < safeTo ? safeTo : safeTo;
  next.splice(adjusted, 0, movingKey);
  return next;
}
