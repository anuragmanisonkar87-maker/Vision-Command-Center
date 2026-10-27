// User profile + role + brand-access lookup.
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, UserProfile } from "@/types/auth";

async function getRolesWithRetry(userId: string): Promise<AppRole[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId);

    if (!error) {
      const roles = ((data ?? []) as unknown as Array<{ role: AppRole }>).map((r) => r.role);
      if (roles.length || attempt === 2) return roles;
    }
    if (error && attempt === 2) throw new Error(error.message);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return [];
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const [{ data: profile, error: profileError }, resolvedRoles] = await Promise.all([
    supabase.from("profiles" as any).select("display_name").eq("id", user.id).maybeSingle(),
    getRolesWithRetry(user.id),
  ]);

  if (profileError) throw new Error(profileError.message);

  return {
    id: user.id,
    email: user.email ?? "",
    display_name: (profile as any)?.display_name ?? null,
    roles: resolvedRoles,
  };
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles" as any).select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ role: AppRole }>).map((r) => r.role);
}

export type AdminUserRow = {
  id: string;
  display_name: string | null;
  created_at: string | null;
  roles: AppRole[];
  brand_ids: string[];
};

export async function listAllUsersWithRoles(): Promise<AdminUserRow[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: access, error: aErr }] = await Promise.all([
    supabase.from("profiles" as any).select("id, display_name, created_at"),
    supabase.from("user_roles" as any).select("user_id, role"),
    supabase.from("user_brand_access" as any).select("user_id, brand_id, is_deleted"),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (rErr) throw new Error(rErr.message);
  if (aErr) throw new Error(aErr.message);

  const byUser = new Map<string, AppRole[]>();
  ((roles ?? []) as unknown as Array<{ user_id: string; role: AppRole }>).forEach((r) => {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r.role);
    byUser.set(r.user_id, arr);
  });

  const brandsByUser = new Map<string, string[]>();
  ((access ?? []) as unknown as Array<{ user_id: string; brand_id: string; is_deleted: boolean }>).forEach((a) => {
    if (a.is_deleted) return;
    const arr = brandsByUser.get(a.user_id) ?? [];
    arr.push(a.brand_id);
    brandsByUser.set(a.user_id, arr);
  });

  return ((profiles ?? []) as unknown as Array<{ id: string; display_name: string | null; created_at: string | null }>).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    created_at: p.created_at,
    roles: byUser.get(p.id) ?? [],
    brand_ids: brandsByUser.get(p.id) ?? [],
  }));
}

export const getUsersWithRolesAndBrandAccess = listAllUsersWithRoles;

export async function assignRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.from("user_roles" as any).insert({ user_id: userId, role });
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
}

export async function removeRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from("user_roles" as any)
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  if (error) throw new Error(error.message);
}

// ── Brand access ─────────────────────────────────────────────
export async function getUserBrandAccess(userId: string): Promise<{ brand_id: string; access_level: string }[]> {
  const { data, error } = await supabase
    .from("user_brand_access" as any)
    .select("brand_id, access_level")
    .eq("user_id", userId)
    .eq("is_deleted", false);
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}

export async function setUserBrandAccess(userId: string, brandIds: string[], accessLevel = "viewer"): Promise<void> {
  // soft-delete previous
  const { error: delErr } = await supabase
    .from("user_brand_access" as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_deleted", false);
  if (delErr) throw new Error(delErr.message);
  if (!brandIds.length) return;
  const rows = brandIds.map((b) => ({ user_id: userId, brand_id: b, access_level: accessLevel }));
  const { error } = await supabase.from("user_brand_access" as any).insert(rows);
  if (error) throw new Error(error.message);
}

export async function removeUserBrandAccess(userId: string, brandId: string): Promise<void> {
  const { error } = await supabase
    .from("user_brand_access" as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("brand_id", brandId);
  if (error) throw new Error(error.message);
}

// ── Invites ──────────────────────────────────────────────────
export type UserInvite = {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  brand_ids: string[] | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  invited_by: string | null;
  created_at: string;
  notes: string | null;
};

export async function listUserInvites(): Promise<UserInvite[]> {
  const { data, error } = await supabase.from("user_invites" as any).select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UserInvite[];
}

export async function createUserInvite(p: {
  email: string;
  display_name?: string | null;
  roles: string[];
  brand_ids?: string[] | null;
  notes?: string | null;
}): Promise<UserInvite> {
  const { data, error } = await supabase.from("user_invites" as any).insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as UserInvite;
}

export async function cancelUserInvite(id: string): Promise<void> {
  const { error } = await supabase.from("user_invites" as any).update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
}
