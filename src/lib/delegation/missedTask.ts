// Phase 3D — pure helpers for missed stand-up / ad hoc task discipline.
// Now supports optional due_time (HH:MM[:SS]) precision.
import type { DelegationTask } from "@/services/delegation/delegationService";

export type MissedTaskBadge =
  | "completed"
  | "submitted_late"
  | "missed"
  | "overdue"
  | null;

const MISSABLE_TYPES = new Set(["standup", "ad_hoc"]);

function todayISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse "HH:MM" or "HH:MM:SS" — returns null if invalid. */
function parseHM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const [hh, mm] = s.split(":");
  const h = parseInt(hh, 10);
  const m = parseInt(mm ?? "0", 10) || 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  return { h, m };
}

type MissedTaskInput = Pick<
  DelegationTask,
  "task_type" | "due_date" | "system_stage" | "is_deleted" | "completed_at"
> & { due_time?: string | null };

/**
 * A stand-up / ad hoc task is "missed" when:
 *  - it has a due_date
 *  - due_date is strictly before today, OR due_date is today AND due_time has passed
 *  - task is not submitted / completed / cancelled
 *  - task is not soft-deleted
 *  - task_type is standup or ad_hoc
 * If due_time is empty, falls back to date-only behavior (only past-due dates count).
 */
export function isStandupOrAdHocMissed(
  task: MissedTaskInput,
  now: Date = new Date(),
): boolean {
  if (task.is_deleted) return false;
  if (!task.due_date) return false;
  if (!MISSABLE_TYPES.has(task.task_type ?? "standup")) return false;
  const stage = task.system_stage;
  if (stage === "completed" || stage === "cancelled" || stage === "submitted") {
    return false;
  }
  const today = todayISO(now);
  if (task.due_date < today) return true;
  if (task.due_date === today) {
    const hm = parseHM(task.due_time);
    if (!hm) return false; // no time → not yet missed today
    const cutoff = new Date(now);
    cutoff.setHours(hm.h, hm.m, 0, 0);
    return now.getTime() >= cutoff.getTime();
  }
  return false;
}

/** Returns the most relevant single badge for a stand-up/ad hoc task. */
export function missedTaskBadge(
  task: MissedTaskInput & { completed_at?: string | null },
  now: Date = new Date(),
): MissedTaskBadge {
  if (task.is_deleted) return null;
  if (!MISSABLE_TYPES.has(task.task_type ?? "standup")) return null;
  if (task.system_stage === "completed") {
    if (task.due_date && task.completed_at) {
      const completedDate = task.completed_at.slice(0, 10);
      if (completedDate > task.due_date) return "submitted_late";
    }
    return "completed";
  }
  if (isStandupOrAdHocMissed(task, now)) return "missed";
  if (
    task.due_date &&
    task.system_stage !== "cancelled" &&
    task.due_date === todayISO(now)
  ) {
    return "overdue"; // due today, time not yet passed (or no time set)
  }
  return null;
}

/** Default penalty when not configured via admin settings. */
export const DEFAULT_MISSED_TASK_PENALTY = -2;

/** Standard penalty amounts (kept here so tests can lock the default policy). */
export const MISSED_TASK_PENALTY = {
  standup: DEFAULT_MISSED_TASK_PENALTY,
  ad_hoc: DEFAULT_MISSED_TASK_PENALTY,
} as const;

/**
 * Resolve the penalty for a missed stand-up/ad hoc task.
 * `configured` overrides the default when finite (including 0); otherwise -2.
 */
export function penaltyFor(
  taskType: string | null | undefined,
  configured?: number | null,
): number {
  const t = taskType ?? "standup";
  if (!MISSABLE_TYPES.has(t)) return 0;
  if (typeof configured === "number" && Number.isFinite(configured)) {
    return configured;
  }
  return DEFAULT_MISSED_TASK_PENALTY;
}

export function eventTypeFor(taskType: string | null | undefined):
  | "standup_task_missed"
  | "ad_hoc_task_missed"
  | null {
  if ((taskType ?? "standup") === "ad_hoc") return "ad_hoc_task_missed";
  if ((taskType ?? "standup") === "standup") return "standup_task_missed";
  return null;
}

/** Format due date + optional time for display. */
export function formatDueWhen(
  due_date: string | null | undefined,
  due_time: string | null | undefined,
): string {
  if (!due_date) return "—";
  const hm = parseHM(due_time);
  if (!hm) return due_date;
  const hh = String(hm.h).padStart(2, "0");
  const mm = String(hm.m).padStart(2, "0");
  return `${due_date} ${hh}:${mm}`;
}
