// Vision Center theme system.
// Each theme overrides a small set of CSS variables already used across the app
// (sidebar, surfaces, accents, borders). Applied by setting CSS custom
// properties on <html>; no component code changes required.

export type ThemeKey =
  | "vision-classic"
  | "modern-purple"
  | "luxury-gold"
  | "ocean-blue"
  | "emerald-studio"
  | "minimal-slate";

export const DEFAULT_THEME: ThemeKey = "vision-classic";

export type ThemeDef = {
  key: ThemeKey;
  name: string;
  description: string;
  swatches: string[]; // for preview cards
  vars: Record<string, string>; // CSS var overrides applied to :root
};

// Variable surface kept intentionally small — only tokens already referenced
// in styles.css and inline styles. Keep contrast safe: dark sidebar tokens
// (--ink, --ink2) always pair with light text; light surfaces always pair
// with --ink for body text.
export const THEMES: Record<ThemeKey, ThemeDef> = {
  "vision-classic": {
    key: "vision-classic",
    name: "Vision Classic",
    description: "Clean default Vision Center look — ivory, gold, dark ink.",
    swatches: ["#1C1814", "#C9973A", "#F5F0E8", "#FDFAF4"],
    vars: {}, // baseline — no overrides
  },
  "modern-purple": {
    key: "modern-purple",
    name: "Modern Purple",
    description: "Modern, youthful, premium workspace — violet accents on ivory.",
    swatches: ["#1B1530", "#7C5CFF", "#EFEAFF", "#FFFFFF"],
    vars: {
      "--parchment": "#F7F4FB",
      "--parchment2": "#EEE7F8",
      "--parchment3": "#E2D8F3",
      "--ivory": "#FFFFFF",
      "--ink": "#1B1530",
      "--ink2": "#2A2148",
      "--ink3": "#5C5375",
      "--ink4": "#8E85A4",
      "--gold": "#5A3FD6",
      "--gold2": "#6E50EE",
      "--gold3": "#7C5CFF",
      "--gold-bg": "rgba(124,92,255,.10)",
      "--gold-border": "rgba(124,92,255,.28)",
      "--border": "#E0D7EF",
      "--border2": "#CDC0E4",
      "--brand-ipc": "#7C5CFF",
    },
  },
  "luxury-gold": {
    key: "luxury-gold",
    name: "Luxury Gold",
    description: "Executive, premium, focused — charcoal with rich gold.",
    swatches: ["#0F0E0C", "#D4A84B", "#F5F0E3", "#FFFBF0"],
    vars: {
      "--parchment": "#F5F0E3",
      "--parchment2": "#EBE4D0",
      "--parchment3": "#E0D6BC",
      "--ivory": "#FFFBF0",
      "--ink": "#0F0E0C",
      "--ink2": "#2A2520",
      "--ink3": "#5C544A",
      "--ink4": "#8E867A",
      "--gold": "#7A5810",
      "--gold2": "#B08828",
      "--gold3": "#D4A84B",
      "--gold-bg": "rgba(212,168,75,.10)",
      "--gold-border": "rgba(212,168,75,.32)",
      "--border": "#D8CDB4",
      "--border2": "#C8BC9E",
    },
  },
  "ocean-blue": {
    key: "ocean-blue",
    name: "Ocean Blue",
    description: "Fresh, trustworthy, clean — slate with bright ocean blue.",
    swatches: ["#0C2340", "#2E7CE0", "#EEF4FB", "#FFFFFF"],
    vars: {
      "--parchment": "#F2F6FB",
      "--parchment2": "#E6EEF8",
      "--parchment3": "#D6E2F1",
      "--ivory": "#FFFFFF",
      "--ink": "#0C2340",
      "--ink2": "#1B3A5F",
      "--ink3": "#4F6580",
      "--ink4": "#8395AB",
      "--gold": "#1E5BA8",
      "--gold2": "#2570CB",
      "--gold3": "#2E7CE0",
      "--gold-bg": "rgba(46,124,224,.10)",
      "--gold-border": "rgba(46,124,224,.30)",
      "--border": "#D5DFEC",
      "--border2": "#BFCDDF",
    },
  },
  "emerald-studio": {
    key: "emerald-studio",
    name: "Emerald Studio",
    description: "Calm, focused, professional — emerald on warm ivory.",
    swatches: ["#0E2A20", "#1F8A5E", "#EDF5F0", "#FFFFFF"],
    vars: {
      "--parchment": "#F1F6F2",
      "--parchment2": "#E3EEE7",
      "--parchment3": "#D2E2D8",
      "--ivory": "#FFFFFF",
      "--ink": "#0E2A20",
      "--ink2": "#1B4233",
      "--ink3": "#4D6B5E",
      "--ink4": "#849A8F",
      "--gold": "#196B49",
      "--gold2": "#1A7B53",
      "--gold3": "#1F8A5E",
      "--gold-bg": "rgba(31,138,94,.10)",
      "--gold-border": "rgba(31,138,94,.28)",
      "--border": "#D3E1D8",
      "--border2": "#BDCFC4",
    },
  },
  "minimal-slate": {
    key: "minimal-slate",
    name: "Minimal Slate",
    description: "Neutral, minimal, highly readable — slate grey & navy.",
    swatches: ["#1A1F2B", "#3B82F6", "#F4F5F7", "#FFFFFF"],
    vars: {
      "--parchment": "#F4F5F7",
      "--parchment2": "#E8EAEE",
      "--parchment3": "#D9DCE3",
      "--ivory": "#FFFFFF",
      "--ink": "#1A1F2B",
      "--ink2": "#2C3340",
      "--ink3": "#56607A",
      "--ink4": "#8892A6",
      "--gold": "#2563EB",
      "--gold2": "#3171F0",
      "--gold3": "#3B82F6",
      "--gold-bg": "rgba(59,130,246,.10)",
      "--gold-border": "rgba(59,130,246,.28)",
      "--border": "#DDE0E6",
      "--border2": "#C7CBD4",
    },
  },
};

export const THEME_LIST: ThemeDef[] = Object.values(THEMES);

export function resolveTheme(key: string | null | undefined): ThemeKey {
  if (key && key in THEMES) return key as ThemeKey;
  return DEFAULT_THEME;
}

export const THEME_STORAGE_KEY = "vc-theme";
