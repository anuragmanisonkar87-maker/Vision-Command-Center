// Video Editor KPI service — config + daily row CRUD.
import { supabase } from "@/integrations/supabase/client";

export type VeFieldType = "number" | "boolean" | "text" | "currency";
export type VeFieldDef = { key: string; name: string; type: VeFieldType; required?: boolean };

export type VeConfig = {
  id: string;
  fields: VeFieldDef[];
  daily_commit_target: number;
  cn_label: string;
  cn_target: number;
  cn_super_green: number;
  cn_green: number;
  cn_red: number;
};

export type VeDailyRow = {
  id: string;
  team_member_id: string;
  report_date: string;
  committed_pieces: number;
  shipped_finished: number;
  finish_gate_passed: boolean;
  max_revision_rounds: number;
  backed_up_eod: boolean;
  blockers: string | null;
  extra: Record<string, unknown>;
  good_day: boolean;
  created_by: string | null;
};

const TBL_CFG = "video_editor_kpi_config";
const TBL_ROW = "video_editor_daily_kpi";

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getActiveConfig(): Promise<VeConfig | null> {
  const { data, error } = await (supabase as any)
    .from(TBL_CFG).select("*").eq("is_active", true)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normaliseConfig(data) : null;
}

export async function saveConfig(cfg: Partial<VeConfig> & { id: string }): Promise<void> {
  const { id, ...rest } = cfg;
  const { error } = await (supabase as any).from(TBL_CFG).update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}

function normaliseConfig(r: any): VeConfig {
  return {
    id: r.id,
    fields: Array.isArray(r.fields) ? r.fields : [],
    daily_commit_target: Number(r.daily_commit_target) || 0,
    cn_label: r.cn_label ?? "",
    cn_target: Number(r.cn_target) || 0,
    cn_super_green: Number(r.cn_super_green) || 0,
    cn_green: Number(r.cn_green) || 0,
    cn_red: Number(r.cn_red) || 0,
  };
}

export function computeGoodDay(v: {
  committed_pieces: number;
  shipped_finished: number;
  finish_gate_passed: boolean;
  backed_up_eod: boolean;
}): boolean {
  return (
    v.shipped_finished >= v.committed_pieces &&
    v.committed_pieces > 0 &&
    v.finish_gate_passed &&
    v.backed_up_eod
  );
}

export async function getDaily(teamMemberId: string, dateISO: string): Promise<VeDailyRow | null> {
  const { data, error } = await (supabase as any)
    .from(TBL_ROW).select("*")
    .eq("team_member_id", teamMemberId).eq("report_date", dateISO)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as VeDailyRow) ?? null;
}

export async function upsertDaily(
  teamMemberId: string,
  userId: string,
  dateISO: string,
  v: Omit<VeDailyRow, "id" | "team_member_id" | "report_date" | "good_day" | "created_by">,
): Promise<VeDailyRow> {
  const good_day = computeGoodDay(v);
  const payload = {
    team_member_id: teamMemberId,
    report_date: dateISO,
    ...v,
    good_day,
    created_by: userId,
  };
  const { data, error } = await (supabase as any)
    .from(TBL_ROW)
    .upsert(payload, { onConflict: "team_member_id,report_date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as VeDailyRow;
}

export async function listDailyRange(
  teamMemberId: string | null, // null = admin sees all
  fromISO: string,
  toISO: string,
): Promise<VeDailyRow[]> {
  let q = (supabase as any).from(TBL_ROW).select("*")
    .gte("report_date", fromISO).lte("report_date", toISO)
    .order("report_date", { ascending: false });
  if (teamMemberId) q = q.eq("team_member_id", teamMemberId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as VeDailyRow[]) ?? [];
}
