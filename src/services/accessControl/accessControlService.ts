// @ts-nocheck
// Team Access Control service layer.
// All queries go through the standard Supabase browser client + RLS.
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./auditLogService";

export type TeamMember = {
  id: string;
  linked_user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  position_id: string | null;
  status: string;
  access_level: string;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Phase 2 — work + compensation
  department?: string | null;
  joining_date?: string | null;
  salary_amount?: number | null;
  salary_currency?: string | null;
  payment_cycle?: string | null;
  expense_category?: string | null;
  auto_add_to_expenses?: boolean;
};

export type Position = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_access_level: string;
  status: string;
  sort_order: number;
};

export type ModuleRow = {
  id: string;
  brand_id: string | null;
  module_name: string;
  module_key: string;
  route_path: string | null;
  description: string | null;
  sensitivity: string;
  default_access_level: string;
  module_status: string;
  is_assignable: boolean;
  show_in_sidebar: boolean;
  show_in_module_hub: boolean;
  sort_order: number;
};

export type BrandAccessRow = {
  id?: string;
  team_member_id: string;
  brand_id: string;
  access_level: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage: boolean;
  is_active?: boolean;
};

export type ModuleAccessRow = {
  id?: string;
  team_member_id: string;
  module_id: string;
  brand_id?: string | null;
  access_level: string;
  scope: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_manage: boolean;
  can_view_finance: boolean;
  is_active?: boolean;
};

export type MasterOption = {
  id: string;
  option_type: string;
  option_key: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
};

// ---------- TEAM MEMBERS ----------
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_team_members")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const { data, error } = await (supabase as any)
    .from("gwv_team_members").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createTeamMember(payload: Partial<TeamMember>) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("gwv_team_members")
    .insert({ ...payload, created_by: u.user?.id })
    .select().single();
  if (error) throw error;
  await logAudit({ action: "create_team_member", entity_type: "team_member", entity_id: data.id, target_team_member_id: data.id, summary: `Added ${data.name}` });
  return data;
}

export async function updateTeamMember(id: string, payload: Partial<TeamMember>) {
  const { data, error } = await (supabase as any)
    .from("gwv_team_members").update(payload).eq("id", id).select().single();
  if (error) throw error;
  await logAudit({ action: "update_team_member", entity_type: "team_member", entity_id: id, target_team_member_id: id, summary: `Updated ${data.name}`, details: payload });
  return data;
}

export async function setTeamMemberStatus(id: string, status: string) {
  return updateTeamMember(id, { status });
}

export async function softDeleteTeamMember(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const result = await updateTeamMember(id, {
    is_deleted: true,
    deleted_at: new Date().toISOString() as any,
    deleted_by: u.user?.id as any,
  } as any);
  await logAudit({ action: "archive_team_member", entity_type: "team_member", entity_id: id, target_team_member_id: id, summary: `Archived team member` });
  return result;
}

// ---------- POSITIONS ----------
export async function getPositions(): Promise<Position[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_positions").select("*")
    .eq("is_deleted", false).order("sort_order");
  if (error) throw error;
  return data || [];
}

// ---------- POSITION PRESETS ----------
export type PositionPresetRow = {
  id?: string;
  position_id: string;
  module_id: string;
  brand_id?: string | null;
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

export async function createPosition(payload: Partial<Position>) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("gwv_positions").insert({ ...payload, created_by: u.user?.id }).select().single();
  if (error) throw error;
  return data;
}

export async function updatePosition(id: string, payload: Partial<Position>) {
  const { data, error } = await (supabase as any)
    .from("gwv_positions").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function softDeletePosition(id: string) {
  return updatePosition(id, { is_deleted: true } as any);
}

export async function getPositionPresets(positionId: string): Promise<PositionPresetRow[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_position_module_access").select("*").eq("position_id", positionId);
  if (error) throw error;
  return data || [];
}

export async function savePositionPresets(positionId: string, rows: PositionPresetRow[]) {
  await (supabase as any).from("gwv_position_module_access").delete().eq("position_id", positionId);
  if (rows.length) {
    const insertRows = rows.map((r) => ({ ...r, position_id: positionId }));
    const { error } = await (supabase as any).from("gwv_position_module_access").insert(insertRows);
    if (error) throw error;
  }
  await logAudit({ action: "update_position_presets", entity_type: "position", entity_id: positionId, summary: `Saved ${rows.length} preset(s)` });
}

// ---------- BULK OPERATIONS ----------
export async function bulkSetTeamMemberStatus(ids: string[], status: string) {
  if (!ids.length) return;
  const { error } = await (supabase as any)
    .from("gwv_team_members").update({ status }).in("id", ids);
  if (error) throw error;
  await logAudit({ action: "bulk_set_status", entity_type: "team_member", summary: `Set ${ids.length} member(s) to ${status}`, details: { ids, status } });
}

export async function bulkArchiveTeamMembers(ids: string[]) {
  if (!ids.length) return;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("gwv_team_members")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: u.user?.id })
    .in("id", ids);
  if (error) throw error;
  await logAudit({ action: "bulk_archive", entity_type: "team_member", summary: `Archived ${ids.length} member(s)`, details: { ids } });
}

export async function bulkAssignPosition(ids: string[], positionId: string | null) {
  if (!ids.length) return;
  const { error } = await (supabase as any)
    .from("gwv_team_members").update({ position_id: positionId }).in("id", ids);
  if (error) throw error;
  await logAudit({ action: "bulk_assign_position", entity_type: "team_member", summary: `Assigned position to ${ids.length} member(s)`, details: { ids, positionId } });
}


export async function getModules(): Promise<ModuleRow[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_modules").select("*")
    .eq("is_deleted", false).order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function createModule(payload: Partial<ModuleRow>) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("gwv_modules")
    .insert({ ...payload, created_by: u.user?.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateModule(id: string, payload: Partial<ModuleRow>) {
  const { data, error } = await (supabase as any)
    .from("gwv_modules").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function softDeleteModule(id: string) {
  const { data: u } = await supabase.auth.getUser();
  return updateModule(id, {
    is_deleted: true,
    deleted_at: new Date().toISOString() as any,
    deleted_by: u.user?.id as any,
  } as any);
}

export async function getAllModuleAccess(): Promise<ModuleAccessRow[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_user_module_access").select("*").eq("is_active", true);
  if (error) throw error;
  return data || [];
}

// ---------- BRAND ACCESS ----------
export async function getBrandAccessForMember(memberId: string): Promise<BrandAccessRow[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_user_brand_access").select("*").eq("team_member_id", memberId);
  if (error) throw error;
  return data || [];
}

export async function saveBrandAccess(memberId: string, rows: BrandAccessRow[], linkedUserId: string | null) {
  // Replace strategy: delete all, then upsert provided rows.
  await (supabase as any).from("gwv_user_brand_access").delete().eq("team_member_id", memberId);
  if (rows.length) {
    const { data: u } = await supabase.auth.getUser();
    const insertRows = rows.map((r) => ({
      ...r,
      team_member_id: memberId,
      user_id: linkedUserId,
      created_by: u.user?.id,
    }));
    const { error } = await (supabase as any).from("gwv_user_brand_access").insert(insertRows);
    if (error) throw error;
  }
  await logAudit({ action: "update_brand_access", entity_type: "brand_access", target_team_member_id: memberId, summary: `Saved ${rows.length} brand assignment(s)` });
}

// ---------- MODULE ACCESS ----------
export async function getModuleAccessForMember(memberId: string): Promise<ModuleAccessRow[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_user_module_access").select("*").eq("team_member_id", memberId);
  if (error) throw error;
  return data || [];
}

export async function saveModuleAccess(memberId: string, rows: ModuleAccessRow[], linkedUserId: string | null) {
  await (supabase as any).from("gwv_user_module_access").delete().eq("team_member_id", memberId);
  if (rows.length) {
    const { data: u } = await supabase.auth.getUser();
    const insertRows = rows.map((r) => ({
      ...r,
      team_member_id: memberId,
      user_id: linkedUserId,
      created_by: u.user?.id,
    }));
    const { error } = await (supabase as any).from("gwv_user_module_access").insert(insertRows);
    if (error) throw error;
  }
  await logAudit({ action: "update_module_access", entity_type: "module_access", target_team_member_id: memberId, summary: `Saved ${rows.length} module assignment(s)` });
}

// ---------- MASTER OPTIONS ----------
export async function getMasterOptions(optionType: string): Promise<MasterOption[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_master_options").select("*")
    .eq("option_type", optionType).eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function createMasterOption(optionType: string, label: string) {
  const value = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!value) throw new Error("Value cannot be empty.");
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("gwv_master_options")
    .insert({
      option_type: optionType,
      option_key: value,
      label: label.trim(),
      value,
      sort_order: 999,
      created_by: u.user?.id,
    })
    .select().single();
  if (error) throw error;
  return data;
}
