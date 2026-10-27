import { supabase } from "@/integrations/supabase/client";
import { computeScore, type ScoreInput } from "./hrScoreService";

const sb = supabase as any;
const T = "gwv_hr_daily_reports";

export type DailyReport = {
  id: string;
  report_date: string;
  hr_user_id: string | null;
  hr_name: string | null;
  submitted_at: string | null;
  report_status: string;
  hiring_mode: string | null;
  interview_target: number;
  interviews_conducted: number;
  shortlisted_count: number;
  rejected_count: number;
  ready_pool_added_count: number;
  open_positions_count: number;
  sla_missed_count: number;
  checklist_completed_count: number;
  checklist_total_count: number;
  key_outcomes: string | null;
  blockers: string | null;
  tomorrow_focus: string | null;
  followup_notes: string | null;
  whatsapp_summary: string | null;
  score_total: number;
  score_breakdown: Record<string, number>;
  penalty_breakdown: any[];
  bonus_breakdown: any[];
};

export async function getOrCreateTodayReport(userId: string, name: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.from(T)
    .select("*").eq("report_date", today).eq("hr_user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data as DailyReport;
  const { data: created, error: e2 } = await sb.from(T).insert({
    report_date: today, hr_user_id: userId, hr_name: name, report_status: "draft",
    login_time: new Date().toISOString(),
  }).select().single();
  if (e2) throw e2;
  return created as DailyReport;
}

export async function listReports(userId?: string | null) {
  const q = sb.from(T).select("*").eq("is_deleted", false).order("report_date", { ascending: false }).limit(60);
  if (userId) q.eq("hr_user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as DailyReport[];
}

export function buildWhatsappSummary(r: DailyReport, status: string): string {
  return [
    "HR DAILY HIRING OUTCOME REPORT",
    `Date: ${r.report_date}`,
    `HR: ${r.hr_name ?? "—"}`,
    "",
    "1. Today's Hiring Output",
    `- Interviews conducted: ${r.interviews_conducted}/${r.interview_target}`,
    `- Shortlisted candidates: ${r.shortlisted_count}`,
    `- Ready-to-join added: ${r.ready_pool_added_count}`,
    `- Positions filled today: 0`,
    "",
    "2. Hiring SLA",
    `- Open positions: ${r.open_positions_count}`,
    `- Missed deadlines: ${r.sla_missed_count}`,
    "",
    "3. Candidate Pool",
    `- Ready pool added today: ${r.ready_pool_added_count}`,
    "",
    "4. Checklist",
    `- Completed: ${r.checklist_completed_count}/${r.checklist_total_count}`,
    "",
    "5. Tomorrow's Focus",
    `- ${r.tomorrow_focus || "—"}`,
    "",
    `Daily Score: ${r.score_total}/100`,
    `Status: ${status}`,
  ].join("\n");
}

export function statusFromScore(score: number, submitted: boolean): string {
  if (!submitted) return "Reporting Non-Compliant";
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Attention";
  return "Critical";
}

export async function updateReport(id: string, patch: Partial<DailyReport>) {
  const { error } = await sb.from(T).update(patch).eq("id", id);
  if (error) throw error;
}

export async function submitReport(report: DailyReport, scoreInput: ScoreInput) {
  const { score_total, score_breakdown, penalty_breakdown, bonus_breakdown } = computeScore(scoreInput);
  const status = "submitted";
  const merged: DailyReport = { ...report, score_total, score_breakdown, penalty_breakdown, bonus_breakdown };
  const wa = buildWhatsappSummary(merged, statusFromScore(score_total, true));
  await updateReport(report.id, {
    submitted_at: new Date().toISOString(),
    report_status: status,
    score_total, score_breakdown,
    penalty_breakdown: penalty_breakdown as any, bonus_breakdown: bonus_breakdown as any,
    whatsapp_summary: wa,
  });
  return { score_total, whatsapp_summary: wa };
}
