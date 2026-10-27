import { describe, it, expect } from "vitest";
import { DEFAULT_THEME, resolveTheme, THEMES, THEME_LIST, THEME_STORAGE_KEY } from "@/lib/theme/themes";

describe("theme system", () => {
  it("has 6 themes", () => {
    expect(THEME_LIST.length).toBe(6);
  });

  it("includes all required themes", () => {
    const keys = THEME_LIST.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "vision-classic",
        "modern-purple",
        "luxury-gold",
        "ocean-blue",
        "emerald-studio",
        "minimal-slate",
      ]),
    );
  });

  it("default theme is vision-classic", () => {
    expect(DEFAULT_THEME).toBe("vision-classic");
  });

  it("vision-classic has no var overrides (baseline)", () => {
    expect(Object.keys(THEMES["vision-classic"].vars).length).toBe(0);
  });

  it("resolveTheme returns key when valid", () => {
    expect(resolveTheme("modern-purple")).toBe("modern-purple");
    expect(resolveTheme("luxury-gold")).toBe("luxury-gold");
  });

  it("resolveTheme falls back to vision-classic for invalid / nullish input", () => {
    expect(resolveTheme("does-not-exist")).toBe("vision-classic");
    expect(resolveTheme(null)).toBe("vision-classic");
    expect(resolveTheme(undefined)).toBe("vision-classic");
    expect(resolveTheme("")).toBe("vision-classic");
  });

  it("each non-default theme overrides the core readable tokens (--ink, surfaces, accent)", () => {
    for (const t of THEME_LIST) {
      if (t.key === "vision-classic") continue;
      expect(t.vars["--ink"], `${t.key} --ink`).toBeTruthy();
      expect(t.vars["--parchment"], `${t.key} --parchment`).toBeTruthy();
      expect(t.vars["--ivory"], `${t.key} --ivory`).toBeTruthy();
      expect(t.vars["--gold3"], `${t.key} --gold3`).toBeTruthy();
    }
  });

  it("each theme has 4 swatches and metadata", () => {
    for (const t of THEME_LIST) {
      expect(t.swatches.length).toBe(4);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("storage key is stable", () => {
    expect(THEME_STORAGE_KEY).toBe("vc-theme");
  });
});
