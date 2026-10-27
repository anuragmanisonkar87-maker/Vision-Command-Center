// Task type classification for Delegation tasks (Phase 2A).
export type DelegationTaskType = "recurring_daily" | "standup" | "ad_hoc";

export const TASK_TYPE_LABELS: Record<DelegationTaskType, string> = {
  recurring_daily: "Daily Task",
  standup: "Stand-up Task",
  ad_hoc: "Ad Hoc Task",
};

export const TASK_TYPE_SHORT: Record<DelegationTaskType, string> = {
  recurring_daily: "Daily",
  standup: "Stand-up",
  ad_hoc: "Ad Hoc",
};

/** Soft theme-compatible badge classes per task type. */
export const TASK_TYPE_BADGE_CLASS: Record<DelegationTaskType, string> = {
  recurring_daily: "bg-emerald-50 text-emerald-700 border-emerald-200",
  standup: "bg-amber-50 text-amber-800 border-amber-200",
  ad_hoc: "bg-violet-50 text-violet-700 border-violet-200",
};

/** Default task_type for new tasks. Existing rows default server-side to 'standup'. */
export function defaultTaskType(opts?: { isRecurring?: boolean; isOneOff?: boolean }): DelegationTaskType {
  if (opts?.isRecurring) return "recurring_daily";
  if (opts?.isOneOff) return "ad_hoc";
  return "standup";
}

export function labelOfTaskType(t: string | null | undefined): string {
  if (!t) return TASK_TYPE_LABELS.standup;
  return TASK_TYPE_LABELS[t as DelegationTaskType] ?? TASK_TYPE_LABELS.standup;
}

export function badgeClassOfTaskType(t: string | null | undefined): string {
  const key = (t && isValidTaskType(t) ? t : "standup") as DelegationTaskType;
  return TASK_TYPE_BADGE_CLASS[key];
}

export function isValidTaskType(t: unknown): t is DelegationTaskType {
  return t === "recurring_daily" || t === "standup" || t === "ad_hoc";
}

/** All known task-type values as a stable, UI-friendly tuple. */
export const TASK_TYPE_VALUES: DelegationTaskType[] = ["recurring_daily", "standup", "ad_hoc"];

/** Filter helper: returns true when the row matches the chosen filter ("" = all). */
export function matchesTaskTypeFilter(rowType: string | null | undefined, filter: string): boolean {
  if (!filter) return true;
  const normalized = rowType ?? "standup";
  return normalized === filter;
}
