// Task Doer source for the Delegation Command Center.
// A "Task Doer" is anyone who can be responsible for doing a task.
// Source of truth: gwv_team_members (active, not deleted), sorted alphabetically.
//
// This intentionally differs from listAllUsersWithRoles() — that one only
// returns users with auth profiles, which makes the dropdown collapse to a
// single admin. Team members may or may not have a linked auth user.

import { supabase } from "@/integrations/supabase/client";

export type TaskDoer = {
  id: string;            // gwv_team_members.id
  name: string;
  email: string;
  position_name: string | null;
  linked_user_id: string | null;
  status: string;
};

export async function listTaskDoers(): Promise<TaskDoer[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_team_members")
    .select("id, name, email, status, linked_user_id, gwv_positions(name)")
    .eq("is_deleted", false)
    .neq("status", "inactive")
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      position_name: r.gwv_positions?.name ?? null,
      linked_user_id: r.linked_user_id ?? null,
      status: r.status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve the display name for a saved delegation task row, in priority order:
 *   1. snapshot assignee_name on the row
 *   2. matched team member by assignee_team_member_id
 *   3. matched team member by linked auth user (assignee_id)
 *   4. fallback display_name from users list (legacy auth-user rows)
 */
export function resolveTaskDoerName(
  row: {
    assignee_team_member_id?: string | null;
    assignee_id?: string | null;
    assignee_name?: string | null;
  },
  doers: TaskDoer[],
  users: Array<{ id: string; display_name: string | null }>,
): string {
  if (row.assignee_name && row.assignee_name.trim()) return row.assignee_name;
  if (row.assignee_team_member_id) {
    const d = doers.find((x) => x.id === row.assignee_team_member_id);
    if (d) return d.name;
  }
  if (row.assignee_id) {
    const d = doers.find((x) => x.linked_user_id === row.assignee_id);
    if (d) return d.name;
    const u = users.find((x) => x.id === row.assignee_id);
    if (u?.display_name) return u.display_name;
  }
  return "—";
}
