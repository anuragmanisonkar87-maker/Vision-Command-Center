/**
 * Lightweight smoke tests for GWV Vision Center.
 *
 * Scope (read-only, non-destructive):
 *   1. /login page renders.
 *   2. If admin QA env credentials are present, sign in and verify the admin
 *      sidebar shows the expected items and hides nothing it shouldn't.
 *   3. If employee QA env credentials are present, sign in and verify the
 *      employee sidebar shows the expected items and HIDES admin-only items.
 *   4. A small list of critical routes load without crashing for each role.
 *
 * These are smoke tests only — they verify route load + sidebar visibility,
 * not full business logic. They are NOT a substitute for unit/integration tests.
 *
 * Run locally:
 *   bun run test:smoke
 *
 * Credentials are read from .env.local or /tmp/qa-creds via playwright.config.ts
 * (keys: VISUAL_QA_ADMIN_EMAIL, VISUAL_QA_ADMIN_PASSWORD,
 *        VISUAL_QA_EMPLOYEE_EMAIL, VISUAL_QA_EMPLOYEE_PASSWORD).
 * Never commit credentials.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../helpers/loginAs";

const ADMIN_EMAIL = process.env.VISUAL_QA_ADMIN_EMAIL ?? process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.VISUAL_QA_ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;
const EMP_EMAIL = process.env.VISUAL_QA_EMPLOYEE_EMAIL ?? process.env.E2E_EMPLOYEE_EMAIL;
const EMP_PASSWORD = process.env.VISUAL_QA_EMPLOYEE_PASSWORD ?? process.env.E2E_EMPLOYEE_PASSWORD;

const ADMIN_SIDEBAR_VISIBLE = [
  "Dashboard",
  "Attendance",
  "Daily Checklist",
  "Task Manager",
  "Delegation Command Center",
  "HR Command Center",
  "Appearance",
];

const EMPLOYEE_SIDEBAR_VISIBLE = [
  "Dashboard",
  "Attendance",
  "Daily Checklist",
  "Delegation Command Center",
];

// These items are admin-only and must NOT appear for employees.
const EMPLOYEE_SIDEBAR_HIDDEN = [
  "Recurring Daily Tasks",
  "Users & Roles",
  "Brand Management",
];

const ADMIN_ROUTES = [
  "/dashboard",
  "/attendance",
  "/daily-checklist",
  "/delegation",
  "/settings/attendance",
  "/settings/users",
];

const EMPLOYEE_ROUTES = [
  "/dashboard",
  "/attendance",
  "/daily-checklist",
  "/delegation",
];

async function expectSidebarItems(page: Page, labels: string[]) {
  for (const label of labels) {
    await expect(
      page.getByRole("link", { name: new RegExp(`^\\s*${escapeRe(label)}\\s*$`, "i") }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}

async function expectSidebarHidden(page: Page, labels: string[]) {
  for (const label of labels) {
    await expect(
      page.getByRole("link", { name: new RegExp(`^\\s*${escapeRe(label)}\\s*$`, "i") }),
    ).toHaveCount(0);
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Smoke — public", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: /sign in/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Smoke — admin", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Admin QA credentials missing (set VISUAL_QA_ADMIN_EMAIL / VISUAL_QA_ADMIN_PASSWORD in .env.local).",
  );

  test("admin sidebar shows expected items + critical routes load", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto("/dashboard");
    await expectSidebarItems(page, ADMIN_SIDEBAR_VISIBLE);

    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      // The route mounted if we did not get bounced to /login.
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 15_000 });
    }
  });
});

test.describe("Smoke — employee", () => {
  test.skip(
    !EMP_EMAIL || !EMP_PASSWORD,
    "Employee QA credentials missing (set VISUAL_QA_EMPLOYEE_EMAIL / VISUAL_QA_EMPLOYEE_PASSWORD in .env.local).",
  );

  test("employee sidebar shows allowed items, hides admin-only items, routes load", async ({ page }) => {
    await loginAs(page, EMP_EMAIL!, EMP_PASSWORD!);
    await page.goto("/dashboard");
    await expectSidebarItems(page, EMPLOYEE_SIDEBAR_VISIBLE);
    await expectSidebarHidden(page, EMPLOYEE_SIDEBAR_HIDDEN);

    for (const route of EMPLOYEE_ROUTES) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 15_000 });
    }
  });
});
