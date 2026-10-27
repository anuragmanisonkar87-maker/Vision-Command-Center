/**
 * E2E — Delegation Phase 3 QA: badges, monthly winners, reward settings,
 * freeze/unfreeze, permissions, and an approval-flow regression touch.
 *
 * Strategy: seed approved completed tasks + ledger rows for two employees via
 * the service-role client (deterministic, fast, no UI flakiness), then drive
 * UI assertions through the real app. Cleanup wipes everything prefixed with
 * `QA Badge Reward -` plus its activity, ledger, due-date requests, and the
 * monthly-award snapshot for the test month.
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
const QA_PREFIX = "QA Badge Reward -";

function monthStartIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const TEST_MONTH = monthStartIso();


async function gotoDelegation(page: Page) {
  await page.goto("/delegation");
  await expect(page.getByRole("heading", { name: /delegation command center/i })).toBeVisible();
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
}

interface SeedTaskArgs {
  assigneeId: string;
  daysAgo: number;
  onTime: boolean;
  revisions?: number;
  withProof?: boolean;
  points?: number;
  index: number;
}

async function seedApprovedTask(args: SeedTaskArgs): Promise<string> {
  const now = new Date();
  const completedAt = new Date(now);
  completedAt.setDate(now.getDate() - args.daysAgo);
  // Keep within current test month for monthly-winner calc.
  if (completedAt.toISOString().slice(0, 7) !== TEST_MONTH.slice(0, 7)) {
    completedAt.setDate(1);
    completedAt.setHours(12);
  }
  const completedIso = completedAt.toISOString();
  const completedDay = completedIso.slice(0, 10);
  // due_date: same day if onTime else later than completion.
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

test.describe.serial("Delegation Phase 3 — badges & rewards", () => {
  let emp1Id = "";
  let emp2Id = "";

  test.beforeAll(async () => {
    await cleanup();
    emp1Id = await getUserId(EMP1.email);
    emp2Id = await getUserId(EMP2.email);

    // Employee 1: 6 on-time, zero-revision, with proof — should earn multiple badges.
    for (let i = 0; i < 6; i++) {
      await seedApprovedTask({
        assigneeId: emp1Id,
        daysAgo: i,
        onTime: true,
        revisions: 0,
        withProof: true,
        points: 10,
        index: i,
      });
    }
    // Employee 2: fewer tasks, late, with revisions — low / no badges.
    for (let i = 0; i < 3; i++) {
      await seedApprovedTask({
        assigneeId: emp2Id,
        daysAgo: i,
        onTime: false,
        revisions: 1,
        withProof: false,
        points: 4,
        index: i,
      });
    }
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test("1. Employee sees their own badge strip on Daily Grid", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await gotoDelegation(page);
    const strip = page.getByTestId("dg-badge-strip").first();
    await expect(strip).toBeVisible({ timeout: 15_000 });
    // At least one badge should be earned (Zero Revision Pro with 6 zero-rev approved).
    await expect(strip).toContainText(/zero revision|on-time|deadline|consistent|proof/i);
  });

  test("2. Admin leaderboard renders rows + badge chips + drill-down with badges", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);
    await page.getByRole("button", { name: /^leaderboard$/i }).first().click();

    // Monthly winners panel renders.
    await expect(page.getByTestId("dg-monthly-winners")).toBeVisible({ timeout: 15_000 });

    // Switch to "This Month" so seeded data (across the month) is included.
    await page.getByRole("button", { name: /this month/i }).click();
    await expect(page.getByTestId("dg-leaderboard-row").first()).toBeVisible({ timeout: 15_000 });

    // Click first row (highest points = emp1) → opens user points drawer w/ badge strip.
    await page.getByTestId("dg-leaderboard-row").first().click();
    const drawer = page.getByTestId("dg-user-points-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("dg-badge-strip")).toBeVisible();
  });

  test("3. Monthly Winners panel shows top points + most tasks", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);
    await page.getByRole("button", { name: /^leaderboard$/i }).first().click();

    const panel = page.getByTestId("dg-monthly-winners");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId("dg-winner-top_points")).toBeVisible();
    await expect(panel.getByTestId("dg-winner-most_tasks")).toBeVisible();
    await expect(panel.getByTestId("dg-winner-on_time_champion")).toBeVisible();
    await expect(panel.getByTestId("dg-winner-zero_revision_champion")).toBeVisible();
    await expect(panel.getByTestId("dg-winner-most_consistent")).toBeVisible();
  });

  test("4. Reward settings — admin can edit and persist", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);
    await page.getByRole("button", { name: /admin settings/i }).click();

    const panel = page.getByTestId("dg-reward-settings");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // Change "On-Time Machine" reward label.
    const label = `QA-Reward-${Date.now()}`;
    const rewardInputs = panel.locator('input[type="text"]');
    await rewardInputs.first().fill(label);
    await panel.getByRole("button", { name: /^save$|saving/i }).click();
    await expect(panel.getByRole("button", { name: /saved|save/i })).toBeVisible();

    // Verify persistence via DB.
    const { data } = await admin.from("delegation_settings").select("settings").eq("id", 1).single();
    const rs = (data as any)?.settings?.reward_settings;
    expect(rs).toBeDefined();
    expect(rs.reward_label.on_time_machine).toBe(label);

    // Cleanup: reset label.
    await rewardInputs.first().fill("");
    await panel.getByRole("button", { name: /^save$|saving/i }).click();
  });

  test("5. Employee cannot see Admin Settings or freeze controls", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await gotoDelegation(page);
    await expect(page.getByRole("button", { name: /admin settings/i })).toHaveCount(0);

    // Leaderboard tab: panel renders but freeze button is admin-only.
    await page.getByRole("button", { name: /^leaderboard$/i }).first().click();
    await expect(page.getByTestId("dg-monthly-winners")).toBeVisible();
    await expect(page.getByTestId("dg-freeze-winners")).toHaveCount(0);
    await expect(page.getByTestId("dg-unfreeze-winners")).toHaveCount(0);
    await expect(page.getByTestId("dg-reward-settings")).toHaveCount(0);
  });

  test("6. Freeze + unfreeze monthly winners (admin); frozen rows immutable", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);
    await page.getByRole("button", { name: /^leaderboard$/i }).first().click();

    // Make sure we're in the current month (default).
    await expect(page.getByTestId("dg-monthly-winners")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("dg-freeze-winners").click();

    // Frozen badge should appear.
    await expect(page.getByTestId("dg-unfreeze-winners")).toBeVisible({ timeout: 10_000 });

    // DB snapshot exists.
    const { data: rows1 } = await admin
      .from("delegation_monthly_awards")
      .select("*")
      .eq("month", TEST_MONTH);
    expect((rows1 ?? []).length).toBeGreaterThan(0);
    const topPoints1 = (rows1 ?? []).find((r: any) => r.award_type === "top_points");
    expect(topPoints1?.user_id).toBe(emp1Id);

    // Simulate "new" points after freeze for emp2 — should NOT change frozen snapshot.
    const { data: extraTask } = await admin
      .from("delegation_tasks")
      .insert({
        title: `${QA_PREFIX} extra-post-freeze`,
        assignee_id: emp2Id,
        created_by: emp2Id,
        priority: "medium",
        difficulty: "medium",
        status: "Completed",
        system_stage: "completed",
        completed_at: new Date().toISOString(),
        final_date: new Date().toISOString().slice(0, 10),
      })
      .select().single();
    await admin.from("delegation_points_ledger").insert({
      task_id: extraTask!.id,
      user_id: emp2Id,
      points: 9_999,
      reason: "completion_base",
      period_date: new Date().toISOString().slice(0, 10),
    });

    // Reload winners — they come from snapshot, so emp1 still wins top points.
    await page.reload();
    await page.getByRole("button", { name: /^leaderboard$/i }).first().click();
    await expect(page.getByTestId("dg-monthly-winners")).toBeVisible();
    const { data: rows2 } = await admin
      .from("delegation_monthly_awards")
      .select("*")
      .eq("month", TEST_MONTH)
      .eq("award_type", "top_points")
      .single();
    expect((rows2 as any)?.user_id).toBe(emp1Id);

    // Unfreeze.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("dg-unfreeze-winners").click();
    await expect(page.getByTestId("dg-freeze-winners")).toBeVisible({ timeout: 10_000 });
    const { data: rows3 } = await admin
      .from("delegation_monthly_awards")
      .select("id")
      .eq("month", TEST_MONTH);
    expect((rows3 ?? []).length).toBe(0);
  });
});
