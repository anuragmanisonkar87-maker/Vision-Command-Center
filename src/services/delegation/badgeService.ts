// Delegation badge engine + monthly winners.
// Pure functions on top of the existing tasks + points ledger.
import { supabase } from "@/integrations/supabase/client";
import type { DelegationTask, PointsLedgerEntry } from "./delegationService";
import { getSettings } from "./delegationService";

const db = supabase as any;

export type BadgeKey =
  | "on_time_machine"
  | "zero_revision_pro"
  | "deadline_warrior"
  | "most_consistent"
  | "proof_champion";

export interface BadgeDef {
  key: BadgeKey;
  name: string;
  reason: string;
}

export const BADGE_DEFS: Record<BadgeKey, BadgeDef> = {
  on_time_machine: { key: "on_time_machine", name: "On-Time Machine", reason: "≥90% on-time approved tasks" },
  zero_revision_pro: { key: "zero_revision_pro", name: "Zero Revision Pro", reason: "Approved tasks with zero revisions" },
  deadline_warrior: { key: "deadline_warrior", name: "Deadline Warrior", reason: "High count of approved completions" },
  most_consistent: { key: "most_consistent", name: "Most Consistent", reason: "Approved completions across many days" },
  proof_champion: { key: "proof_champion", name: "Proof Champion", reason: "Submits proof consistently" },
};

export interface RewardSettings {
  enabled: Record<BadgeKey, boolean>;
  min_approved: Record<BadgeKey, number>;
  reward_label: Record<BadgeKey, string>;
}

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  enabled: {
    on_time_machine: true,
    zero_revision_pro: true,
    deadline_warrior: true,
    most_consistent: true,
    proof_champion: true,
  },
  min_approved: {
    on_time_machine: 5,
    zero_revision_pro: 5,
    deadline_warrior: 10,
    most_consistent: 5,
    proof_champion: 5,
  },
  reward_label: {
    on_time_machine: "",
    zero_revision_pro: "",
    deadline_warrior: "",
    most_consistent: "",
    proof_champion: "",
  },
};

export interface BadgeResult {
  key: BadgeKey;
  name: string;
  reason: string;
  earned: boolean;
  value: number;
  reward_label?: string;
}

/**
 * Compute badge state for a single user from approved tasks (system_stage = 'completed').
 * Pure — no I/O. Pass already-filtered tasks (the user's).
 */
export function computeUserBadges(
  approvedTasks: Pick<DelegationTask, "completed_at" | "due_date" | "revision_count" | "proof_url">[],
  settings: RewardSettings = DEFAULT_REWARD_SETTINGS,
): BadgeResult[] {
  const total = approvedTasks.length;
  const onTime = approvedTasks.filter((t) =>
    t.due_date && t.completed_at ? t.completed_at.slice(0, 10) <= t.due_date : true,
  ).length;
  const onTimePct = total > 0 ? Math.round((onTime / total) * 100) : 0;
  const zeroRev = approvedTasks.filter((t) => (t.revision_count ?? 0) === 0).length;
  const withProof = approvedTasks.filter((t) => !!t.proof_url).length;
  const proofPct = total > 0 ? Math.round((withProof / total) * 100) : 0;
  const distinctDays = new Set(
    approvedTasks
      .map((t) => (t.completed_at ? t.completed_at.slice(0, 10) : null))
      .filter(Boolean) as string[],
  ).size;

  const out: BadgeResult[] = [];
  const make = (key: BadgeKey, earned: boolean, value: number): BadgeResult => ({
    key,
    name: BADGE_DEFS[key].name,
    reason: BADGE_DEFS[key].reason,
    earned: settings.enabled[key] && earned,
    value,
    reward_label: settings.reward_label[key] || undefined,
  });

  out.push(make("on_time_machine", total >= settings.min_approved.on_time_machine && onTimePct >= 90, onTimePct));
  out.push(make("zero_revision_pro", zeroRev >= settings.min_approved.zero_revision_pro, zeroRev));
  out.push(make("deadline_warrior", total >= settings.min_approved.deadline_warrior, total));
  out.push(make("most_consistent", distinctDays >= settings.min_approved.most_consistent, distinctDays));
  out.push(make("proof_champion", total >= settings.min_approved.proof_champion && proofPct >= 80, proofPct));
  return out;
}

export type MonthlyAwardType =
  | "top_points"
  | "on_time_champion"
  | "zero_revision_champion"
  | "most_tasks"
  | "most_consistent";

export const AWARD_DEFS: Record<MonthlyAwardType, string> = {
  top_points: "Top Points Winner",
  on_time_champion: "On-Time Champion",
  zero_revision_champion: "Zero Revision Champion",
  most_tasks: "Most Tasks Approved",
  most_consistent: "Most Consistent Performer",
};

export interface MonthlyWinner {
  award_type: MonthlyAwardType;
  award_name: string;
  user_id: string | null;
  value: number;
  reward_label?: string;
}

/** Pure — calculate winners from approved tasks + ledger rows already scoped to the month. */
export function computeMonthlyWinners(
  approvedTasks: Pick<DelegationTask, "assignee_id" | "completed_at" | "due_date" | "revision_count">[],
  ledger: Pick<PointsLedgerEntry, "user_id" | "points">[],
  rewardLabels: Partial<Record<MonthlyAwardType, string>> = {},
): MonthlyWinner[] {
  const byUser = new Map<string, { points: number; completed: number; on_time: number; zero_rev: number; days: Set<string> }>();
  const ensure = (uid: string) => {
    let row = byUser.get(uid);
    if (!row) {
      row = { points: 0, completed: 0, on_time: 0, zero_rev: 0, days: new Set() };
      byUser.set(uid, row);
    }
    return row;
  };
  for (const l of ledger) ensure(l.user_id).points += l.points;
  for (const t of approvedTasks) {
    if (!t.assignee_id) continue;
    const r = ensure(t.assignee_id);
    r.completed += 1;
    const onTime = t.due_date && t.completed_at ? t.completed_at.slice(0, 10) <= t.due_date : true;
    if (onTime) r.on_time += 1;
    if ((t.revision_count ?? 0) === 0) r.zero_rev += 1;
    if (t.completed_at) r.days.add(t.completed_at.slice(0, 10));
  }

  const pickMax = (selector: (r: { points: number; completed: number; on_time: number; zero_rev: number; days: Set<string> }) => number) => {
    let bestId: string | null = null;
    let bestVal = -Infinity;
    for (const [uid, r] of byUser.entries()) {
      const v = selector(r);
      if (v > bestVal && v > 0) { bestVal = v; bestId = uid; }
    }
    return { user_id: bestId, value: bestId ? bestVal : 0 };
  };

  const tp = pickMax((r) => r.points);
  const ot = pickMax((r) => r.on_time);
  const zr = pickMax((r) => r.zero_rev);
  const mt = pickMax((r) => r.completed);
  const mc = pickMax((r) => r.days.size);

  const mk = (t: MonthlyAwardType, x: { user_id: string | null; value: number }): MonthlyWinner => ({
    award_type: t,
    award_name: AWARD_DEFS[t],
    user_id: x.user_id,
    value: x.value,
    reward_label: rewardLabels[t] || undefined,
  });

  return [
    mk("top_points", tp),
    mk("on_time_champion", ot),
    mk("zero_revision_champion", zr),
    mk("most_tasks", mt),
    mk("most_consistent", mc),
  ];
}

export function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthRange(monthStartIso: string): { from: string; to: string } {
  const [y, m] = monthStartIso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const to = next.toISOString().slice(0, 10);
  return { from: monthStartIso, to };
}

export async function getRewardSettings(): Promise<RewardSettings> {
  const s: any = await getSettings();
  const rs = (s?.reward_settings ?? {}) as Partial<RewardSettings>;
  return {
    enabled: { ...DEFAULT_REWARD_SETTINGS.enabled, ...(rs.enabled ?? {}) },
    min_approved: { ...DEFAULT_REWARD_SETTINGS.min_approved, ...(rs.min_approved ?? {}) },
    reward_label: { ...DEFAULT_REWARD_SETTINGS.reward_label, ...(rs.reward_label ?? {}) },
  };
}

export async function saveRewardSettings(next: RewardSettings): Promise<void> {
  const s: any = await getSettings();
  const merged = { ...s, reward_settings: next };
  const { error } = await db
    .from("delegation_settings")
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function getUserBadges(userId: string, period: "week" | "month" = "month"): Promise<BadgeResult[]> {
  const start = new Date();
  if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  const from = start.toISOString();
  const { data } = await db
    .from("delegation_tasks")
    .select("assignee_id, completed_at, due_date, revision_count, proof_url, system_stage, is_deleted")
    .eq("is_deleted", false)
    .eq("system_stage", "completed")
    .eq("assignee_id", userId)
    .gte("completed_at", from);
  const tasks = (data ?? []) as DelegationTask[];
  const settings = await getRewardSettings();
  return computeUserBadges(tasks, settings);
}

export interface FrozenAward {
  id: string;
  month: string;
  award_type: MonthlyAwardType;
  user_id: string;
  value: number;
  reward_label: string | null;
  frozen_by: string | null;
  frozen_at: string;
}

export async function getMonthlyWinners(month: string): Promise<{
  winners: MonthlyWinner[];
  frozen: boolean;
}> {
  const { data: frozenRows } = await db
    .from("delegation_monthly_awards")
    .select("*")
    .eq("month", month);
  const frozenArr = (frozenRows ?? []) as FrozenAward[];
  if (frozenArr.length > 0) {
    return {
      winners: frozenArr.map((f) => ({
        award_type: f.award_type,
        award_name: AWARD_DEFS[f.award_type] ?? f.award_type,
        user_id: f.user_id,
        value: Number(f.value),
        reward_label: f.reward_label ?? undefined,
      })),
      frozen: true,
    };
  }
  const { from, to } = monthRange(month);
  const [{ data: tasks }, { data: ledger }, settings] = await Promise.all([
    db.from("delegation_tasks")
      .select("assignee_id, completed_at, due_date, revision_count, system_stage, is_deleted")
      .eq("is_deleted", false)
      .eq("system_stage", "completed")
      .gte("completed_at", `${from}T00:00:00Z`)
      .lt("completed_at", `${to}T00:00:00Z`),
    db.from("delegation_points_ledger")
      .select("user_id, points, period_date")
      .gte("period_date", from)
      .lt("period_date", to),
    getRewardSettings(),
  ]);
  // Map reward labels by award type using badge reward labels for similar concepts.
  const labels: Partial<Record<MonthlyAwardType, string>> = {
    top_points: settings.reward_label.deadline_warrior,
    on_time_champion: settings.reward_label.on_time_machine,
    zero_revision_champion: settings.reward_label.zero_revision_pro,
    most_tasks: settings.reward_label.deadline_warrior,
    most_consistent: settings.reward_label.most_consistent,
  };
  return {
    winners: computeMonthlyWinners((tasks ?? []) as any, (ledger ?? []) as any, labels),
    frozen: false,
  };
}

export async function freezeMonthlyWinners(month: string, frozenBy: string): Promise<void> {
  const { winners } = await getMonthlyWinners(month);
  const rows = winners
    .filter((w) => w.user_id)
    .map((w) => ({
      month,
      award_type: w.award_type,
      user_id: w.user_id,
      value: w.value,
      reward_label: w.reward_label ?? null,
      frozen_by: frozenBy,
    }));
  if (rows.length === 0) return;
  // Upsert by (month, award_type)
  const { error } = await db
    .from("delegation_monthly_awards")
    .upsert(rows, { onConflict: "month,award_type" });
  if (error) throw new Error(error.message);
}

export async function unfreezeMonthlyWinners(month: string): Promise<void> {
  const { error } = await db.from("delegation_monthly_awards").delete().eq("month", month);
  if (error) throw new Error(error.message);
}
