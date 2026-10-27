/**
 * E2E — Delegation approval / review workflow.
 *
 * Mirrors the manual QA flow:
 *   employee submits → status becomes Submitted, no points yet
 *   admin approves from Review Queue → points + completion_base ledger
 *   activity + points drawers reflect the change
 *   employee cannot approve own task
 *
 * Strategy: hybrid. The task is created with the service-role client (matches
 * the pattern in delegation.spec.ts and avoids spreadsheet UI flakiness),
 * then the submit + approve actions are driven through the real UI.
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
const QA_PREFIX = "QA Approval Flow -";


async function gotoDelegation(page: Page) {
  await page.goto("/delegation");
  await expect(page.getByRole("heading", { name: /delegation command center/i })).toBeVisible();
  await expect(page.getByTestId("delegation-grid")).toBeVisible();
}

async function cleanupQaTasks() {
  const { data: tasks } = await admin
    .from("delegation_tasks")
    .select("id")
    .ilike("title", `${QA_PREFIX}%`);
  const ids = (tasks ?? []).map((t: any) => t.id);
  if (ids.length === 0) return;
  await admin.from("delegation_points_ledger").delete().in("task_id", ids);
  await admin.from("delegation_activity").delete().in("task_id", ids);
  await admin.from("delegation_due_date_requests").delete().in("task_id", ids);
  await admin.from("delegation_tasks").delete().in("id", ids);
}

async function getEmpId(email: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`User not found: ${email}`);
  return u.id;
}

test.describe.serial("Delegation approval flow", () => {
  let taskId = "";
  let taskTitle = "";
  let empId = "";

  test.beforeAll(async () => {
    await cleanupQaTasks();
    empId = await getEmpId(EMP1.email);
    taskTitle = `${QA_PREFIX} ${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("delegation_tasks")
      .insert({
        title: taskTitle,
        assignee_id: empId,
        created_by: empId,
        priority: "medium",
        difficulty: "medium",
        status: "Planned",
        system_stage: "planned",
        due_date: today,
        due_date_locked: true,
        proof_required: true,
      })
      .select()
      .single();
    expect(error).toBeNull();
    taskId = data!.id;
  });

  test.afterAll(async () => {
    await cleanupQaTasks();
  });

  test("1. Employee submits for review — task becomes Submitted, no points yet", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await gotoDelegation(page);

    // Find the row's submit button (employee → "Submit for review").
    const submitBtn = page.locator(`[data-testid="dg-row-complete"][data-task-id="${taskId}"]`);
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });
    await submitBtn.click();

    await page.getByTestId("dg-proof-url").fill("https://example.com/proof");
    await page.getByTestId("dg-complete-submit").click();

    // Wait for dialog to close.
    await expect(page.getByTestId("dg-complete-submit")).toHaveCount(0, { timeout: 15_000 });

    // DB assertions.
    const { data: t } = await admin.from("delegation_tasks").select("*").eq("id", taskId).single();
    expect(t!.system_stage).toBe("submitted");
    expect(t!.status).toBe("Submitted");
    expect(t!.completed_at).toBeNull();
    expect(t!.proof_url).toBe("https://example.com/proof");

    const { data: ledger } = await admin
      .from("delegation_points_ledger")
      .select("*")
      .eq("task_id", taskId)
      .eq("reason", "completion_base");
    expect(ledger ?? []).toHaveLength(0);

    const { data: acts } = await admin
      .from("delegation_activity")
      .select("action")
      .eq("task_id", taskId);
    expect((acts ?? []).some((a: any) => a.action === "submitted_for_review")).toBe(true);
  });

  test("2. Employee cannot approve own submitted task (no Approve from grid; Review queue not available)", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await gotoDelegation(page);
    await expect(page.getByTestId("dg-review-queue-btn")).toHaveCount(0);

    // Service-level guard: approveCompletion throws when actor === assignee.
    // That branch is covered in unit tests; here we only assert the UI affordance
    // (the Review queue button) is hidden from non-admins.

  });

  test("3. Admin approves from Review queue — points appear, activity updated", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);

    await page.getByTestId("dg-review-queue-btn").click();
    const queue = page.getByTestId("dg-review-queue");
    await expect(queue).toBeVisible();

    const row = queue.locator(`[data-testid="dg-review-task"][data-task-id="${taskId}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(taskTitle);

    await row.getByTestId("dg-review-approve").click();

    // Row disappears once approved.
    await expect(row).toHaveCount(0, { timeout: 15_000 });

    // DB assertions.
    const { data: t } = await admin.from("delegation_tasks").select("*").eq("id", taskId).single();
    expect(t!.system_stage).toBe("completed");
    expect(t!.status).toBe("Completed");
    expect(t!.completed_at).not.toBeNull();
    expect(t!.final_date).not.toBeNull();

    const { data: ledger } = await admin
      .from("delegation_points_ledger")
      .select("*")
      .eq("task_id", taskId);
    expect((ledger ?? []).length).toBeGreaterThan(0);
    expect((ledger ?? []).some((r: any) => r.reason === "completion_base")).toBe(true);

    const { data: acts } = await admin
      .from("delegation_activity")
      .select("action")
      .eq("task_id", taskId);
    expect((acts ?? []).some((a: any) => a.action === "approved_completed")).toBe(true);
  });

  test("4. Activity + Points drawers show the approval", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await gotoDelegation(page);

    // Admin's "Daily Grid" only shows tasks assigned to them. Switch to
    // "Team Grid" to find the employee's now-completed task.
    await page.getByRole("button", { name: /^team grid$/i }).click();

    const activityBtn = page.locator(`[data-testid="dg-activity"][data-task-id="${taskId}"]`);
    await expect(activityBtn).toBeVisible({ timeout: 15_000 });
    await activityBtn.click();
    const activityDrawer = page.getByTestId("dg-activity-drawer");
    await expect(activityDrawer).toBeVisible();
    await expect(activityDrawer.locator('[data-testid="dg-activity-row"]').first()).toBeVisible();
    await expect(activityDrawer).toContainText(/approved/i);
    await expect(activityDrawer).toContainText(/submitted/i);
    // Close drawer.
    await page.keyboard.press("Escape").catch(() => {});
    await activityDrawer.getByRole("button", { name: /close/i }).click().catch(() => {});

    const pointsBtn = page.locator(`[data-testid="dg-points"][data-task-id="${taskId}"]`);
    await pointsBtn.click();
    const pointsDrawer = page.getByTestId("dg-points-drawer");
    await expect(pointsDrawer).toBeVisible();
    await expect(pointsDrawer.locator('[data-testid="dg-points-row"]').first()).toBeVisible();
  });
});
