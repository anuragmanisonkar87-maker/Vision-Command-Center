import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, resolveTheme, THEMES, THEME_STORAGE_KEY, type ThemeKey } from "./themes";

// Baseline tokens snapshot — used to reset variables when switching back to
// Vision Classic (which has no overrides). Captured once at module load from
// the union of keys defined across non-classic themes.
const VAR_KEYS = Array.from(
  new Set(
    Object.values(THEMES).flatMap((t) => Object.keys(t.vars)),
  ),
);

let baseline: Record<string, string> | null = null;

function captureBaseline() {
  if (baseline || typeof document === "undefined") return;
  const cs = getComputedStyle(document.documentElement);
  baseline = {};
  for (const k of VAR_KEYS) baseline[k] = cs.getPropertyValue(k).trim();
}

export function applyTheme(key: ThemeKey) {
  if (typeof document === "undefined") return;
  captureBaseline();
  const root = document.documentElement;
  const theme = THEMES[key];
  // First reset all known keys to baseline
  if (baseline) {
    for (const k of VAR_KEYS) {
      if (baseline[k]) root.style.setProperty(k, baseline[k]);
      else root.style.removeProperty(k);
    }
  }
  // Then apply the theme overrides
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  root.setAttribute("data-theme", key);
}

export function getStoredTheme(): ThemeKey {
  if (typeof localStorage === "undefined") return DEFAULT_THEME;
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((key: ThemeKey) => {
    const resolved = resolveTheme(key);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      /* ignore */
    }
    setThemeState(resolved);
  }, []);

  return { theme, setTheme };
}
