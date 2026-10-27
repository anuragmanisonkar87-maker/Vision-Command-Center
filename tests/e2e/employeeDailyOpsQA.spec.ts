/**
 * Automated employee daily-ops QA.
 *
 * Runs serially in one ordered describe. Requires four env vars (loaded from
 * .env.local or /tmp/qa-creds — see docs/visual-qa-credentials.md):
 *   VISUAL_QA_ADMIN_EMAIL / VISUAL_QA_ADMIN_PASSWORD
 *   VISUAL_QA_EMPLOYEE_EMAIL / VISUAL_QA_EMPLOYEE_PASSWORD
 *
 * The employee account must be a non-admin team member with a row in
 * gwv_team_members whose linked_user_id matches the auth user.
 */
import { test, expect, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import { loginAs } from "./helpers/loginAs";
import { recordStep, writeReport } from "./helpers/qaReport";
import { deriveGeo, type Coord } from "./helpers/officeGeo";

// ---- env helpers ------------------------------------------------------------

function readDotenv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

const dotenv = readDotenv(path.resolve(".env"));
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? dotenv.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? dotenv.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const ADMIN_EMAIL = process.env.VISUAL_QA_ADMIN_EMAIL ?? "";
const ADMIN_PWD = process.env.VISUAL_QA_ADMIN_PASSWORD ?? "";
const EMP_EMAIL = process.env.VISUAL_QA_EMPLOYEE_EMAIL ?? "";
const EMP_PWD = process.env.VISUAL_QA_EMPLOYEE_PASSWORD ?? "";

const SCREEN_DIR = "test-results/employee-daily-ops";
const REPORT_PATH = path.join(SCREEN_DIR, "report.md");
fs.mkdirSync(SCREEN_DIR, { recursive: true });

const QA_RECURRING_TITLE = "QA Auto Daily Checklist Task";
const QA_DELEGATION_TITLE = "QA Employee My Task";

// ---- skip-guards ------------------------------------------------------------

const missing: string[] = [];
if (!ADMIN_EMAIL || !ADMIN_PWD) missing.push("admin creds");
if (!EMP_EMAIL || !EMP_PWD) missing.push("employee creds");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) missing.push("supabase env (.env VITE_SUPABASE_*)");

test.describe.configure({ mode: "serial" });

test.describe("Employee Daily Ops — automated QA", () => {
  test.skip(missing.length > 0, `Missing required inputs: ${missing.join(", ")}`);

  // shared state across ordered tests
  const cleanup: Array<{ table: string; id: string }> = [];
  const limitations: string[] = [];
  let adminCtx: BrowserContext;
  let empCtx: BrowserContext;
  let adminPage: Page;
  let empPage: Page;
  let adminToken = "";
  let empToken = "";
  let empUserId = "";
  let empTeamMemberId: string | null = null;
  let geo = deriveGeo(null, null, null);
  let originalAutoPromptOn = true;
  let attendanceSettingsId = "";

  // ---- helpers --------------------------------------------------------------

  async function captureBearer(page: Page): Promise<string> {
    return await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith("sb-")) continue;
        try {
          const v = JSON.parse(localStorage.getItem(key) ?? "{}");
          if (v?.access_token) return v.access_token as string;
        } catch {}
      }
      return "";
    });
  }

  async function captureUserId(page: Page): Promise<string> {
    return await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith("sb-")) continue;
        try {
          const v = JSON.parse(localStorage.getItem(key) ?? "{}");
          if (v?.user?.id) return v.user.id as string;
        } catch {}
      }
      return "";
    });
  }

  function restHeaders(token: string): Record<string, string> {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    };
  }

  async function rest(
    request: APIRequestContext,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    table: string,
    qs: string,
    body?: unknown,
    token = adminToken,
  ) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ""}`;
    const res = await request.fetch(url, {
      method,
      headers: restHeaders(token),
      data: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok(), status: res.status(), json, text };
  }

  async function screenshot(page: Page, name: string): Promise<string> {
    const p = path.join(SCREEN_DIR, name);
    try { await page.screenshot({ path: p, fullPage: false }); } catch {}
    return p;
  }

  // ---- lifecycle ------------------------------------------------------------

  test.beforeAll(async ({ browser }) => {
    adminCtx = await browser.newContext();
    empCtx = await browser.newContext();
    adminPage = await adminCtx.newPage();
    empPage = await empCtx.newPage();
  });

  test.afterAll(async ({ request }) => {
    // Cleanup all seeded rows (best-effort)
    let cleanupNote = "";
    try {
      for (const row of cleanup) {
        const r = await rest(request, "DELETE", row.table, `id=eq.${row.id}`);
        if (!r.ok) cleanupNote += `${row.table}#${row.id.slice(0, 8)} ${r.status}; `;
      }
      // Also remove any QA-named recurring template + dependent rows
      const tplRes = await rest(request, "GET", "recurring_daily_tasks",
        `title=eq.${encodeURIComponent(QA_RECURRING_TITLE)}&select=id`);
      const tplIds: string[] = Array.isArray(tplRes.json) ? tplRes.json.map((r: any) => r.id) : [];
      for (const tid of tplIds) {
        await rest(request, "DELETE", "recurring_daily_completions", `template_id=eq.${tid}`);
        await rest(request, "DELETE", "recurring_daily_points_ledger", `template_id=eq.${tid}`);
        await rest(request, "DELETE", "recurring_daily_tasks", `id=eq.${tid}`);
      }
      await rest(request, "DELETE", "delegation_tasks", `title=eq.${encodeURIComponent(QA_DELEGATION_TITLE)}`);
      // Remove any attendance rows the QA employee created today
      if (empUserId) {
        const today = new Date().toISOString().slice(0, 10);
        await rest(request, "DELETE", "gwv_attendance_records", `user_id=eq.${empUserId}&date=eq.${today}`);
      }
      recordStep("Cleanup throwaway rows", cleanupNote ? "warn" : "pass", { note: cleanupNote || `Removed ${cleanup.length} row(s)` });
    } catch (e: any) {
      recordStep("Cleanup throwaway rows", "fail", { note: e?.message ?? String(e) });
    }

    // Restore admin setting if needed
    if (attendanceSettingsId && !originalAutoPromptOn) {
      try {
        await rest(request, "PATCH", "gwv_attendance_settings", `id=eq.${attendanceSettingsId}`, {
          enable_auto_checkin_prompt: false,
        });
      } catch {}
    }

    writeReport(REPORT_PATH, { limitations });
    await adminCtx?.close();
    await empCtx?.close();
  });

  // ---- 1. Admin login + attendance settings --------------------------------

  test("1. Admin: login + ensure auto-prompt ON + read office coords", async ({ request }) => {
    try {
      await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PWD);
      adminToken = await captureBearer(adminPage);
      expect(adminToken).not.toBe("");

      // Read settings via REST (more reliable than scraping the form)
      const r = await rest(request, "GET", "gwv_attendance_settings", "select=*&limit=1");
      expect(r.ok).toBeTruthy();
      const settings = Array.isArray(r.json) ? r.json[0] : null;
      expect(settings, "no gwv_attendance_settings row").toBeTruthy();
      attendanceSettingsId = settings.id;
      originalAutoPromptOn = !!settings.enable_auto_checkin_prompt;
      geo = deriveGeo(settings.office_lat, settings.office_lng, settings.allowed_radius_meters);
      if (geo.source === "fallback") {
        limitations.push("Office coords unset — used fallback coords; geofence steps may not reflect production radius.");
      }

      // Ensure prompt ON
      if (!originalAutoPromptOn) {
        const patch = await rest(request, "PATCH", "gwv_attendance_settings",
          `id=eq.${attendanceSettingsId}`, { enable_auto_checkin_prompt: true });
        expect(patch.ok).toBeTruthy();
      }

      // Visit settings page for screenshot + visible toggle assertion
      await adminPage.goto("/settings/attendance");
      await expect(adminPage.getByText(/Auto Check-in Prompt/i)).toBeVisible({ timeout: 15_000 });
      const shot = await screenshot(adminPage, "admin-settings.png");
      recordStep("Admin settings — auto-prompt toggle visible & ON", "pass", {
        note: `office=(${geo.inside.lat.toFixed(5)}, ${geo.inside.lng.toFixed(5)}) radius=${geo.radiusMeters}m source=${geo.source}`,
        screenshot: shot,
      });
    } catch (e: any) {
      recordStep("Admin settings", "fail", { note: e?.message ?? String(e) });
      throw e;
    }
  });

  // ---- 2. Employee login + identify team_member ----------------------------

  test("2. Employee: login + capture identity", async ({ request }) => {
    try {
      await loginAs(empPage, EMP_EMAIL, EMP_PWD);
      empToken = await captureBearer(empPage);
      empUserId = await captureUserId(empPage);
      expect(empToken).not.toBe("");
      expect(empUserId).not.toBe("");

      // Look up the employee's team_member row (admin token bypasses RLS scope problems
      // since admins can read all team members; if it fails we soft-warn).
      const tm = await rest(request, "GET", "gwv_team_members",
        `select=id,linked_user_id&linked_user_id=eq.${empUserId}&limit=1`);
      if (tm.ok && Array.isArray(tm.json) && tm.json[0]) {
        empTeamMemberId = tm.json[0].id;
      } else {
        limitations.push("Could not find a gwv_team_members row whose linked_user_id matches the QA employee. Delegation/recurring seeding may have reduced fidelity.");
      }

      // Confirm employee is NOT an admin
      const roles = await rest(request, "GET", "user_roles",
        `select=role&user_id=eq.${empUserId}`, undefined, empToken);
      const isAdmin = roles.ok && Array.isArray(roles.json) && roles.json.some((r: any) => r.role === "admin");
      expect(isAdmin, "QA employee must not have admin role").toBeFalsy();

      recordStep("Employee login + identity capture", "pass", {
        note: `user=${empUserId.slice(0, 8)}… team_member=${empTeamMemberId ? empTeamMemberId.slice(0, 8) + "…" : "—"}`,
      });
    } catch (e: any) {
      recordStep("Employee login + identity", "fail", { note: e?.message ?? String(e) });
      throw e;
    }
  });

  // ---- 3. Seed throwaway recurring + delegation tasks ----------------------

  test("3. Seed throwaway tasks", async ({ request }) => {
    // Recurring daily task assigned to employee
    try {
      const empDisplay = (await rest(request, "GET", "profiles",
        `select=display_name&id=eq.${empUserId}`)).json?.[0]?.display_name ?? "QA Employee";
      const rec = await rest(request, "POST", "recurring_daily_tasks", "", {
        title: QA_RECURRING_TITLE,
        description: "Throwaway task created by automated QA. Safe to delete.",
        task_doer_user_id: empUserId,
        task_doer_team_member_id: empTeamMemberId,
        task_doer_name: empDisplay,
        points_on_completion: 5,
        negative_points_if_missed: 0,
        active: true,
      });
      if (rec.ok && rec.json?.[0]?.id) {
        cleanup.push({ table: "recurring_daily_tasks", id: rec.json[0].id });
        recordStep("Seed recurring task", "pass", { note: `id=${rec.json[0].id.slice(0, 8)}…` });
      } else {
        recordStep("Seed recurring task", "warn", { note: `HTTP ${rec.status} — ${rec.text.slice(0, 200)}` });
        limitations.push("Recurring daily task seeding failed; Daily Checklist step will be skipped.");
      }
    } catch (e: any) {
      recordStep("Seed recurring task", "fail", { note: e?.message ?? String(e) });
    }

    // Delegation task assigned to employee
    try {
      const adminUserId = await captureUserId(adminPage);
      const del = await rest(request, "POST", "delegation_tasks", "", {
        title: QA_DELEGATION_TITLE,
        description: "Throwaway task created by automated QA. Safe to delete.",
        assignee_id: empUserId,
        assignee_team_member_id: empTeamMemberId,
        created_by: adminUserId,
        priority: "low",
        difficulty: "easy",
        status: "pending",
        system_stage: "open",
        task_type: "one_off",
      });
      if (del.ok && del.json?.[0]?.id) {
        cleanup.push({ table: "delegation_tasks", id: del.json[0].id });
        recordStep("Seed delegation task", "pass", { note: `id=${del.json[0].id.slice(0, 8)}…` });
      } else {
        recordStep("Seed delegation task", "warn", { note: `HTTP ${del.status} — ${del.text.slice(0, 200)}` });
        limitations.push("Delegation task seeding failed; My Tasks step will be skipped.");
      }
    } catch (e: any) {
      recordStep("Seed delegation task", "fail", { note: e?.message ?? String(e) });
    }
  });

  // ---- 4. Employee dashboard --------------------------------------------------

  test("4. Employee dashboard renders correctly", async ({ request }) => {
    // Ensure no attendance row exists for today so the prompt can render
    const today = new Date().toISOString().slice(0, 10);
    await rest(request, "DELETE", "gwv_attendance_records", `user_id=eq.${empUserId}&date=eq.${today}`);

    await empPage.goto("/dashboard");
    await expect(empPage.getByTestId("employee-dashboard")).toBeVisible({ timeout: 15_000 });
    // Admin summary strip must not appear
    expect(await empPage.locator('[data-testid="admin-summary-strip"]').count()).toBe(0);

    for (const tid of ["card-attendance", "card-checklist", "card-mytasks", "card-points"]) {
      await expect(empPage.getByTestId(tid), `${tid} visible`).toBeVisible();
    }
    await expect(empPage.getByText(/Quick Actions/i)).toBeVisible();
    await expect(empPage.getByTestId("auto-checkin-prompt")).toBeVisible();

    const shot = await screenshot(empPage, "dashboard.png");
    recordStep("Employee dashboard — all cards + auto-prompt visible", "pass", { screenshot: shot });
  });

  // ---- 5. Inside-radius check-in -----------------------------------------

  test("5. Inside-radius check-in succeeds", async ({ request }) => {
    await empCtx.grantPermissions(["geolocation"]);
    await empCtx.setGeolocation(geo.inside as Coord);

    await empPage.goto("/dashboard");
    const btn = empPage.getByTestId("auto-checkin-button");
    await expect(btn).toBeVisible();
    await btn.click();

    // Wait for either prompt to vanish OR an error
    await empPage.waitForFunction(() => {
      const err = document.querySelector('[data-testid="auto-checkin-error"]');
      const prompt = document.querySelector('[data-testid="auto-checkin-prompt"]');
      return !!err || !prompt;
    }, undefined, { timeout: 20_000 });

    const err = await empPage.locator('[data-testid="auto-checkin-error"]').textContent().catch(() => null);
    expect(err, `inside-radius check-in error: ${err}`).toBeNull();

    // Confirm DB row
    const today = new Date().toISOString().slice(0, 10);
    const rows = await rest(request, "GET", "gwv_attendance_records",
      `select=id,check_in_at&user_id=eq.${empUserId}&date=eq.${today}`);
    expect(rows.ok).toBeTruthy();
    expect(Array.isArray(rows.json) ? rows.json.length : 0).toBe(1);

    await empPage.goto("/attendance");
    await expect(empPage.getByText(/Checked In/i).first()).toBeVisible({ timeout: 15_000 });
    const shot = await screenshot(empPage, "checked-in.png");
    recordStep("Inside-radius check-in", "pass", { screenshot: shot });
  });

  // ---- 6. Timer/refresh ---------------------------------------------------

  test("6. Timer persists across refresh, no duplicate row", async ({ request }) => {
    await empPage.goto("/attendance");
    await empPage.waitForTimeout(2500); // let timer tick
    const before = await empPage.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first().textContent();
    await empPage.reload();
    await empPage.waitForTimeout(2500);
    const after = await empPage.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first().textContent();
    expect(after).not.toBe("00:00:00");

    const today = new Date().toISOString().slice(0, 10);
    const rows = await rest(request, "GET", "gwv_attendance_records",
      `select=id&user_id=eq.${empUserId}&date=eq.${today}`);
    const n = Array.isArray(rows.json) ? rows.json.length : 0;
    expect(n).toBe(1);

    recordStep("Timer continues from DB on refresh; no duplicate row", "pass", {
      note: `before=${before} after=${after} rows=${n}`,
    });
  });

  // ---- 7. Check-out --------------------------------------------------------

  test("7. Check-out flow", async ({ request }) => {
    await empPage.goto("/attendance");
    const co = empPage.getByRole("button", { name: /check out/i });
    await expect(co).toBeVisible({ timeout: 15_000 });
    await co.click();
    await expect(empPage.getByText(/Checked Out/i).first()).toBeVisible({ timeout: 15_000 });

    await empPage.goto("/dashboard");
    expect(await empPage.locator('[data-testid="auto-checkin-prompt"]').count()).toBe(0);

    const today = new Date().toISOString().slice(0, 10);
    const rows = await rest(request, "GET", "gwv_attendance_records",
      `select=check_out_at&user_id=eq.${empUserId}&date=eq.${today}`);
    expect(rows.json?.[0]?.check_out_at).toBeTruthy();

    const shot = await screenshot(empPage, "checked-out.png");
    recordStep("Check-out & prompt does not reappear", "pass", { screenshot: shot });
  });

  // ---- 8. Outside-radius --------------------------------------------------

  test("8. Outside-radius check-in is blocked", async ({ request }) => {
    if (geo.source === "fallback") {
      recordStep("Outside-radius block", "skip", { note: "office coords unset" });
      test.skip(true, "office coords unset");
      return;
    }
    // Remove today's attendance to re-enable check-in
    const today = new Date().toISOString().slice(0, 10);
    await rest(request, "DELETE", "gwv_attendance_records", `user_id=eq.${empUserId}&date=eq.${today}`);

    await empCtx.setGeolocation(geo.outside as Coord);
    await empPage.goto("/dashboard");
    const btn = empPage.getByTestId("auto-checkin-button");
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();

    const err = empPage.getByTestId("auto-checkin-error");
    await expect(err).toBeVisible({ timeout: 15_000 });
    const txt = (await err.textContent()) ?? "";
    expect(/outside/i.test(txt)).toBeTruthy();

    const rows = await rest(request, "GET", "gwv_attendance_records",
      `select=id&user_id=eq.${empUserId}&date=eq.${today}`);
    expect(Array.isArray(rows.json) ? rows.json.length : 0).toBe(0);

    const shot = await screenshot(empPage, "outside-radius.png");
    recordStep("Outside-radius blocked with clear error", "pass", { note: txt.slice(0, 120), screenshot: shot });
  });

  // ---- 9. Permission denied ----------------------------------------------

  test("9. Location permission denied surfaces a clear error", async ({ browser, request }) => {
    const ctx = await browser.newContext({ permissions: [] });
    const page = await ctx.newPage();
    try {
      await loginAs(page, EMP_EMAIL, EMP_PWD);
      await page.goto("/dashboard");
      const btn = page.getByTestId("auto-checkin-button");
      await expect(btn).toBeVisible({ timeout: 15_000 });
      await btn.click();
      const err = page.getByTestId("auto-checkin-error");
      await expect(err).toBeVisible({ timeout: 20_000 });
      const txt = (await err.textContent()) ?? "";

      const today = new Date().toISOString().slice(0, 10);
      const rows = await rest(request, "GET", "gwv_attendance_records",
        `select=id&user_id=eq.${empUserId}&date=eq.${today}`);
      expect(Array.isArray(rows.json) ? rows.json.length : 0).toBe(0);

      const shot = await screenshot(page, "permission-denied.png");
      recordStep("Permission denied — clear error, no row created", "pass", {
        note: txt.slice(0, 120),
        screenshot: shot,
      });
    } finally {
      await ctx.close();
    }
  });

  // ---- 10. Daily Checklist -----------------------------------------------

  test("10. Daily Checklist — employee marks own task done", async () => {
    const recId = cleanup.find((r) => r.table === "recurring_daily_tasks")?.id;
    if (!recId) {
      recordStep("Daily Checklist flow", "skip", { note: "no seeded recurring task" });
      test.skip(true, "no seeded recurring task");
      return;
    }
    await empPage.goto("/daily-checklist");
    const row = empPage.locator('[data-testid="dc-row"]', { hasText: QA_RECURRING_TITLE }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    const markBtn = row.getByRole("button", { name: /mark.*done|complete/i }).first();
    if (await markBtn.count()) {
      await markBtn.click();
      await expect(row.locator('[data-testid="dc-status"][data-status="done"]')).toBeVisible({ timeout: 15_000 });
      const shot = await screenshot(empPage, "daily-checklist-done.png");
      recordStep("Daily Checklist mark done", "pass", { screenshot: shot });
    } else {
      recordStep("Daily Checklist mark done", "warn", { note: "Mark-done control not found by name; row visible." });
    }
  });

  // ---- 11. My Tasks: submit for review + admin approve -------------------

  test("11. My Tasks submit for review", async () => {
    const delId = cleanup.find((r) => r.table === "delegation_tasks")?.id;
    if (!delId) {
      recordStep("My Tasks submit for review", "skip", { note: "no seeded delegation task" });
      test.skip(true, "no seeded delegation task");
      return;
    }
    await empPage.goto("/delegation?tab=mytasks");

    const card = empPage.locator(`[data-testid="mytasks-card"][data-task-title="${QA_DELEGATION_TITLE}"]`).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Mark in progress if the control is present (idempotent)
    const startBtn = card.locator('[data-testid="mytasks-start"]');
    if (await startBtn.count()) {
      await startBtn.click();
      await empPage.waitForTimeout(500);
    }

    // Add QA proof note then submit (auto-accept the confirm dialog)
    await card.locator('[data-testid="mytasks-proof-note"]').fill("QA automation — submitted by E2E suite");
    empPage.once("dialog", (d) => d.accept());
    await card.locator('[data-testid="mytasks-submit"]').click();

    // Card should now reflect submitted stage
    const submitted = empPage.locator(
      `[data-testid="mytasks-card"][data-task-title="${QA_DELEGATION_TITLE}"][data-task-stage="submitted"]`,
    );
    await expect(submitted).toBeVisible({ timeout: 15_000 });

    const shot = await screenshot(empPage, "my-tasks-submitted.png");
    recordStep("My Tasks submit for review", "pass", { screenshot: shot });
  });

  test("11b. Admin approves submitted task", async ({ request }) => {
    const delId = cleanup.find((r) => r.table === "delegation_tasks")?.id;
    if (!delId) {
      recordStep("Admin approves submitted task", "skip", { note: "no seeded delegation task" });
      test.skip(true, "no seeded delegation task");
      return;
    }

    // Open Daily Grid + Review Queue modal
    await adminPage.goto("/delegation?tab=daily");
    const reviewBtn = adminPage.locator('[data-testid="dg-review-queue-btn"]');
    await expect(reviewBtn).toBeVisible({ timeout: 15_000 });
    await reviewBtn.click();

    const row = adminPage.locator(`[data-testid="dg-review-task"][data-task-title="${QA_DELEGATION_TITLE}"]`).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator('[data-testid="dg-review-approve"]').click();

    // Verify via REST that the task is now completed
    await adminPage.waitForTimeout(1500);
    const r = await rest(request, "GET", "delegation_tasks", `id=eq.${delId}&select=system_stage,status`);
    const stage = Array.isArray(r.json) && r.json[0]?.system_stage;
    expect(stage, `expected completed, got ${stage}`).toBe("completed");

    const shot = await screenshot(adminPage, "admin-approved.png");
    recordStep("Admin approves submitted task", "pass", { note: `stage=${stage}`, screenshot: shot });
  });


  // ---- 12. Isolation ------------------------------------------------------

  test("12. Employee is blocked from admin routes", async () => {
    const adminRoutes = ["/settings/attendance", "/settings/users", "/settings/recurring-tasks"];
    const results: string[] = [];
    for (const r of adminRoutes) {
      await empPage.goto(r);
      await empPage.waitForTimeout(1500);
      const url = empPage.url();
      const stayedOnAdmin = new URL(url).pathname === r;
      // Sniff for "Save" buttons — admin pages have them; if visible & still on path, that's a fail.
      const saveCount = await empPage.locator('button:has-text("Save")').count();
      const accessDenied = await empPage.getByText(/access denied|not authori[sz]ed|forbidden/i).count();
      const ok = !stayedOnAdmin || saveCount === 0 || accessDenied > 0;
      results.push(`${r} → ${ok ? "blocked" : "EXPOSED"} (redirected=${!stayedOnAdmin}, saveBtns=${saveCount})`);
      expect(ok, `Employee not blocked from ${r}`).toBeTruthy();
    }
    const shot = await screenshot(empPage, "isolation.png");
    recordStep("Admin routes isolation", "pass", { note: results.join(" | "), screenshot: shot });
  });
});
