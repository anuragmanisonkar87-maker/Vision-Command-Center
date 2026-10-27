// Marketizers ROAS sessions — service layer.
import { supabase } from "@/integrations/supabase/client";

const T = "marketizers_roas_sessions" as const;
const SEG = "marketizers_roas_audience_segments" as const;

export type RoasSession = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  media_buyer_id: string | null;
  media_buyer_name: string | null;
  event_type: string | null;
  event_name: string | null;
  offer_name: string | null;
  product_final_value: number | null;
  token_amount: number | null;
  campaign_date_from: string | null;
  campaign_date_to: string | null;
  event_dates: string[] | null;
  event_day_pattern: string | null;
  ad_spend: number;
  leads: number;
  cpm: number | null;
  cpc: number | null;
  cpl: number | null;
  cpp: number | null;
  ctr: number | null;
  landing_page_views: number | null;
  token_purchases: number;
  final_purchases: number;
  token_revenue: number;
  final_revenue: number;
  total_revenue: number;
  manual_revenue_override: number | null;
  roas: number | null;
  pnl: number | null;
  showup_count: number | null;
  showup_percent: number | null;
  heard_count: number | null;
  sales_count: number | null;
  offer_showup_count: number | null;
  offer_showup_percent: number | null;
  lead_drop_rate: number | null;
  cpl_drop_percent: number | null;
  final_purchase_conversion: number | null;
  revenue_per_lead: number | null;
  profit_per_lead: number | null;
  performance_health: string | null;
  source_type: string | null;
  google_sheet_url: string | null;
  meta_ad_account: string | null;
  campaign_name: string | null;
  notes: string | null;
  currency: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type AudienceSegment = {
  id: string;
  session_id: string;
  segment_name: string;
  segment_percentage: number | null;
  segment_count: number | null;
  sort_order: number;
};

export type RoasSessionInput = Omit<
  Partial<RoasSession>,
  "id" | "created_at" | "updated_at" | "deleted_at" | "deleted_by"
>;

export async function listRoasSessions(opts?: {
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  limit?: number;
}): Promise<RoasSession[]> {
  let q = supabase
    .from(T as any)
    .select("*")
    .order("campaign_date_to", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts?.onlyDeleted) {
    q = q.not("deleted_at", "is", null);
  } else if (!opts?.includeDeleted) {
    q = q.is("deleted_at", null);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoasSession[];
}

export async function getRoasSession(id: string): Promise<{
  session: RoasSession;
  segments: AudienceSegment[];
}> {
  const [{ data: s, error: e1 }, { data: segs, error: e2 }] = await Promise.all([
    supabase.from(T as any).select("*").eq("id", id).maybeSingle(),
    supabase.from(SEG as any).select("*").eq("session_id", id).order("sort_order"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  if (!s) throw new Error("Session not found.");
  return {
    session: s as unknown as RoasSession,
    segments: (segs ?? []) as unknown as AudienceSegment[],
  };
}

export async function saveRoasSession(
  input: RoasSessionInput,
  segments: Omit<AudienceSegment, "id" | "session_id">[],
  existingId?: string,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id ?? null;
  const payload = { ...input, ...(existingId ? {} : { created_by: userId }) };

  let id = existingId;
  if (existingId) {
    const { error } = await supabase
      .from(T as any)
      .update(payload as any)
      .eq("id", existingId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from(T as any)
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = (data as any).id;
  }

  // Replace audience segments
  if (id) {
    await supabase.from(SEG as any).delete().eq("session_id", id);
    if (segments.length) {
      const rows = segments.map((s, i) => ({ ...s, session_id: id, sort_order: i }));
      const { error } = await supabase.from(SEG as any).insert(rows as any);
      if (error) throw new Error(error.message);
    }
  }
  return id!;
}

export async function softDeleteRoasSession(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(T as any)
    .update({ deleted_at: new Date().toISOString(), deleted_by: u?.user?.id ?? null } as any)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restoreRoasSession(id: string): Promise<void> {
  const { error } = await supabase
    .from(T as any)
    .update({ deleted_at: null, deleted_by: null } as any)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicateRoasSession(id: string): Promise<string> {
  const { session, segments } = await getRoasSession(id);
  const { id: _id, created_at, updated_at, deleted_at, deleted_by, ...rest } = session;
  const newName = (session.event_name ?? "ROAS Session") + " (copy)";
  return saveRoasSession({ ...rest, event_name: newName } as RoasSessionInput, segments);
}

export type MonthSummary = {
  totalLeads: number;
  totalAdSpend: number;
  totalRevenue: number;
  totalPnl: number;
  avgCpl: number;
  sessions: number;
};

export async function getMonthRoasSummary(month: string): Promise<MonthSummary> {
  // month: YYYY-MM
  const start = `${month}-01`;
  const [yy, mm] = month.split("-").map(Number);
  const nextM = mm === 12 ? 1 : mm + 1;
  const nextY = mm === 12 ? yy + 1 : yy;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const { data, error } = await supabase
    .from(T as any)
    .select("ad_spend, leads, total_revenue, pnl")
    .is("deleted_at", null)
    .gte("campaign_date_to", start)
    .lt("campaign_date_to", end);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const totalLeads = rows.reduce((s, r) => s + Number(r.leads || 0), 0);
  const totalAdSpend = rows.reduce((s, r) => s + Number(r.ad_spend || 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
  const totalPnl = rows.reduce((s, r) => s + Number(r.pnl || 0), 0);
  return {
    totalLeads,
    totalAdSpend,
    totalRevenue,
    totalPnl,
    avgCpl: totalLeads > 0 ? totalAdSpend / totalLeads : 0,
    sessions: rows.length,
  };
}
