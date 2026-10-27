// Phase 2E — pure helpers for the employee/admin dashboard summary.
// Dependency-free, safe to unit-test.

import type { AttendanceRecord } from "@/services/attendance/attendanceService";
import type { DelegationTask } from "@/services/delegation/delegationService";
import type { RecurringDailyPointsEntry } from "@/services/recurringTasks/recurringPointsService";
import { isDelegationOverdue } from "@/lib/delegation/overdueStatus";

export type AttendanceStatus = "not_checked_in" | "checked_in" | "checked_out";

export interface AttendanceCardSummary {
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedSeconds: number;
}

export function attendanceCardSummary(
  rec: Pick<AttendanceRecord, "check_in_at" | "check_out_at" | "total_work_seconds"> | null,
): AttendanceCardSummary {
  if (!rec || !rec.check_in_at) {
    return { status: "not_checked_in", checkInAt: null, checkOutAt: null, workedSeconds: 0 };
  }
  return {
    status: rec.check_out_at ? "checked_out" : "checked_in",
    checkInAt: rec.check_in_at,
    checkOutAt: rec.check_out_at ?? null,
    workedSeconds: rec.total_work_seconds ?? 0,
  };
}

export interface MyTasksCardSummary {
  pending: number;
  submitted: number;
  overdue: number;
}

/** Counts tasks where the user is the assignee. */
export function myTasksCardSummary(
  tasks: Pick<
    DelegationTask,
    "assignee_id" | "system_stage" | "due_date" | "is_deleted"
  >[],
  userId: string,
  now: Date = new Date(),
): MyTasksCardSummary {
  const mine = tasks.filter((t) => !t.is_deleted && t.assignee_id === userId);
  const active = mine.filter(
    (t) => t.system_stage !== "completed" && t.system_stage !== "cancelled",
  );
  return {
    pending: active.filter(
      (t) => t.system_stage === "planned" || t.system_stage === "in_progress" || t.system_stage === "revision",
    ).length,
    submitted: active.filter((t) => t.system_stage === "submitted").length,
    overdue: active.filter((t) => isDelegationOverdue(t, now)).length,
  };
}

export interface PointsTodaySummary {
  earned: number;
  lost: number;
  net: number;
  entries: number;
}

/** Sums recurring-daily points for a user on a given date. */
export function pointsTodaySummary(
  entries: Pick<RecurringDailyPointsEntry, "user_id" | "points" | "points_date">[],
  userId: string,
  date: string,
): PointsTodaySummary {
  const rows = entries.filter((e) => e.user_id === userId && e.points_date === date);
  let earned = 0;
  let lost = 0;
  for (const r of rows) {
    if (r.points >= 0) earned += r.points;
    else lost += r.points;
  }
  return { earned, lost, net: earned + lost, entries: rows.length };
}

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
