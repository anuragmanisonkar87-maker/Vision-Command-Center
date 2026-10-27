import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const T = "gwv_hr_hiring_requirements";

export type HiringRequirement = {
  id: string;
  brand_id?: string | null;
  brand_name?: string | null;
  department?: string | null;
  position_name: string;
  openings: number;
  priority: string;
  reporting_manager?: string | null;
  work_mode?: string | null;
  location?: string | null;
  salary_range?: string | null;
  experience_required?: string | null;
  skills_required?: string | null;
  reason_for_hiring?: string | null;
  special_notes?: string | null;
  source: string;
  assigned_date: string;
  sla_days: number;
  deadline_date: string;
  status: string;
  filled_count: number;
  is_filled: boolean;
  sla_status: string;
  missed_sla: boolean;
  created_at: string;
  updated_at: string;
};

export async function listHiringRequirements(opts: { includeArchived?: boolean } = {}) {
  const q = sb.from(T).select("*").order("created_at", { ascending: false });
  if (!opts.includeArchived) q.eq("is_deleted", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as HiringRequirement[];
}

export async function createHiringRequirement(payload: Partial<HiringRequirement> & { position_name: string }) {
  const { data: user } = await sb.auth.getUser();
  const insert = {
    ...payload,
    sla_days: payload.sla_days ?? 4,
    priority: payload.priority ?? "normal",
    openings: payload.openings ?? 1,
    source: payload.source ?? "director_form",
    status: payload.status ?? "new",
    created_by: user?.user?.id ?? null,
  };
  const { data, error } = await sb.from(T).insert(insert).select().single();
  if (error) throw error;

  // Notify HR
  await sb.from("gwv_hr_notifications").insert({
    role_target: "hr",
    priority: payload.priority === "urgent" ? "critical" : "high",
    title: `New hiring requirement: ${payload.position_name}`,
    message: `${payload.brand_name ?? "GWV"} · ${payload.openings ?? 1} opening(s) · SLA ${payload.sla_days ?? 4}d`,
    source_type: "hiring_requirement",
    source_id: data.id,
  });
  return data as HiringRequirement;
}

export async function updateHiringRequirement(id: string, patch: Partial<HiringRequirement>) {
  const { data, error } = await sb.from(T).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as HiringRequirement;
}

export async function archiveHiringRequirement(id: string) {
  const { data: user } = await sb.auth.getUser();
  const { error } = await sb.from(T).update({
    is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.user?.id ?? null,
  }).eq("id", id);
  if (error) throw error;
}

export function slaState(deadline: string): { tone: "green" | "amber" | "red" | "critical"; daysLeft: number; label: string } {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(deadline); d.setHours(0,0,0,0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { tone: "critical", daysLeft: days, label: `Overdue ${Math.abs(days)}d` };
  if (days === 0) return { tone: "red", daysLeft: 0, label: "Due today" };
  if (days === 1) return { tone: "red", daysLeft: 1, label: "Due tomorrow" };
  if (days === 2) return { tone: "amber", daysLeft: 2, label: "2 days left" };
  return { tone: "green", daysLeft: days, label: `${days} days left` };
}
