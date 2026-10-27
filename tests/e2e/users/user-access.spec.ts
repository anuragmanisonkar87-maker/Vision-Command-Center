/**
 * E2E — Users & Roles login access (invite / reset / disable).
 *
 * Drives the real admin UI at /settings/users. The TanStack Start serverFn
 * RPC URL is build-hashed and uses Seroval framing, so we do NOT call
 * `/_serverFn/*` directly — we click the buttons the admin uses and verify
 * outcomes in the database with the service-role client.
 */
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAs } from "../helpers/loginAs";
import { QA_USERS } from "../../seed/qa-users";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN = QA_USERS[0];
const NON_ADMIN = QA_USERS[1];

const QA_EMAILS = [
  "access.employee1@test.com",
  "access.employee2@test.com",
] as const;

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function cleanupQaAccessUsers() {
  for (const email of QA_EMAILS) {
    const u = await findUserByEmail(email);
    if (u) {
      await admin.from("profiles").delete().eq("id", u.id);
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
    await admin.from("gwv_team_members").delete().eq("email", email);
  }
  await admin.from("user_access_audit_log").delete().in("target_email", QA_EMAILS as unknown as string[]);
}

async function seedNotInvitedProfile(email: string, displayName: string) {
  // Create an auth user (no invite email sent) + matching profile row with
  // status 'not_invited', AND a gwv_team_members row so the Login Access
  // table (team-member-first) actually renders it.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw new Error(`seed create ${email}: ${error?.message ?? "no user"}`);
  await admin.from("profiles").upsert({
    id: data.user.id,
    email,
    display_name: displayName,
    invite_status: "not_invited",
  });
  await admin.from("gwv_team_members").insert({
    name: displayName,
    email,
    linked_user_id: data.user.id,
    status: "active",
    access_level: "viewer",
  });
  return data.user;
}


test.describe.serial("Users & Roles — login access", () => {
  test.beforeAll(async () => { await cleanupQaAccessUsers(); });
  test.afterAll(async () => { await cleanupQaAccessUsers(); });

  test("A. admin sees Login Access table + actions", async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto("/settings/users");
    await expect(page.getByText("Team Members — Login Access")).toBeVisible({ timeout: 20_000 });
    const actions = page.getByRole("button", {
      name: /Send Invite|Resend Invite|Send Password Reset|Disable Login|Enable Login/i,
    });
    await expect(actions.first()).toBeVisible({ timeout: 15_000 });
  });

  test("B. non-admin cannot access invite / reset actions", async ({ page }) => {
    await loginAs(page, NON_ADMIN.email, NON_ADMIN.password);
    await page.goto("/settings/users");
    await expect(page.getByText(/Admin access required/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Team Members — Login Access")).toHaveCount(0);
  });

  test("C-G. invite / dedup / reset / disable / bulk via UI", async ({ page }) => {
    // Seed two QA users with profiles so they appear in the table.
    const u1 = await seedNotInvitedProfile(QA_EMAILS[0], "QA Access Employee 1");
    const u2 = await seedNotInvitedProfile(QA_EMAILS[1], "QA Access Employee 2");

    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto("/settings/users");
    await expect(page.getByText("Team Members — Login Access")).toBeVisible({ timeout: 20_000 });

    // Scope to the Login Access table (the Team Members table also lists the
    // same email now that we added a Login Access column there).
    const loginPanel = page.locator(".panel", { hasText: "Team Members — Login Access" });
    const row1 = loginPanel.locator("tr", { hasText: QA_EMAILS[0] });
    const row2 = loginPanel.locator("tr", { hasText: QA_EMAILS[1] });
    await expect(row1).toBeVisible({ timeout: 15_000 });
    await expect(row2).toBeVisible();

    // Capture all responses so we can verify no password was ever returned.
    const allBodies: string[] = [];
    page.on("response", async (res) => {
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (ct.includes("json") || ct.includes("text")) {
          allBodies.push((await res.text()).toLowerCase());
        }
      } catch { /* ignore */ }
    });

    // C. Send Invite on row 1
    await row1.getByRole("button", { name: /^Send Invite$/i }).click();
    await expect(row1.getByText(/Invite Sent/i)).toBeVisible({ timeout: 15_000 });

    const { data: p1 } = await admin
      .from("profiles").select("invite_status, invite_sent_at").eq("id", u1.id).maybeSingle();
    expect(p1?.invite_status).toBe("invite_sent");
    expect(p1?.invite_sent_at).toBeTruthy();

    const { data: aud1 } = await admin
      .from("user_access_audit_log").select("action").eq("target_email", QA_EMAILS[0]);
    const acts1 = (aud1 ?? []).map((r: any) => r.action);
    expect(acts1.some((a: string) => a === "invite_sent" || a === "invite_resent")).toBe(true);

    // D. Resend Invite → no duplicate auth user
    await row1.getByRole("button", { name: /Resend Invite/i }).click();
    await page.waitForTimeout(2000);
    const matches: any[] = [];
    for (let pg = 1; pg <= 10; pg += 1) {
      const { data } = await admin.auth.admin.listUsers({ page: pg, perPage: 200 });
      matches.push(...data.users.filter((u) => (u.email ?? "").toLowerCase() === QA_EMAILS[0]));
      if (data.users.length < 200) break;
    }
    expect(matches.length).toBe(1);
    const { data: aud2 } = await admin
      .from("user_access_audit_log").select("action").eq("target_email", QA_EMAILS[0]);
    const acts2 = (aud2 ?? []).map((r: any) => r.action);
    expect(acts2.some((a: string) => a === "invite_resent" || a === "invite_sent")).toBe(true);

    // E. Password reset
    await row1.getByRole("button", { name: /Send Password Reset/i }).click();
    await page.waitForTimeout(2000);
    const { data: p3 } = await admin
      .from("profiles").select("password_reset_sent_at").eq("id", u1.id).maybeSingle();
    expect(p3?.password_reset_sent_at).toBeTruthy();

    // F. Disable + Enable
    await row1.getByRole("button", { name: /Disable Login/i }).click();
    await expect(row1.getByText(/Disabled/i)).toBeVisible({ timeout: 15_000 });
    const after = await admin.auth.admin.getUserById(u1.id);
    expect(!!after.data.user?.banned_until && new Date(after.data.user.banned_until!) > new Date()).toBe(true);
    await row1.getByRole("button", { name: /Enable Login/i }).click();
    await page.waitForTimeout(2000);

    // G. Bulk invite on row 2 (still 'not_invited')
    const checkbox = row2.locator('input[type="checkbox"]');
    await checkbox.check();
    await page.getByRole("button", { name: /Send Invites \(1\)/i }).click();
    await expect(row2.getByText(/Invite Sent/i)).toBeVisible({ timeout: 15_000 });
    const u2After = await admin.auth.admin.getUserById(u2.id);
    expect(u2After.data.user).toBeTruthy();

    // Security — no password text in any response body
    const joined = allBodies.join("\n");
    expect(joined).not.toContain('"password"');
    expect(joined).not.toMatch(/password\s*[:=]\s*"/i);
  });
});
