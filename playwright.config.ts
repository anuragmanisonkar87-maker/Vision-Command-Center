import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Load QA credentials from gitignored local files (never from chat / committed code).
 * Priority: existing process.env  >  .env.local  >  /tmp/qa-creds.json  >  /tmp/qa-creds
 * Supported keys:
 *   VISUAL_QA_ADMIN_EMAIL, VISUAL_QA_ADMIN_PASSWORD,
 *   VISUAL_QA_EMPLOYEE_EMAIL, VISUAL_QA_EMPLOYEE_PASSWORD
 */
function loadLocalCreds() {
  const keys = [
    "VISUAL_QA_ADMIN_EMAIL",
    "VISUAL_QA_ADMIN_PASSWORD",
    "VISUAL_QA_EMPLOYEE_EMAIL",
    "VISUAL_QA_EMPLOYEE_PASSWORD",
  ] as const;
  const setIfMissing = (k: string, v: string | undefined) => {
    if (!v) return;
    if (!process.env[k]) process.env[k] = v;
  };

  // .env.local (KEY=VALUE per line)
  const envLocal = path.resolve(".env.local");
  if (fs.existsSync(envLocal)) {
    for (const raw of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (keys.includes(k as (typeof keys)[number])) setIfMissing(k, v);
    }
  }

  // /tmp/qa-creds.json or /tmp/qa-creds (KEY=VALUE)
  for (const p of ["/tmp/qa-creds.json", "/tmp/qa-creds"]) {
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    try {
      const obj = JSON.parse(txt);
      for (const k of keys) setIfMissing(k, obj?.[k]);
    } catch {
      for (const raw of txt.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim();
        if (keys.includes(k as (typeof keys)[number])) setIfMissing(k, v);
      }
    }
  }
}
loadLocalCreds();

const BASE_URL =
  process.env.E2E_BASE_URL ??
  "https://gwvvisioncenter.lovable.app";

// Preflight (no secret values printed)
const present = (k: string) => (process.env[k] ? "yes" : "no");
const loginHelperFound = fs.existsSync(path.resolve("tests/e2e/helpers/loginAs.ts"));
// eslint-disable-next-line no-console
console.log(
  `[visual-qa preflight] base=${BASE_URL} | admin email: ${present("VISUAL_QA_ADMIN_EMAIL")} | admin pwd: ${present("VISUAL_QA_ADMIN_PASSWORD")} | employee email: ${present("VISUAL_QA_EMPLOYEE_EMAIL")} | employee pwd: ${present("VISUAL_QA_EMPLOYEE_PASSWORD")} | login helper: ${loginHelperFound ? "yes" : "no"}`,
);


export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1280, height: 800 },
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
