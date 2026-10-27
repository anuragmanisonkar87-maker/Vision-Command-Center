// Hiring Bible integration — reads from the Hiring Bible Supabase project via
// hb_vc_* RPCs. All RPCs are SECURITY DEFINER with EXECUTE granted to anon, so
// no service role / signed-in user is required from Vision Center's side.
//
// All functions degrade gracefully: if the call fails (network, project paused,
// RPC missing), they return empty data with `connected: false` so the UI can
// fall back to manual flows without crashing.

import { hiringBible, HIRING_BIBLE_URL } from "@/integrations/hiringBible/client";
import type {
  HbCompanyPosition,
  HbCandidate,
  HbDailyInterviewSummary,
  HbPoolHealthRow,
  HbSyncHealth,
} from "@/types/hr/hiringBible";

export type HiringBibleStatus = {
  connected: boolean;
  lastSyncedAt: string | null;
  positionsFetched: number;
  poolCandidates: number;
  interviewsToday: number;
  syncStatus: string;
  errors: string[];
};

export { HIRING_BIBLE_URL };
export const getHiringBibleUrl = () => HIRING_BIBLE_URL;

const hb = hiringBible as any;

async function safeRpc<T>(name: string, args?: Record<string, any>): Promise<T[] | null> {
  try {
    const { data, error } = await hb.rpc(name, args ?? {});
    if (error) {
      console.warn(`[HiringBible] ${name} failed:`, error.message);
      return null;
    }
    return (data ?? []) as T[];
  } catch (e: any) {
    console.warn(`[HiringBible] ${name} threw:`, e?.message);
    return null;
  }
}

export async function getCompanyPositionsFromHiringBible(): Promise<HbCompanyPosition[]> {
  return (await safeRpc<HbCompanyPosition>("hb_vc_get_company_positions")) ?? [];
}

export async function getCandidatePoolFromHiringBible(): Promise<HbCandidate[]> {
  return (await safeRpc<HbCandidate>("hb_vc_get_candidate_pool")) ?? [];
}

export async function getPoolHealthFromHiringBible(): Promise<HbPoolHealthRow[]> {
  return (await safeRpc<HbPoolHealthRow>("hb_vc_get_pool_health")) ?? [];
}

export async function getDailyInterviewSummaryFromHiringBible(
  dateStr?: string,
): Promise<HbDailyInterviewSummary | null> {
  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const rows = await safeRpc<HbDailyInterviewSummary>("hb_vc_get_daily_interview_summary", {
    p_report_date: today,
  });
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function getHiringBibleSyncHealth(): Promise<HbSyncHealth | null> {
  const rows = await safeRpc<HbSyncHealth>("hb_vc_get_sync_health");
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

// Single shape used by the dashboard cards.
export async function getHiringBibleConnectionStatus(): Promise<HiringBibleStatus> {
  const sync = await getHiringBibleSyncHealth();
  if (!sync) {
    return {
      connected: false,
      lastSyncedAt: null,
      positionsFetched: 0,
      poolCandidates: 0,
      interviewsToday: 0,
      syncStatus: "not_connected",
      errors: ["Hiring Bible RPCs not reachable"],
    };
  }
  const interviews = await getDailyInterviewSummaryFromHiringBible();
  return {
    connected: !!sync.database_connected,
    lastSyncedAt:
      sync.last_candidate_pool_update ?? sync.last_interview_update ?? null,
    positionsFetched: sync.total_active_positions ?? 0,
    poolCandidates: sync.total_pool_candidates ?? 0,
    interviewsToday: interviews?.total_interviews_conducted ?? 0,
    syncStatus: sync.sync_status ?? "ok",
    errors: sync.errors ?? [],
  };
}

// Stub kept for compatibility — real "send to pool" lives inside Hiring Bible.
export async function sendHiringBibleCandidateToPool(_data: any) {
  throw new Error("Add candidates to the pool inside Hiring Bible.");
}

// ── Helpers used by UI ───────────────────────────────────────

const norm = (v: string | null | undefined) =>
  (v ?? "").trim().toLowerCase().replace(/[\s_\-']+/g, "");

/** Filter HB positions for a given Vision Center brand name.
 * Matches on brand_name OR brand_key with normalisation (case + punctuation
 * insensitive) so "India Photographers Club" matches brand_key "ipc" or
 * "india_photographers_club". */
export function filterPositionsByBrand(
  positions: HbCompanyPosition[],
  brandName: string | null | undefined,
): HbCompanyPosition[] {
  if (!brandName) return positions;
  const needle = norm(brandName);
  // Common short-key aliases for our brands so HB and VC stay in sync even
  // when key conventions differ.
  const aliases: Record<string, string[]> = {
    indiaphotographersclub: ["ipc", "indiaphotographersclub"],
    themulberryweddings: ["tmw", "themulberryweddings", "mulberry"],
    marketizers: ["marketizers"],
    gratefulworldventures: ["parentcompany", "gratefulworldventures", "gwv"],
  };
  const candidates = new Set<string>([needle, ...(aliases[needle] ?? [])]);
  return positions.filter(
    (p) => candidates.has(norm(p.brand_name)) || candidates.has(norm(p.brand_key)),
  );
}

/** Compute pool health rows client-side from the live candidate pool joined
 * onto the Hiring Bible position registry. This is the source of truth for
 * the HR Command Center because HB's own pool-health RPC sometimes
 * aggregates with a different brand_key than the candidate rows, returning
 * zero counts even when candidates exist. */
export function buildPoolHealthFromCandidates(
  positions: HbCompanyPosition[],
  candidates: HbCandidate[],
  minReady = 3,
): HbPoolHealthRow[] {
  const matchKey = (p: HbCompanyPosition) =>
    `${norm(p.brand_key) || norm(p.brand_name)}::${norm(p.position_key) || norm(p.position_name)}`;
  const candKey = (c: HbCandidate) =>
    `${norm(c.brand_key) || norm(c.brand_name)}::${norm(c.position_key) || norm(c.position_name)}`;

  const byPos = new Map<string, HbCandidate[]>();
  for (const c of candidates) {
    const k = candKey(c);
    if (!byPos.has(k)) byPos.set(k, []);
    byPos.get(k)!.push(c);
  }
  // Also bucket by position_key only (loose match) for cross-brand fallback.
  const looseByPos = new Map<string, HbCandidate[]>();
  for (const c of candidates) {
    const k = norm(c.position_key) || norm(c.position_name);
    if (!k) continue;
    if (!looseByPos.has(k)) looseByPos.set(k, []);
    looseByPos.get(k)!.push(c);
  }

  return positions.map((p) => {
    const strict = byPos.get(matchKey(p)) ?? [];
    const loose = looseByPos.get(norm(p.position_key) || norm(p.position_name)) ?? [];
    // Prefer strict (brand+position) match. If empty, surface loose match
    // so the user sees their candidate even when HB brand_key drifts.
    const pool = strict.length > 0 ? strict : loose;

    const lvl = (c: HbCandidate) => norm(c.readiness_level);
    const fr = (c: HbCandidate) => norm(c.freshness_status);
    const ready_now_count = pool.filter((c) => lvl(c).includes("readynow") || lvl(c) === "immediate").length;
    const ready_soon_count = pool.filter((c) => lvl(c).includes("readysoon") || lvl(c).includes("shortterm")).length;
    const future_fit_count = pool.filter((c) => lvl(c).includes("future")).length;
    const hold_count = pool.filter((c) => lvl(c).includes("hold")).length;
    const fresh_count = pool.filter((c) => fr(c) === "fresh").length;
    const warm_count = pool.filter((c) => fr(c) === "warm").length;
    const cold_count = pool.filter((c) => fr(c) === "cold").length;
    const expired_count = pool.filter((c) => fr(c) === "expired").length;
    const total_active_pool = pool.length;
    const target = p.target_pool_count ?? 20;
    let pool_health_status: HbPoolHealthRow["pool_health_status"];
    if (total_active_pool === 0) pool_health_status = "Empty";
    else if (ready_now_count >= minReady && total_active_pool >= target * 0.6) pool_health_status = "Healthy";
    else if (ready_now_count >= 1 || total_active_pool >= target * 0.3) pool_health_status = "Warning";
    else pool_health_status = "Critical";

    return {
      position_id: p.position_id,
      brand_name: p.brand_name,
      position_name: p.position_name,
      target_pool_count: p.target_pool_count,
      total_active_pool,
      ready_now_count,
      ready_soon_count,
      future_fit_count,
      hold_count,
      fresh_count,
      warm_count,
      cold_count,
      expired_count,
      pool_health_status,
    };
  });
}
