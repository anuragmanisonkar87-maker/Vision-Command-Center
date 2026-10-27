import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const T = "gwv_hr_candidate_pool";

export type Candidate = {
  id: string;
  candidate_name: string;
  phone: string;
  email?: string | null;
  brand_name?: string | null;
  position_name: string;
  readiness_tier: string;
  freshness_status: string;
  last_contacted_at?: string | null;
  ready_to_join_from?: string | null;
  expected_salary?: string | null;
  hr_remarks?: string | null;
  is_active: boolean;
  created_at: string;
};

export async function listCandidates() {
  const { data, error } = await sb.from(T).select("*").eq("is_deleted", false).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Candidate[];
}

export async function createCandidate(payload: Partial<Candidate> & { candidate_name: string; phone: string; position_name: string }) {
  const { data: user } = await sb.auth.getUser();
  const { data, error } = await sb.from(T).insert({
    readiness_tier: "warm", freshness_status: "fresh", is_active: true,
    ...payload, created_by: user?.user?.id ?? null,
    last_contacted_at: payload.last_contacted_at ?? new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data as Candidate;
}

export async function updateCandidate(id: string, patch: Partial<Candidate>) {
  const { error } = await sb.from(T).update(patch).eq("id", id);
  if (error) throw error;
}

export async function archiveCandidate(id: string) {
  const { error } = await sb.from(T).update({ is_deleted: true }).eq("id", id);
  if (error) throw error;
}

export type PoolHealth = {
  position: string;
  total: number;
  readyNow: number;
  readySoon: number;
  warm: number;
  cold: number;
  health: "healthy" | "warning" | "critical";
};

export function computePoolHealth(
  candidates: Candidate[],
  poolTarget: number,
  minReadyNow: number,
): PoolHealth[] {
  const grouped: Record<string, Candidate[]> = {};
  candidates.forEach((c) => {
    if (!c.is_active) return;
    grouped[c.position_name] = grouped[c.position_name] || [];
    grouped[c.position_name].push(c);
  });
  return Object.entries(grouped).map(([position, list]) => {
    const readyNow = list.filter((c) => c.readiness_tier === "ready_now").length;
    const readySoon = list.filter((c) => c.readiness_tier === "ready_soon").length;
    const warm = list.filter((c) => c.readiness_tier === "warm").length;
    const cold = list.filter((c) => ["cold", "expired"].includes(c.readiness_tier)).length;
    const total = list.length;
    let health: PoolHealth["health"] = "healthy";
    if (readyNow < minReadyNow || total < poolTarget * 0.4) health = "critical";
    else if (total < poolTarget) health = "warning";
    return { position, total, readyNow, readySoon, warm, cold, health };
  });
}
