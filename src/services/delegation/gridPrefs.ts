// LocalStorage-backed user preferences for the Delegation grid:
// column widths, hidden columns, and row density. Kept dependency-free for
// unit testing — pass in a Storage-like object when needed.

export type Density = "compact" | "comfortable" | "spacious";

const KEY_WIDTHS = "delegation.grid.widths.v1";
const KEY_HIDDEN = "delegation.grid.hidden.v1";
const KEY_DENSITY = "delegation.grid.density.v1";
const KEY_LABELS = "delegation.grid.labels.v1";
const KEY_LAYOUT_VERSION = "delegation.grid.layoutVersion.v3";

type Store = Pick<Storage, "getItem" | "setItem">;

const safeStore = (): Store | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadWidths(store: Store | null = safeStore()): Record<string, number> {
  if (!store) return {};
  try {
    const raw = store.getItem(KEY_WIDTHS);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveWidths(widths: Record<string, number>, store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY_WIDTHS, JSON.stringify(widths));
  } catch {
    /* ignore quota */
  }
}

export function clampWidth(w: number): number {
  return Math.max(60, Math.min(640, Math.round(w)));
}

export function loadHidden(store: Store | null = safeStore()): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(KEY_HIDDEN);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveHidden(keys: string[], store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY_HIDDEN, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function toggleHiddenKey(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

export function loadDensity(store: Store | null = safeStore()): Density {
  if (!store) return "comfortable";
  try {
    const raw = store.getItem(KEY_DENSITY);
    if (raw === "compact" || raw === "comfortable" || raw === "spacious") return raw;
  } catch {
    /* ignore */
  }
  return "comfortable";
}

export function saveDensity(d: Density, store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    store.setItem(KEY_DENSITY, d);
  } catch {
    /* ignore */
  }
}

export const DENSITY_ROW_HEIGHT: Record<Density, number> = {
  compact: 28,
  comfortable: 36,
  spacious: 46,
};

/** Columns considered structural — never user-hideable. */
export const ALWAYS_VISIBLE_KEYS = new Set<string>([
  "row_no",
  "assignee_id",
  "title",
  "due_date",
  "revision_1_date",
  "revision_2_date",
  "final_date",
  "actions",
]);

export function isHidable(key: string): boolean {
  return !ALWAYS_VISIBLE_KEYS.has(key);
}

/* ── label overrides (rename header display labels) ── */

export function loadLabels(store: Store | null = safeStore()): Record<string, string> {
  if (!store) return {};
  try {
    const raw = store.getItem(KEY_LABELS);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

export function saveLabels(labels: Record<string, string>, store: Store | null = safeStore()): void {
  if (!store) return;
  try { store.setItem(KEY_LABELS, JSON.stringify(labels)); } catch { /* ignore */ }
}

export function setLabel(labels: Record<string, string>, key: string, label: string): Record<string, string> {
  const next = { ...labels };
  if (label.trim()) next[key] = label.trim();
  else delete next[key];
  return next;
}

/** Reset visibility — remove all hidden keys. */
export function resetHidden(store: Store | null = safeStore()): void {
  if (!store) return;
  try { store.setItem(KEY_HIDDEN, "[]"); } catch { /* ignore */ }
}

/** One-time migration for older broken local layout prefs. */
export function migrateLayoutPrefs(store: Store | null = safeStore()): void {
  if (!store) return;
  try {
    if (store.getItem(KEY_LAYOUT_VERSION) === "3") return;
    store.setItem(KEY_HIDDEN, "[]");
    store.setItem(KEY_WIDTHS, "{}");
    store.setItem(KEY_LABELS, "{}");
    store.setItem(KEY_LAYOUT_VERSION, "3");
  } catch { /* ignore */ }
}
