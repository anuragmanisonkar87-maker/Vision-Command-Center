// Phase 2B — pure status helpers for missed / overdue detection.
// No DB calls; safe to unit-test.
import type {
  RecurringDailyTask,
  RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";
import type { DelegationTask } from "@/services/delegation/delegationService";

export type RecurringStatus = "pending" | "done" | "missed";

function todayISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns true when `now` is at/past today's due_time ("HH:MM[:SS]"). */
export function dueTimePassed(due_time: string | null | undefined, now: Date): boolean {
  if (!due_time) return false;
  const [hh, mm] = due_time.split(":");
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10) || 0;
  if (!Number.isFinite(h)) return false;
  const cutoff = new Date(now);
  cutoff.setHours(h, m, 0, 0);
  return now.getTime() >= cutoff.getTime();
}

/**
 * Pending / Done / Missed for a recurring template on the given day.
 * - completion present → done (even if late)
 * - no due_time and no completion → pending (never auto-missed)
 * - due_time passed and no completion → missed
 */
export function recurringStatusOf(
  template: Pick<RecurringDailyTask, "due_time" | "active">,
  completion: RecurringDailyCompletion | null | undefined,
  now: Date = new Date(),
): RecurringStatus {
  if (completion) return "done";
  if (!template.active) return "pending";
  return dueTimePassed(template.due_time, now) ? "missed" : "pending";
}

/** True if a done completion happened after the template's due_time today. */
export function isCompletionLate(
  template: Pick<RecurringDailyTask, "due_time">,
  completion: Pick<RecurringDailyCompletion, "completed_at"> | null | undefined,
): boolean {
  if (!completion?.completed_at || !template.due_time) return false;
  const completedAt = new Date(completion.completed_at);
  if (Number.isNaN(completedAt.getTime())) return false;
  const [hh, mm] = template.due_time.split(":");
  const cutoff = new Date(completedAt);
  cutoff.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
  return completedAt.getTime() > cutoff.getTime();
}

export interface RecurringDaySummary {
  visible: number;
  done: number;
  pending: number;
  missed: number;
}

export function summarizeRecurringDay(
  items: Array<{
    template: Pick<RecurringDailyTask, "due_time" | "active">;
    completion: RecurringDailyCompletion | null | undefined;
  }>,
  now: Date = new Date(),
): RecurringDaySummary {
  const sum: RecurringDaySummary = { visible: 0, done: 0, pending: 0, missed: 0 };
  for (const it of items) {
    if (!it.template.active && !it.completion) continue; // hidden inactive rows
    sum.visible++;
    const s = recurringStatusOf(it.template, it.completion, now);
    sum[s]++;
  }
  return sum;
}

/** Delegation task is overdue if due_date is before today and not completed/approved/cancelled. */
export function isDelegationOverdue(
  task: Pick<DelegationTask, "due_date" | "system_stage" | "is_deleted">,
  now: Date = new Date(),
): boolean {
  if (task.is_deleted) return false;
  if (!task.due_date) return false;
  if (task.system_stage === "completed" || task.system_stage === "cancelled") return false;
  return task.due_date < todayISO(now);
}
