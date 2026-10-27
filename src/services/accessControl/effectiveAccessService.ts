// @ts-nocheck
// Resolves the effective access matrix for the currently signed-in user by
// merging position presets with explicit user overrides. RLS remains the
// source of truth for actual data access — these helpers only drive UI gating.

import { supabase } from "@/integrations/supabase/client";

export type ActionKey =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "manage"
  | "view_finance";

export type ModulePermission = {
  module_id: string;
  module_key: string;
  brand_id: string | null;
  access_level: string;
  scope: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage: boolean;
  can_view_finance: boolean;
};

export type EffectiveAccess = {
  teamMemberId: string | null;
  positionId: string | null;
  brandIds: string[]; // brands user can access (any access)
  modulesByKey: Record<string, ModulePermission>;
  modulesById: Record<string, ModulePermission>;
};

const EMPTY: EffectiveAccess = {
  teamMemberId: null,
  positionId: null,
  brandIds: [],
  modulesByKey: {},
  modulesById: {},
};

function mergeRow(base: ModulePermission | undefined, row: any, moduleKey: string): ModulePermission {
  const b = base ?? {
    module_id: row.module_id,
    module_key: moduleKey,
    brand_id: row.brand_id ?? null,
    access_level: row.access_level ?? "viewer",
    scope: row.scope ?? "assigned",
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_export: false,
    can_manage: false,
    can_view_finance: false,
  };
  return {
    ...b,
    access_level: row.access_level ?? b.access_level,
    scope: row.scope ?? b.scope,
    can_view: !!(b.can_view || row.can_view),
    can_create: !!(b.can_create || row.can_create),
    can_edit: !!(b.can_edit || row.can_edit),
    can_delete: !!(b.can_delete || row.can_delete),
    can_export: !!(b.can_export || row.can_export),
    can_manage: !!(b.can_manage || row.can_manage),
    can_view_finance: !!(b.can_view_finance || row.can_view_finance),
  };
}

export async function getEffectiveAccess(userId: string | null | undefined): Promise<EffectiveAccess> {
  if (!userId) return EMPTY;

  // 1) Find linked team member
  const { data: members } = await (supabase as any)
    .from("gwv_team_members")
    .select("id,position_id,status,is_deleted")
    .eq("linked_user_id", userId)
    .eq("is_deleted", false)
    .limit(1);

  const member = members?.[0];
  if (!member || member.status !== "active") return EMPTY;

  const memberId = member.id;
  const positionId = member.position_id ?? null;

  // 2) Load modules (for key lookup)
  const { data: modules } = await (supabase as any)
    .from("gwv_modules")
    .select("id,module_key")
    .eq("is_deleted", false);
  const keyById: Record<string, string> = {};
  (modules || []).forEach((m: any) => { keyById[m.id] = m.module_key; });

  // 3) Position presets
  let presets: any[] = [];
  if (positionId) {
    const { data } = await (supabase as any)
      .from("gwv_position_module_access")
      .select("*")
      .eq("position_id", positionId);
    presets = data || [];
  }

  // 4) User overrides
  const { data: overrides } = await (supabase as any)
    .from("gwv_user_module_access")
    .select("*")
    .eq("team_member_id", memberId)
    .eq("is_active", true);

  const modulesById: Record<string, ModulePermission> = {};
  for (const row of presets) {
    const key = keyById[row.module_id];
    if (!key) continue;
    modulesById[row.module_id] = mergeRow(modulesById[row.module_id], row, key);
  }
  for (const row of overrides || []) {
    const key = keyById[row.module_id];
    if (!key) continue;
    modulesById[row.module_id] = mergeRow(modulesById[row.module_id], row, key);
  }

  const modulesByKey: Record<string, ModulePermission> = {};
  Object.values(modulesById).forEach((p) => { modulesByKey[p.module_key] = p; });

  // 5) Brand access
  const { data: brands } = await (supabase as any)
    .from("gwv_user_brand_access")
    .select("brand_id,can_view,is_active")
    .eq("team_member_id", memberId);
  const brandIds = (brands || [])
    .filter((b: any) => b.is_active !== false && b.can_view)
    .map((b: any) => b.brand_id);

  return { teamMemberId: memberId, positionId, brandIds, modulesByKey, modulesById };
}
