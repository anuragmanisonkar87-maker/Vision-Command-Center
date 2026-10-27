// Pure summary computation for the Delegation grid header cards.
// Kept dependency-free for unit testing.
import type { DelegationTask } from "./delegationService";

export interface MineSummary {
  todayCount: number;
  pendingCount: number;
  overdueCount: number;
}

export interface AdminSummary {
  activeCount: number;
  dueTodayCount: number;
  overdueCount: number;
  completedTodayCount: number;
}

function isoToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function summarizeMine(
  tasks: Pick<DelegationTask, "assignee_id" | "system_stage" | "due_date" | "completed_at" | "is_deleted">[],
  userId: string,
  now = new Date(),
): MineSummary {
  const today = isoToday(now);
  const mine = tasks.filter((t) => !t.is_deleted && t.assignee_id === userId);
  const active = mine.filter((t) => t.system_stage !== "completed" && t.system_stage !== "cancelled");
  return {
    todayCount: active.filter((t) => t.due_date === today).length,
    pendingCount: active.length,
    overdueCount: active.filter((t) => !!t.due_date && t.due_date < today).length,
  };
}

export function summarizeAdmin(
  tasks: Pick<DelegationTask, "system_stage" | "due_date" | "completed_at" | "is_deleted">[],
  now = new Date(),
): AdminSummary {
  const today = isoToday(now);
  const live = tasks.filter((t) => !t.is_deleted);
  const active = live.filter((t) => t.system_stage !== "completed" && t.system_stage !== "cancelled");
  return {
    activeCount: active.length,
    dueTodayCount: active.filter((t) => t.due_date === today).length,
    overdueCount: active.filter((t) => !!t.due_date && t.due_date < today).length,
    completedTodayCount: live.filter(
      (t) => t.system_stage === "completed" && (t.completed_at ?? "").slice(0, 10) === today,
    ).length,
  };
}
