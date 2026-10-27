// Lightweight team directory lookups used by modules that need to pick
// a team member (e.g. media buyers, account managers) without rebuilding
// the whole access-control surface.

import { supabase } from "@/integrations/supabase/client";

export type TeamMemberLite = {
  id: string;
  name: string;
  email: string | null;
  position_id: string | null;
  position_name: string | null;
  status: string;
};

/** All active team members. Optionally filter by position name (case-insensitive). */
export async function getTeamMembers(opts?: { positionContains?: string }): Promise<TeamMemberLite[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_team_members")
    .select("id, name, email, status, position_id, gwv_positions(name)")
    .eq("is_deleted", false)
    .neq("status", "inactive")
    .order("name");
  if (error) throw new Error(error.message);
  const rows = (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    status: r.status,
    position_id: r.position_id,
    position_name: r.gwv_positions?.name ?? null,
  })) as TeamMemberLite[];
  if (opts?.positionContains) {
    const needle = opts.positionContains.toLowerCase();
    return rows.filter((r) => (r.position_name || "").toLowerCase().includes(needle));
  }
  return rows;
}

/**
 * Union of media buyers from:
 *  - gwv_team_members where position name contains "media buyer",
 *    "media buyer operations", or "performance marketer"
 *  - profiles whose user_roles include 'media_buyer'
 * Deduped by name+email. Active only.
 */
export async function getMediaBuyersUnion(): Promise<TeamMemberLite[]> {
  const NEEDLES = ["media buyer", "media buyer operations", "performance marketer"];
  const [teamRows, rolesRes, profilesRes] = await Promise.all([
    getTeamMembers(),
    (supabase as any).from("user_roles").select("user_id, role").eq("role", "media_buyer"),
    (supabase as any).from("profiles").select("id, display_name"),
  ]);

  const fromTeam = teamRows.filter((r) =>
    NEEDLES.some((n) => (r.position_name || "").toLowerCase().includes(n))
  );

  const mbUserIds: string[] = ((rolesRes.data ?? []) as any[]).map((r) => r.user_id);
  const profilesById = new Map<string, { id: string; display_name: string | null }>(
    ((profilesRes.data ?? []) as any[]).map((p) => [p.id, p]),
  );
  const fromRoles: TeamMemberLite[] = mbUserIds
    .map((uid) => {
      const p = profilesById.get(uid);
      if (!p) return null;
      return {
        id: `profile:${uid}`,
        name: p.display_name || "(unnamed user)",
        email: null,
        position_id: null,
        position_name: "Media Buyer",
        status: "active",
      } as TeamMemberLite;
    })
    .filter(Boolean) as TeamMemberLite[];

  const dedup = new Map<string, TeamMemberLite>();
  for (const m of [...fromTeam, ...fromRoles]) {
    const key = `${(m.name || "").toLowerCase().trim()}|${(m.email || "").toLowerCase().trim()}`;
    if (!dedup.has(key)) dedup.set(key, m);
  }
  return Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name));
}
