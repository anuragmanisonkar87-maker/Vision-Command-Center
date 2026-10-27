// Generic KPI service — per-position config + personal daily entries.
// Reuses conventions from services/videoEditor and services/attendance.
import { supabase } from "@/integrations/supabase/client";

const TBL_CFG = "kpi_position_config";
const TBL_DEF = "kpi_definitions";
const TBL_ROW = "kpi_daily_entry";

export type KpiType = "commit_ship" | "number" | "boolean" | "quality_gate";
export type KpiDirection = "higher_better" | "lower_better";

export type KpiDefinition = {
  id: string;
  config_id: string;
  kpi_key: string;
  label: string;
  description: string | null;
  kpi_type: KpiType;
  unit: string | null;
  target: number | null;
  direction: KpiDirection;
  is_quality_gate: boolean;
  weight: number;
  sort_order: number;
  is_active: boolean;
};

export type GoodDayRule = {
  min_ship_ratio?: number;
  require_quality_gate?: boolean;
  required_kpis?: string[];
};

export type KpiPositionConfig = {
  id: string;
  position_id: string;
  critical_number: string | null;
  critical_number_target: number | null;
  critical_number_unit: string | null;
  quarter_label: string | null;
  daily_commit_target: number;
  good_day_rule: GoodDayRule;
  is_active: boolean;
};

export type KpiDailyEntry = {
  id: string;
  team_member_id: string;
  position_id: string | null;
  entry_date: string;
  committed: number | null;
  shipped: number | null;
  quality_passed: boolean | null;
  values: Record<string, unknown>;
  good_day: boolean | null;
  note: string | null;
  created_by: string | null;
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Pure logic (unit-testable, no DB) ──────────────────────────
export function computeGoodDay(
  config: Pick<KpiPositionConfig, "good_day_rule">,
  definitions: KpiDefinition[],
  entry: Pick<KpiDailyEntry, "committed" | "shipped" | "quality_passed" | "values">,
): boolean {
  const rule = config.good_day_rule || {};
  const ratio = typeof rule.min_ship_ratio === "number" ? rule.min_ship_ratio : 1.0;
  const requireQuality = rule.require_quality_gate !== false; // default true
  const required = Array.isArray(rule.required_kpis) ? rule.required_kpis : [];

  const committed = Number(entry.committed || 0);
  const shipped = Number(entry.shipped || 0);
  if (committed <= 0) return false;
  if (shipped < committed * ratio) return false;

  if (requireQuality && entry.quality_passed !== true) return false;

  // All is_quality_gate definitions must pass
  for (const def of definitions) {
    if (!def.is_active) continue;
    if (def.is_quality_gate || def.kpi_type === "quality_gate") {
      const v = (entry.values || {})[def.kpi_key];
      if (v !== true && v !== "true" && v !== 1) return false;
    }
  }

  // Required KPIs must have a truthy value or meet target
  for (const key of required) {
    const def = definitions.find((d) => d.kpi_key === key);
    const v = (entry.values || {})[key];
    if (def && def.target != null && typeof v === "number") {
      const ok = def.direction === "lower_better" ? v <= def.target : v >= def.target;
      if (!ok) return false;
    } else if (v === undefined || v === null || v === false || v === "") {
      return false;
    }
  }

  return true;
}

// Case-insensitive contains match — used to gate UI by position name.
export function positionMatches(actual: string | null | undefined, needle: string): boolean {
  if (!actual || !needle) return false;
  return actual.toLowerCase().includes(needle.toLowerCase());
}

// ── DB helpers ─────────────────────────────────────────────────
export async function listConfigs(): Promise<Array<KpiPositionConfig & { position_name: string | null }>> {
  const { data, error } = await (supabase as any)
    .from(TBL_CFG).select("*, gwv_positions(name)");
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((r) => ({ ...normaliseConfig(r), position_name: r.gwv_positions?.name ?? null }));
}

export async function getConfigForPosition(positionId: string): Promise<KpiPositionConfig | null> {
  const { data, error } = await (supabase as any)
    .from(TBL_CFG).select("*").eq("position_id", positionId).eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normaliseConfig(data) : null;
}

export async function upsertConfig(
  positionId: string,
  patch: Partial<Omit<KpiPositionConfig, "id" | "position_id">>,
  userId: string,
): Promise<KpiPositionConfig> {
  const payload: any = { position_id: positionId, ...patch, created_by: userId };
  const { data, error } = await (supabase as any)
    .from(TBL_CFG).upsert(payload, { onConflict: "position_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return normaliseConfig(data);
}

export async function deleteConfig(id: string): Promise<void> {
  const { error } = await (supabase as any).from(TBL_CFG).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listDefinitions(configId: string): Promise<KpiDefinition[]> {
  const { data, error } = await (supabase as any)
    .from(TBL_DEF).select("*").eq("config_id", configId).order("sort_order").order("label");
  if (error) throw new Error(error.message);
  return (data as KpiDefinition[]) ?? [];
}

export async function upsertDefinition(def: Partial<KpiDefinition> & { config_id: string; kpi_key: string; label: string; kpi_type: KpiType }): Promise<KpiDefinition> {
  const { data, error } = await (supabase as any)
    .from(TBL_DEF).upsert(def, { onConflict: "config_id,kpi_key" }).select("*").single();
  if (error) throw new Error(error.message);
  return data as KpiDefinition;
}

export async function deleteDefinition(id: string): Promise<void> {
  const { error } = await (supabase as any).from(TBL_DEF).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getDaily(teamMemberId: string, dateISO: string): Promise<KpiDailyEntry | null> {
  const { data, error } = await (supabase as any)
    .from(TBL_ROW).select("*").eq("team_member_id", teamMemberId).eq("entry_date", dateISO).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as KpiDailyEntry) ?? null;
}

export async function upsertDaily(args: {
  teamMemberId: string;
  positionId: string | null;
  dateISO: string;
  userId: string;
  config: KpiPositionConfig;
  definitions: KpiDefinition[];
  committed: number;
  shipped: number;
  quality_passed: boolean;
  values: Record<string, unknown>;
  note?: string;
}): Promise<KpiDailyEntry> {
  const good_day = computeGoodDay(args.config, args.definitions, {
    committed: args.committed, shipped: args.shipped, quality_passed: args.quality_passed, values: args.values,
  });
  const payload = {
    team_member_id: args.teamMemberId,
    position_id: args.positionId,
    entry_date: args.dateISO,
    committed: args.committed,
    shipped: args.shipped,
    quality_passed: args.quality_passed,
    values: args.values,
    note: args.note ?? null,
    good_day,
    created_by: args.userId,
  };
  const { data, error } = await (supabase as any)
    .from(TBL_ROW).upsert(payload, { onConflict: "team_member_id,entry_date" }).select("*").single();
  if (error) throw new Error(error.message);
  return data as KpiDailyEntry;
}

export async function listDailyRange(
  teamMemberId: string | null,
  fromISO: string,
  toISO: string,
): Promise<KpiDailyEntry[]> {
  let q = (supabase as any).from(TBL_ROW).select("*")
    .gte("entry_date", fromISO).lte("entry_date", toISO)
    .order("entry_date", { ascending: false });
  if (teamMemberId) q = q.eq("team_member_id", teamMemberId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as KpiDailyEntry[]) ?? [];
}

export async function listPositions(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await (supabase as any)
    .from("gwv_positions").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return (data as any[]) ?? [];
}

function normaliseConfig(r: any): KpiPositionConfig {
  return {
    id: r.id,
    position_id: r.position_id,
    critical_number: r.critical_number ?? null,
    critical_number_target: r.critical_number_target != null ? Number(r.critical_number_target) : null,
    critical_number_unit: r.critical_number_unit ?? null,
    quarter_label: r.quarter_label ?? null,
    daily_commit_target: Number(r.daily_commit_target ?? 0),
    good_day_rule: (r.good_day_rule && typeof r.good_day_rule === "object") ? r.good_day_rule : {},
    is_active: !!r.is_active,
  };
}
