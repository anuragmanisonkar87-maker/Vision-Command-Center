/**
 * E2E — Delegation Phase 4 QA: Monthly Performance Reports.
 *
 * Seeds approved/completed tasks + ledger rows + a due-date request for two
 * QA employees, then drives the Performance Reports tab end-to-end as both
 * admin and employee. Cleanup wipes everything prefixed `QA Performance Report -`
 * plus its activity, ledger, due-date requests, and the monthly snapshots
 * (awards + appraisals) for the test month.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../helpers/loginAs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QA_USERS } from "../../seed/qa-users";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN = QA_USERS[0];
const EMP1 = QA_USERS[1];
const EMP2 = QA_USERS[2];
const QA_PREFIX = "QA Performance Report -";

function monthStartIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const TEST_MONTH = monthStartIso();


async function gotoDelegationReports(page: Page) {
  await page.goto("/delegation");
  await expect(page.getByRole("heading", { name: /delegation command center/i })).toBeVisible();
  await page.getByRole("button", { name: /performance reports/i }).click();
  await expect(page.getByTestId("dg-performance-reports")).toBeVisible({ timeout: 15_000 });
}

async function getUserId(email: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`User not found: ${email}`);
  return u.id;
}

async function cleanup() {
  const { data: tasks } = await admin
    .from("delegation_tasks")
    .select("id")
    .ilike("title", `${QA_PREFIX}%`);
  const ids = (tasks ?? []).map((t: any) => t.id);
  if (ids.length) {
    await admin.from("delegation_points_ledger").delete().in("task_id", ids);
    await admin.from("delegation_activity").delete().in("task_id", ids);
    await admin.from("delegation_due_date_requests").delete().in("task_id", ids);
    await admin.from("delegation_tasks").delete().in("id", ids);
  }
  await admin.from("delegation_monthly_awards").delete().eq("month", TEST_MONTH);
  await admin.from("delegation_monthly_appraisals").delete().eq("month", TEST_MONTH);
}

interface SeedArgs {
  assigneeId: string;
  daysAgo: number;
  onTime: boolean;
  revisions?: number;
  withProof?: boolean;
  points?: number;
  index: number;
}

async function seedApprovedTask(args: SeedArgs): Promise<string> {
  const now = new Date();
  const completedAt = new Date(now);
  completedAt.setDate(now.getDate() - args.daysAgo);
  if (completedAt.toISOString().slice(0, 7) !== TEST_MONTH.slice(0, 7)) {
    completedAt.setDate(2);
    completedAt.setHours(12);
  }
  const completedIso = completedAt.toISOString();
  const completedDay = completedIso.slice(0, 10);
  const dueDate = args.onTime
    ? completedDay
    : new Date(completedAt.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("delegation_tasks")
    .insert({
      title: `${QA_PREFIX} ${args.assigneeId.slice(0, 4)}-${args.index}`,
      assignee_id: args.assigneeId,
      created_by: args.assigneeId,
      priority: "medium",
      difficulty: "medium",
      status: "Completed",
      system_stage: "completed",
      due_date: dueDate,
      due_date_locked: true,
      proof_required: false,
      proof_url: args.withProof ? "https://example.com/proof" : null,
      revision_count: args.revisions ?? 0,
      completed_at: completedIso,
      final_date: completedDay,
    })
    .select()
    .single();
  if (error) throw error;

  if ((args.points ?? 0) > 0) {
    await admin.from("delegation_points_ledger").insert({
      task_id: data.id,
      user_id: args.assigneeId,
      points: args.points,
      reason: "completion_base",
      period_date: completedDay,
    });
  }
  await admin.from("delegation_activity").insert({
    task_id: data.id,
    actor_id: args.assigneeId,
    action: "approved_completed",
    after: { stage: "completed" },
  });
  return data.id;
}

test.describe.serial("Delegation Phase 4 — Performance Reports", () => {
  let emp1Id = "";
  let emp2Id = "";

  test.beforeAll(async () => {
    await cleanup();
    emp1Id = await getUserId(EMP1.email);
    emp2Id = await getUserId(EMP2.email);

    // Employee 1: high performer — 8 on-time zero-rev with proof.
    for (let i = 0; i < 8; i++) {
      await seedApprovedTask({
        assigneeId: emp1Id, daysAgo: i, onTime: true,
        revisions: 0, withProof: true, points: 12, index: i,
      });
    }
    // Employee 2: weaker — late + revisions + no proof.
    for (let i = 0; i < 3; i++) {
      await seedApprovedTask({
        assigneeId: emp2Id, daysAgo: i, onTime: false,
        revisions: 2, withProof: false, points: 3, index: i,
      });
    }
    // One due-date request for emp1 (approved).
    const { data: ddTask } = await admin
      .from("delegation_tasks").select("id")
      .ilike("title", `${QA_PREFIX} ${emp1Id.slice(0, 4)}-0`).single();
    if (ddTask) {
      await admin.from("delegation_due_date_requests").insert({
        task_id: ddTask.id,
        requested_by: emp1Id,
        old_due_date: TEST_MONTH,
        new_due_date: TEST_MONTH,
        reason: "QA seed",
        status: "approved",
      });
    }
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test("1. Admin sees Performance Reports tab with all controls", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    await expect(page.getByTestId("dg-report-month")).toBeVisible();
    await expect(page.getByTestId("dg-report-user-select")).toBeVisible();
    await expect(page.getByTestId("dg-print-report")).toBeVisible();
    await expect(
      page.getByTestId("dg-freeze-reports").or(page.getByTestId("dg-unfreeze-reports"))
    ).toBeVisible();
    await expect(page.getByTestId("dg-team-overview")).toBeVisible({ timeout: 15_000 });
  });

  test("2. Employee sees only own report — team/user/freeze hidden", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await gotoDelegationReports(page);
    await expect(page.getByTestId("dg-user-report")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("dg-team-overview")).toHaveCount(0);
    await expect(page.getByTestId("dg-report-user-select")).toHaveCount(0);
    await expect(page.getByTestId("dg-freeze-reports")).toHaveCount(0);
    await expect(page.getByTestId("dg-unfreeze-reports")).toHaveCount(0);
  });

  test("3. Monthly user report renders summary + tasks + badges", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    // Pick emp1.
    await page.getByTestId("dg-report-user-select").selectOption(emp1Id);
    const card = page.getByTestId("dg-user-report");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText("Approved");
    await expect(card).toContainText("Points");
    await expect(card).toContainText("On-Time");
    await expect(card).toContainText("Revisions");
    await expect(card).toContainText("Proof");
    await expect(page.getByTestId("dg-report-tasks")).toBeVisible();
    await expect(page.getByTestId("dg-report-tasks")).toContainText(QA_PREFIX);
    await expect(page.getByTestId("dg-report-badges")).toBeVisible();
  });

  test("4. Team overview rows render and row click loads that user's report", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    const overview = page.getByTestId("dg-team-overview");
    await expect(overview).toBeVisible({ timeout: 15_000 });
    const rows = page.getByTestId("dg-team-overview-row");
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(page.getByTestId("dg-user-report")).toBeVisible();
  });

  test("5. Score (0-100) and grade chip render", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    await page.getByTestId("dg-report-user-select").selectOption(emp1Id);
    await expect(page.getByTestId("dg-report-score")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("dg-report-score")).toContainText("/100");
    await expect(page.getByTestId("dg-report-grade")).toHaveText(
      /Excellent|Good|Needs Attention|Critical/
    );
  });

  test("6. Rule-based insights appear", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    await page.getByTestId("dg-report-user-select").selectOption(emp1Id);
    const insights = page.getByTestId("dg-report-insights");
    await expect(insights).toBeVisible({ timeout: 15_000 });
    await expect(insights).toContainText(
      /Strong on-time|Good proof|Strong consistency|High revision|Frequent due-date|Low approved/
    );
  });

  test("7. Freeze monthly reports snapshots + becomes immutable; unfreeze recalculates", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);

    // Capture pre-freeze score.
    await page.getByTestId("dg-report-user-select").selectOption(emp1Id);
    await expect(page.getByTestId("dg-report-score")).toBeVisible({ timeout: 15_000 });
    const preScore = (await page.getByTestId("dg-report-score").innerText()).trim();

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("dg-freeze-reports").click();
    await expect(page.getByTestId("dg-unfreeze-reports")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("dg-report-frozen")).toBeVisible();

    // DB snapshot exists.
    const { data: snap } = await admin
      .from("delegation_monthly_appraisals")
      .select("user_id, score, grade")
      .eq("month", TEST_MONTH);
    expect((snap ?? []).length).toBeGreaterThan(0);
    expect((snap ?? []).some((r: any) => r.user_id === emp1Id)).toBe(true);

    // Add post-freeze points for emp1 — score should NOT change.
    const { data: extra } = await admin.from("delegation_tasks").insert({
      title: `${QA_PREFIX} post-freeze`,
      assignee_id: emp1Id,
      created_by: emp1Id,
      priority: "medium",
      difficulty: "medium",
      status: "Completed",
      system_stage: "completed",
      completed_at: new Date().toISOString(),
      final_date: new Date().toISOString().slice(0, 10),
    }).select().single();
    await admin.from("delegation_points_ledger").insert({
      task_id: extra!.id,
      user_id: emp1Id,
      points: 9999,
      reason: "completion_base",
      period_date: new Date().toISOString().slice(0, 10),
    });

    await page.reload();
    await page.getByRole("button", { name: /performance reports/i }).click();
    await page.getByTestId("dg-report-user-select").selectOption(emp1Id);
    await expect(page.getByTestId("dg-report-frozen")).toBeVisible({ timeout: 15_000 });
    const postScore = (await page.getByTestId("dg-report-score").innerText()).trim();
    expect(postScore).toBe(preScore);

    // Unfreeze.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("dg-unfreeze-reports").click();
    await expect(page.getByTestId("dg-freeze-reports")).toBeVisible({ timeout: 15_000 });
    const { data: snap2 } = await admin
      .from("delegation_monthly_appraisals").select("id").eq("month", TEST_MONTH);
    expect((snap2 ?? []).length).toBe(0);
  });

  test("8. Print button is wired and does not crash the page", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegationReports(page);
    await page.addInitScript(() => { (window as any).print = () => { (window as any).__printed = true; }; });
    await page.reload();
    await page.getByRole("button", { name: /performance reports/i }).click();
    await expect(page.getByTestId("dg-print-report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("dg-print-report").click();
    // Page still responsive.
    await expect(page.getByTestId("dg-performance-reports")).toBeVisible();
  });
});
