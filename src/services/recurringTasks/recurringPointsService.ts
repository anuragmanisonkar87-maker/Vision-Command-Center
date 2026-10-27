// Phase 2C — points ledger for recurring daily tasks.
// Uses dedicated table `recurring_daily_points_ledger` (separate from
// delegation_points_ledger which is FK-tied to delegation_tasks).
import { supabase } from "@/integrations/supabase/client";
import {
  listTemplates,
  listCompletionsForDate,
  todayISO,
  type RecurringDailyTask,
  type RecurringDailyCompletion,
} from "./recurringTasksService";
import { recurringStatusOf, isCompletionLate } from "@/lib/delegation/overdueStatus";

export type RecurringPointsEventType =
  | "recurring_daily_completed"
  | "recurring_daily_late_completed"
  | "recurring_daily_missed";

export type RecurringDailyPointsEntry = {
  id: string;
  template_id: string;
  completion_id: string | null;
  user_id: string;
  team_member_id: string | null;
  points: number;
  event_type: RecurringPointsEventType;
  points_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

const db = supabase as any;
const TABLE = "recurring_daily_points_ledger";

function isUniqueViolation(msg: string): boolean {
  return /duplicate key|unique/i.test(msg);
}

/**
 * Award completion points for a recurring daily task.
 * - Always uses full `points_on_completion`.
 * - If the completion was after due_time, event_type is `recurring_daily_late_completed`.
 * - Safe to call repeatedly: unique(completion_id) makes duplicate insert a no-op.
 *
 * Returns the inserted row, or null if already awarded.
 */
export async function awardCompletionPoints(args: {
  template: Pick<
    RecurringDailyTask,
    "id" | "points_on_completion" | "due_time" | "task_doer_team_member_id"
  >;
  completion: Pick<
    RecurringDailyCompletion,
    "id" | "completed_by_user_id" | "completed_by_team_member_id" | "completed_at"
  >;
  userId: string;
}): Promise<RecurringDailyPointsEntry | null> {
  const late = isCompletionLate(args.template, args.completion);
  const event_type: RecurringPointsEventType = late
    ? "recurring_daily_late_completed"
    : "recurring_daily_completed";
  const { data, error } = await db
    .from(TABLE)
    .insert({
      template_id: args.template.id,
      completion_id: args.completion.id,
      user_id: args.userId,
      team_member_id:
        args.completion.completed_by_team_member_id ??
        args.template.task_doer_team_member_id ??
        null,
      points: args.template.points_on_completion,
      event_type,
      points_date: (args.completion.completed_at ?? new Date().toISOString()).slice(0, 10),
      reason: late ? "late_completion" : "on_time_completion",
    })
    .select()
    .single();
  if (error) {
    if (isUniqueViolation(error.message)) return null;
    throw new Error(error.message);
  }
  return data as RecurringDailyPointsEntry;
}

export type MissedPenaltyResult = {
  appliedCount: number;
  skippedDuplicateCount: number;
  noMissedCount: number;
  errors: string[];
};

/**
 * Admin action: scan today's active templates and write one missed-penalty
 * ledger entry per template whose due_time has passed and has no completion.
 * Duplicate-insert is silently skipped via the unique index.
 */
export async function applyMissedPenaltiesForDate(args: {
  adminUserId: string;
  date?: string;
  now?: Date;
}): Promise<MissedPenaltyResult> {
  const date = args.date ?? todayISO();
  const now = args.now ?? new Date();
  const [templates, completions] = await Promise.all([
    listTemplates({ activeOnly: true }),
    listCompletionsForDate(date),
  ]);
  const completionByTpl = new Map(completions.map((c) => [c.template_id, c]));
  const result: MissedPenaltyResult = {
    appliedCount: 0,
    skippedDuplicateCount: 0,
    noMissedCount: 0,
    errors: [],
  };
  for (const t of templates) {
    if (!t.task_doer_user_id) continue; // cannot penalize an unassigned user
    const status = recurringStatusOf(t, completionByTpl.get(t.id) ?? null, now);
    if (status !== "missed") {
      result.noMissedCount++;
      continue;
    }
    const { error } = await db
      .from(TABLE)
      .insert({
        template_id: t.id,
        completion_id: null,
        user_id: t.task_doer_user_id,
        team_member_id: t.task_doer_team_member_id,
        points: t.negative_points_if_missed,
        event_type: "recurring_daily_missed",
        points_date: date,
        reason: "missed_due_time",
        created_by: args.adminUserId,
      });
    if (error) {
      if (isUniqueViolation(error.message)) result.skippedDuplicateCount++;
      else result.errors.push(`${t.title}: ${error.message}`);
    } else {
      result.appliedCount++;
    }
  }
  return result;
}

export async function listRecentLedgerEntries(
  limit = 25,
): Promise<RecurringDailyPointsEntry[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringDailyPointsEntry[];
}

export async function listLedgerForDate(
  date: string,
): Promise<RecurringDailyPointsEntry[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("points_date", date);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringDailyPointsEntry[];
}
