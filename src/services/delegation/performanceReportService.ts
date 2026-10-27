// Monthly Performance Report engine.
// Pure compute functions + thin I/O wrappers on top of the existing
// delegation tables. No AI, no subjective text — everything is deterministic.
import { supabase } from "@/integrations/supabase/client";
import type {
  DelegationTask,
  PointsLedgerEntry,
  ActivityEntry,
  DueDateRequest,
} from "./delegationService";
import {
  computeUserBadges,
  computeMonthlyWinners,
  getRewardSettings,
  type BadgeResult,
  type MonthlyWinner,
} from "./badgeService";

const db = supabase as any;

/* ──────────────────────── Types ──────────────────────── */

export type Grade = "Excellent" | "Good" | "Needs Attention" | "Critical";

export interface ReportSummary {
  approved_tasks: number;
  submitted_tasks: number;
  total_points: number;
  on_time_pct: number;
  late_tasks: number;
  zero_revision_tasks: number;
  total_revisions: number;
  proof_submitted: number;
  due_date_requests: number;
  due_date_approved: number;
  due_date_rejected: number;
}

export interface ReportTaskRow {
  id: string;
  title: string;
  due_date: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  status: string;
  system_stage: string;
  points: number;
  revision_count: number;
  proof_url: string | null;
  delay_reason: string | null;
  activity_count: number;
}

export interface MonthlyUserReport {
  user_id: string;
  month: string; // YYYY-MM-01
  summary: ReportSummary;
  tasks: ReportTaskRow[];
  badges: BadgeResult[];
  winner_titles: { award_type: string; award_name: string; reward_label?: string }[];
  score: number;
  grade: Grade;
  insights: string[];
  frozen: boolean;
  frozen_at?: string | null;
}

export interface TeamOverviewRow {
  user_id: string;
  approved_tasks: number;
  points: number;
  on_time_pct: number;
  revisions: number;
  badges_earned: number;
  score: number;
  grade: Grade;
}

/* ──────────────────────── Pure compute ──────────────────────── */

export function computeSummary(
  approved: Pick<DelegationTask, "due_date" | "completed_at" | "revision_count" | "proof_url">[],
  submittedCount: number,
  ledger: Pick<PointsLedgerEntry, "points">[],
  ddRequests: Pick<DueDateRequest, "status">[],
): ReportSummary {
  const total = approved.length;
  const onTime = approved.filter((t) =>
    t.due_date && t.completed_at ? t.completed_at.slice(0, 10) <= t.due_date : true,
  ).length;
  return {
    approved_tasks: total,
    submitted_tasks: submittedCount,
    total_points: ledger.reduce((s, r) => s + (r.points ?? 0), 0),
    on_time_pct: total ? Math.round((onTime / total) * 100) : 0,
    late_tasks: total - onTime,
    zero_revision_tasks: approved.filter((t) => (t.revision_count ?? 0) === 0).length,
    total_revisions: approved.reduce((s, t) => s + (t.revision_count ?? 0), 0),
    proof_submitted: approved.filter((t) => !!t.proof_url).length,
    due_date_requests: ddRequests.length,
    due_date_approved: ddRequests.filter((r) => r.status === "approved").length,
    due_date_rejected: ddRequests.filter((r) => r.status === "rejected").length,
  };
}

/** Deterministic 0-100 score. All sub-scores capped, no negatives below 0. */
export function computeScore(s: ReportSummary): number {
  const total = s.approved_tasks;
  if (total === 0) return 0;
  // Points contribution: 30 pts (cap at 100 ledger points = full)
  const pointsScore = Math.min(30, (Math.max(s.total_points, 0) / 100) * 30);
  // On-time contribution: 25 pts
  const onTimeScore = (s.on_time_pct / 100) * 25;
  // Zero-revision contribution: 20 pts
  const zeroRevPct = total ? s.zero_revision_tasks / total : 0;
  const zeroRevScore = zeroRevPct * 20;
  // Proof discipline: 15 pts
  const proofPct = total ? s.proof_submitted / total : 0;
  const proofScore = proofPct * 15;
  // Volume / engagement baseline: 10 pts (≥10 approved tasks = full)
  const volumeScore = Math.min(10, (total / 10) * 10);
  // Penalty: -2 per revision, -3 per late, capped at -25
  const penalty = Math.min(25, s.total_revisions * 2 + s.late_tasks * 3);

  const raw = pointsScore + onTimeScore + zeroRevScore + proofScore + volumeScore - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function computeGrade(score: number): Grade {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Attention";
  return "Critical";
}

export function computeInsights(s: ReportSummary): string[] {
  const out: string[] = [];
  if (s.approved_tasks === 0) {
    out.push(`Low approved task count (${s.approved_tasks})`);
    return out;
  }
  if (s.on_time_pct >= 90) out.push(`Strong on-time completion (${s.on_time_pct}%)`);
  const proofPct = Math.round((s.proof_submitted / s.approved_tasks) * 100);
  if (proofPct >= 80) out.push(`Good proof discipline (${proofPct}%)`);
  if (s.total_revisions >= s.approved_tasks) out.push(`High revision count (${s.total_revisions} revisions)`);
  if (s.due_date_requests >= 5) out.push(`Frequent due-date change requests (${s.due_date_requests})`);
  if (s.approved_tasks < 5) out.push(`Low approved task count (${s.approved_tasks})`);
  const zeroRevPct = Math.round((s.zero_revision_tasks / s.approved_tasks) * 100);
  if (zeroRevPct >= 80 && s.on_time_pct >= 80) out.push(`Strong consistency (${zeroRevPct}% zero-revision)`);
  return out;
}

export function monthIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return { from: month, to: next.toISOString().slice(0, 10) };
}

/* ──────────────────────── I/O ──────────────────────── */

export interface FrozenAppraisal {
  id: string;
  month: string;
  user_id: string;
  report_json: MonthlyUserReport;
  score: number;
  grade: Grade;
  frozen_by: string | null;
  frozen_at: string;
  created_at: string;
}

async function getFrozen(month: string, userId: string): Promise<FrozenAppraisal | null> {
  const { data } = await db
    .from("delegation_monthly_appraisals")
    .select("*")
    .eq("month", month)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as FrozenAppraisal | null) ?? null;
}

export async function getMonthlyUserReport(userId: string, month: string): Promise<MonthlyUserReport> {
  const frozen = await getFrozen(month, userId);
  if (frozen) {
    return { ...frozen.report_json, frozen: true, frozen_at: frozen.frozen_at };
  }
  const { from, to } = monthRange(month);

  const [{ data: tasksData }, { data: ledgerData }, { data: ddData }, settings] = await Promise.all([
    db.from("delegation_tasks")
      .select("*")
      .eq("is_deleted", false)
      .eq("assignee_id", userId)
      .or(`and(system_stage.eq.completed,completed_at.gte.${from}T00:00:00Z,completed_at.lt.${to}T00:00:00Z),and(system_stage.eq.submitted,updated_at.gte.${from}T00:00:00Z,updated_at.lt.${to}T00:00:00Z)`),
    db.from("delegation_points_ledger")
      .select("*")
      .eq("user_id", userId)
      .gte("period_date", from)
      .lt("period_date", to),
    db.from("delegation_due_date_requests")
      .select("status, created_at, requested_by")
      .eq("requested_by", userId)
      .gte("created_at", `${from}T00:00:00Z`)
      .lt("created_at", `${to}T00:00:00Z`),
    getRewardSettings(),
  ]);

  const tasks = (tasksData ?? []) as DelegationTask[];
  const approved = tasks.filter((t) => t.system_stage === "completed");
  const submitted = tasks.filter((t) => t.system_stage === "submitted");
  const ledger = (ledgerData ?? []) as PointsLedgerEntry[];
  const ddRequests = (ddData ?? []) as DueDateRequest[];

  const summary = computeSummary(approved, submitted.length, ledger, ddRequests);
  const score = computeScore(summary);
  const grade = computeGrade(score);
  const insights = computeInsights(summary);

  // Per-task activity counts + ledger sum
  const taskIds = approved.map((t) => t.id);
  let activityByTask = new Map<string, number>();
  if (taskIds.length > 0) {
    const { data: actData } = await db
      .from("delegation_activity")
      .select("task_id")
      .in("task_id", taskIds);
    ((actData ?? []) as ActivityEntry[]).forEach((a) => {
      activityByTask.set(a.task_id, (activityByTask.get(a.task_id) ?? 0) + 1);
    });
  }
  const ledgerByTask = new Map<string, number>();
  ledger.forEach((l) => ledgerByTask.set(l.task_id, (ledgerByTask.get(l.task_id) ?? 0) + l.points));

  const taskRows: ReportTaskRow[] = approved
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      submitted_at: null,
      completed_at: t.completed_at,
      status: t.status,
      system_stage: t.system_stage,
      points: ledgerByTask.get(t.id) ?? 0,
      revision_count: t.revision_count ?? 0,
      proof_url: t.proof_url,
      delay_reason: t.delay_reason ?? null,
      activity_count: activityByTask.get(t.id) ?? 0,
    }))
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const badges = computeUserBadges(approved, settings);

  // Monthly winners for the month — pick titles where this user wins
  const { winners } = await getMonthlyWinnersForMonth(month);
  const winner_titles = winners
    .filter((w) => w.user_id === userId)
    .map((w) => ({ award_type: w.award_type, award_name: w.award_name, reward_label: w.reward_label }));

  return {
    user_id: userId,
    month,
    summary,
    tasks: taskRows,
    badges,
    winner_titles,
    score,
    grade,
    insights,
    frozen: false,
    frozen_at: null,
  };
}

/** Light wrapper around badgeService to avoid circular deps in tests. */
async function getMonthlyWinnersForMonth(month: string): Promise<{ winners: MonthlyWinner[] }> {
  const { from, to } = monthRange(month);
  const [{ data: tasks }, { data: ledger }] = await Promise.all([
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
  ]);
  return { winners: computeMonthlyWinners((tasks ?? []) as any, (ledger ?? []) as any) };
}

export async function getTeamOverview(month: string): Promise<TeamOverviewRow[]> {
  const { from, to } = monthRange(month);
  const [{ data: tasks }, { data: ledger }, settings] = await Promise.all([
    db.from("delegation_tasks")
      .select("assignee_id, completed_at, due_date, revision_count, proof_url, system_stage, is_deleted")
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

  const byUser = new Map<string, DelegationTask[]>();
  ((tasks ?? []) as DelegationTask[]).forEach((t) => {
    if (!t.assignee_id) return;
    const arr = byUser.get(t.assignee_id) ?? [];
    arr.push(t);
    byUser.set(t.assignee_id, arr);
  });

  const pointsByUser = new Map<string, number>();
  ((ledger ?? []) as PointsLedgerEntry[]).forEach((l) => {
    pointsByUser.set(l.user_id, (pointsByUser.get(l.user_id) ?? 0) + l.points);
  });

  // include users that only have ledger rows
  for (const uid of pointsByUser.keys()) if (!byUser.has(uid)) byUser.set(uid, []);

  const rows: TeamOverviewRow[] = [];
  for (const [uid, approved] of byUser.entries()) {
    const summary = computeSummary(approved, 0, [{ points: pointsByUser.get(uid) ?? 0 } as any], []);
    const score = computeScore(summary);
    const badges = computeUserBadges(approved, settings).filter((b) => b.earned).length;
    rows.push({
      user_id: uid,
      approved_tasks: summary.approved_tasks,
      points: summary.total_points,
      on_time_pct: summary.on_time_pct,
      revisions: summary.total_revisions,
      badges_earned: badges,
      score,
      grade: computeGrade(score),
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export async function freezeMonthlyReports(month: string, frozenBy: string): Promise<number> {
  const overview = await getTeamOverview(month);
  let count = 0;
  for (const row of overview) {
    const report = await getMonthlyUserReport(row.user_id, month);
    const payload = {
      month,
      user_id: row.user_id,
      report_json: { ...report, frozen: true } satisfies MonthlyUserReport,
      score: report.score,
      grade: report.grade,
      frozen_by: frozenBy,
      frozen_at: new Date().toISOString(),
    };
    const { error } = await db
      .from("delegation_monthly_appraisals")
      .upsert(payload, { onConflict: "month,user_id" });
    if (error) throw new Error(error.message);
    count++;
  }
  return count;
}

export async function unfreezeMonthlyReports(month: string): Promise<void> {
  const { error } = await db.from("delegation_monthly_appraisals").delete().eq("month", month);
  if (error) throw new Error(error.message);
}

export async function isMonthFrozen(month: string): Promise<boolean> {
  const { data } = await db
    .from("delegation_monthly_appraisals")
    .select("id")
    .eq("month", month)
    .limit(1);
  return ((data ?? []) as any[]).length > 0;
}
