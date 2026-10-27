/**
 * Idempotent seed script for Delegation Command Center QA accounts.
 *
 * Creates 3 throwaway users + assigns roles. Safe to re-run.
 * Also cleans up any leftover `QA Delegation Test - *` rows in
 * delegation_tasks / activity / ledger so re-runs stay clean.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bunx tsx tests/seed/qa-users.ts
 */
import { createClient } from "@supabase/supabase-js";

export const QA_USERS = [
  {
    email: "delegation.admin@test.com",
    password: "QA-Deleg-Admin-2026!x9k2",
    display_name: "QA Delegation Admin",
    role: "admin" as const,
  },
  {
    email: "delegation.employee1@test.com",
    password: "QA-Deleg-Emp1-2026!m7p4",
    display_name: "QA Delegation Employee 1",
    role: "team_member" as const,
  },
  {
    email: "delegation.employee2@test.com",
    password: "QA-Deleg-Emp2-2026!q6r8",
    display_name: "QA Delegation Employee 2",
    role: "team_member" as const,
  },
];

export const QA_TITLE_PREFIX = "QA Delegation Test";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the seed.");
}

export const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function ensureQaUsers() {
  const results: { email: string; id: string; created: boolean }[] = [];
  for (const u of QA_USERS) {
    // Look up existing
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    let existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
    let created = false;
    if (!existing) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.display_name },
      });
      if (error) throw error;
      existing = data.user!;
      created = true;
    } else {
      // Re-assert password + confirmed
      await admin.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.display_name },
      });
    }
    // Ensure profile row exists (handle_new_user trigger covers create, but be safe)
    await admin.from("profiles").upsert({ id: existing.id, display_name: u.display_name });
    // Ensure role
    await admin.from("user_roles").upsert(
      { user_id: existing.id, role: u.role },
      { onConflict: "user_id,role" },
    );
    results.push({ email: u.email, id: existing.id, created });
  }
  return results;
}

export async function cleanupQaData() {
  // Find users
  const emails = QA_USERS.map((u) => u.email.toLowerCase());
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userIds = (list?.users ?? [])
    .filter((u) => emails.includes((u.email ?? "").toLowerCase()))
    .map((u) => u.id);

  // Delete delegation_tasks created by these QA users with the QA prefix.
  // Cascading FKs on delegation_activity / delegation_points_ledger clean those automatically.
  const { data: tasks } = await admin
    .from("delegation_tasks")
    .select("id")
    .ilike("title", `${QA_TITLE_PREFIX}%`)
    .in("created_by", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const taskIds = (tasks ?? []).map((t: any) => t.id);
  if (taskIds.length) {
    await admin.from("delegation_tasks").delete().in("id", taskIds);
  }
  return { deletedTasks: taskIds.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const users = await ensureQaUsers();
    const cleanup = await cleanupQaData();
    console.log("QA users:", users);
    console.log("Cleanup:", cleanup);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
