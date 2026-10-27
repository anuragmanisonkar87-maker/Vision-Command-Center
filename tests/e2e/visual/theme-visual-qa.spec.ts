/**
 * Automated visual QA across every theme + key protected page.
 *
 * Run:
 *   bun run test:e2e:theme-visual
 *
 * Target defaults to the published URL. Override with E2E_BASE_URL.
 * Auth credentials come from env only:
 *   VISUAL_QA_ADMIN_EMAIL / VISUAL_QA_ADMIN_PASSWORD
 *
 * Outputs:
 *   test-results/theme-visual/<theme>/<page>.png
 *   test-results/theme-visual/report.md
 *   test-results/theme-visual/index.html
 */
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import fs from "fs";
import path from "path";
import { loginAs } from "../helpers/loginAs";

const THEMES = [
  "vision-classic",
  "modern-purple",
  "luxury-gold",
  "ocean-blue",
  "emerald-studio",
  "minimal-slate",
] as const;
type ThemeKey = (typeof THEMES)[number];

const PAGES: { name: string; path: string }[] = [
  { name: "settings-appearance", path: "/settings/appearance" },
  { name: "dashboard", path: "/dashboard" },
  { name: "settings-users", path: "/settings/users" },
  { name: "delegation", path: "/delegation" },
  { name: "delegation-my-tasks", path: "/delegation?tab=my-tasks" },
];

const OUT_DIR = path.resolve("test-results/theme-visual");
const HARMLESS = [
  /favicon/i,
  /sourcemap/i,
  /\[vite\]/i,
  /react-devtools/i,
  /Download the React DevTools/i,
];

type Issue = {
  theme: ThemeKey;
  page: string;
  kind: "load" | "console" | "overflow" | "contrast" | "button" | "theme";
  detail: string;
};
const issues: Issue[] = [];
const screenshots: { theme: ThemeKey; page: string; file: string }[] = [];
const consoleErrorsByCell: Record<string, string[]> = {};

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function parseRgb(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (parts.length < 3) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}
function relLum([r, g, b]: number[]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: number[], b: number[]) {
  const l1 = relLum(a);
  const l2 = relLum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

async function setThemeViaStorage(page: Page, theme: ThemeKey) {
  await page.evaluate((t) => localStorage.setItem("vc-theme", t), theme);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function gotoAndSettle(page: Page, target: string) {
  await page.goto(target, { waitUntil: "domcontentloaded" });
  // wait for app to render past initial loading
  await page.waitForLoadState("networkidle").catch(() => {});
  // best-effort: wait for Loading… to disappear
  await page
    .waitForFunction(
      () => !/^\s*Loading…?\s*$/i.test(document.body.innerText.trim().slice(0, 40)),
      undefined,
      { timeout: 8_000 },
    )
    .catch(() => {});
}

async function checkPage(
  page: Page,
  theme: ThemeKey,
  pg: { name: string; path: string },
  consoleErrors: string[],
) {
  const cellKey = `${theme}/${pg.name}`;
  consoleErrorsByCell[cellKey] = [];
  const collected: string[] = consoleErrorsByCell[cellKey];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (HARMLESS.some((r) => r.test(text))) return;
    collected.push(text);
    consoleErrors.push(`[${cellKey}] ${text}`);
  };
  page.on("console", consoleHandler);

  try {
    await gotoAndSettle(page, pg.path);

    // Load check
    const url = page.url();
    if (/\/login/i.test(url)) {
      issues.push({ theme, page: pg.name, kind: "load", detail: `Redirected to login: ${url}` });
    }
    const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
    if (/^\s*Loading…?\s*$/i.test(bodyText.trim().slice(0, 40))) {
      issues.push({ theme, page: pg.name, kind: "load", detail: "Stuck on Loading…" });
    }
    if (bodyText.trim().length < 30) {
      issues.push({ theme, page: pg.name, kind: "load", detail: "Main content appears empty" });
    }

    // Overflow check
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return { sw: d.scrollWidth, cw: d.clientWidth };
    });
    if (overflow.sw - overflow.cw > 8) {
      issues.push({
        theme,
        page: pg.name,
        kind: "overflow",
        detail: `Body horizontal overflow: scrollWidth=${overflow.sw} clientWidth=${overflow.cw}`,
      });
    }

    // Contrast spot-check
    const samples = await page.evaluate(() => {
      const sels = [
        "h1", "h2", "h3",
        "button",
        "[role='tab']",
        "table th",
        "table td",
        "nav a",
        "[class*='pill']",
        "p",
      ];
      const out: { sel: string; text: string; fg: string; bg: string }[] = [];
      for (const sel of sels) {
        const nodes = Array.from(document.querySelectorAll(sel)).slice(0, 3);
        for (const n of nodes) {
          const el = n as HTMLElement;
          if (!el.offsetParent && el.tagName !== "BODY") continue;
          const cs = getComputedStyle(el);
          // find effective bg
          let bg = cs.backgroundColor;
          let p: HTMLElement | null = el.parentElement;
          while (p && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
            bg = getComputedStyle(p).backgroundColor;
            p = p.parentElement;
          }
          if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = "rgb(255,255,255)";
          out.push({
            sel,
            text: (el.innerText || "").slice(0, 40),
            fg: cs.color,
            bg,
          });
        }
      }
      return out;
    });
    for (const s of samples) {
      const fg = parseRgb(s.fg);
      const bg = parseRgb(s.bg);
      if (!fg || !bg) continue;
      // skip near-transparent fg
      if (fg[3] < 0.5) continue;
      const ratio = contrast(fg, bg);
      // Threshold: 4.5 normal text. Buttons/headings still want >=3.
      const min = ["H1", "H2", "H3", "BUTTON"].includes(s.sel.toUpperCase()) ? 3 : 4.5;
      if (ratio < min) {
        issues.push({
          theme,
          page: pg.name,
          kind: "contrast",
          detail: `${s.sel} "${s.text}" fg=${s.fg} bg=${s.bg} ratio=${ratio.toFixed(2)} (<${min})`,
        });
      }
    }

    // Delegation button visibility
    if (pg.name.startsWith("delegation")) {
      const labels = ["Add row", "Save all", "Review queue", "Columns", "My Tasks"];
      for (const lbl of labels) {
        const count = await page
          .getByText(new RegExp(`^${lbl}$`, "i"))
          .count()
          .catch(() => 0);
        if (count === 0) {
          // soft warning
          issues.push({
            theme,
            page: pg.name,
            kind: "button",
            detail: `Button/label not visible: ${lbl}`,
          });
        }
      }
    }

    // Modern Purple theme check
    if (theme === "modern-purple") {
      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          gold3: cs.getPropertyValue("--gold3").trim(),
          ink: cs.getPropertyValue("--ink").trim(),
        };
      });
      if (!/7c5cff|124,\s*92,\s*255/i.test(tokens.gold3)) {
        issues.push({
          theme,
          page: pg.name,
          kind: "theme",
          detail: `modern-purple --gold3 not violet, got "${tokens.gold3}"`,
        });
      }
    }

    // Screenshot
    const themeDir = path.join(OUT_DIR, theme);
    ensureDir(themeDir);
    const file = path.join(themeDir, `${pg.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    screenshots.push({ theme, page: pg.name, file: path.relative(OUT_DIR, file) });
  } finally {
    page.off("console", consoleHandler);
  }
}

test.describe("Theme visual QA", () => {
  test.setTimeout(15 * 60_000);

  test("all themes x all pages", async ({ page }, testInfo) => {
    const email = process.env.VISUAL_QA_ADMIN_EMAIL;
    const password = process.env.VISUAL_QA_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Missing QA credentials. Create a temporary QA admin account and add credentials to .env.local or /tmp/qa-creds, then rerun.",
      );
    }



    ensureDir(OUT_DIR);
    const consoleErrors: string[] = [];

    await loginAs(page, email, password);

    // Sanity: apply theme via /settings/appearance button (once)
    await page.goto("/settings/appearance");
    const applyBtn = page.getByRole("button", { name: /^apply theme$/i }).first();
    if (await applyBtn.count()) {
      await applyBtn.click().catch(() => {});
    }

    for (const theme of THEMES) {
      await setThemeViaStorage(page, theme);
      for (const pg of PAGES) {
        await checkPage(page, theme, pg, consoleErrors);
      }
    }

    // Build report
    const baseURL = testInfo.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "(default)";
    const hard = issues.filter((i) => i.kind === "load");
    const md: string[] = [];
    md.push(`# Theme Visual QA Report`);
    md.push(``);
    md.push(`- Run: ${new Date().toISOString()}`);
    md.push(`- Base URL: ${baseURL}`);
    md.push(`- Browser: chromium`);
    md.push(`- Themes: ${THEMES.join(", ")}`);
    md.push(`- Pages: ${PAGES.map((p) => p.name).join(", ")}`);
    md.push(`- Screenshots: ${screenshots.length}`);
    md.push(``);
    md.push(`## Summary`);
    md.push(`- Load failures: ${issues.filter((i) => i.kind === "load").length}`);
    md.push(`- Overflow: ${issues.filter((i) => i.kind === "overflow").length}`);
    md.push(`- Contrast warnings: ${issues.filter((i) => i.kind === "contrast").length}`);
    md.push(`- Button visibility: ${issues.filter((i) => i.kind === "button").length}`);
    md.push(`- Theme-token: ${issues.filter((i) => i.kind === "theme").length}`);
    md.push(`- Console errors: ${consoleErrors.length}`);
    md.push(``);
    md.push(`## Final: ${hard.length === 0 ? "PASS ✅" : "FAIL ❌"}`);
    md.push(``);
    if (issues.length) {
      md.push(`## Issues`);
      for (const i of issues) {
        md.push(`- [${i.kind}] **${i.theme}** / ${i.page} — ${i.detail}`);
      }
      md.push(``);
    }
    if (consoleErrors.length) {
      md.push(`## Console errors`);
      for (const e of consoleErrors) md.push(`- ${e}`);
      md.push(``);
    }
    md.push(`## Screenshots`);
    for (const s of screenshots) md.push(`- ${s.theme}/${s.page} → ${s.file}`);
    fs.writeFileSync(path.join(OUT_DIR, "report.md"), md.join("\n"), "utf8");

    // HTML gallery
    const htmlParts: string[] = [
      `<!doctype html><meta charset="utf-8"><title>Theme Visual QA</title>`,
      `<style>body{font-family:system-ui;margin:24px;background:#f7f7f9}h1{margin:0 0 8px}h2{margin-top:32px}img{max-width:100%;border:1px solid #ddd;border-radius:6px}.cell{margin:16px 0;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.06)}.warn{color:#a15c00;font-size:12px;margin-top:6px}.err{color:#b00020;font-size:12px;margin-top:6px}</style>`,
      `<h1>Theme Visual QA</h1>`,
      `<div>Run: ${new Date().toISOString()} · Base: ${baseURL} · Status: ${hard.length === 0 ? "PASS ✅" : "FAIL ❌"}</div>`,
    ];
    for (const theme of THEMES) {
      htmlParts.push(`<h2>${theme}</h2>`);
      for (const pg of PAGES) {
        const shot = screenshots.find((s) => s.theme === theme && s.page === pg.name);
        const cellIssues = issues.filter((i) => i.theme === theme && i.page === pg.name);
        const cellErrs = consoleErrorsByCell[`${theme}/${pg.name}`] || [];
        htmlParts.push(`<div class="cell"><div><b>${pg.name}</b> — ${pg.path}</div>`);
        if (shot) htmlParts.push(`<img src="${shot.file}" loading="lazy" />`);
        for (const i of cellIssues) htmlParts.push(`<div class="warn">[${i.kind}] ${i.detail}</div>`);
        for (const e of cellErrs) htmlParts.push(`<div class="err">console: ${e}</div>`);
        htmlParts.push(`</div>`);
      }
    }
    fs.writeFileSync(path.join(OUT_DIR, "index.html"), htmlParts.join("\n"), "utf8");

    // Hard fail only on load/auth failures
    expect(hard, `Load/auth failures:\n${hard.map((i) => `${i.theme}/${i.page}: ${i.detail}`).join("\n")}`).toHaveLength(0);
  });
});
