// Pure helpers for the Delegation grid: TSV paste parsing, column reorder,
// and due-date lock guard. Kept dependency-free so it can be unit tested.

import type { CustomColumn } from "@/services/delegation/delegationService";

export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

export function moveColumn(cols: CustomColumn[], key: string, dir: -1 | 1): CustomColumn[] {
  const idx = cols.findIndex((c) => c.key === key);
  if (idx < 0) return cols;
  const j = idx + dir;
  if (j < 0 || j >= cols.length) return cols;
  const next = [...cols];
  [next[idx], next[j]] = [next[j], next[idx]];
  return next;
}

export function toggleHidden(cols: CustomColumn[], key: string): CustomColumn[] {
  return cols.map((c) => (c.key === key ? { ...c, hidden: !c.hidden } : c));
}

export function removeColumn(cols: CustomColumn[], key: string): CustomColumn[] {
  return cols.filter((c) => c.key !== key);
}

export function renameColumn(cols: CustomColumn[], key: string, label: string): CustomColumn[] {
  return cols.map((c) => (c.key === key ? { ...c, label } : c));
}

/**
 * Returns true if a non-admin actor is allowed to apply this patch given the
 * row's saved state. Currently only enforces the due-date lock.
 */
export function canEmployeeApplyPatch(
  saved: { id: string; due_date_locked: boolean; due_date: string | null },
  patch: Record<string, unknown>,
): boolean {
  if ("due_date" in patch && saved.due_date_locked && patch.due_date !== saved.due_date) {
    return false;
  }
  return true;
}

export const CORE_COLUMN_KEYS = new Set<string>([
  "row_no",
  "assignee_id",
  "title",
  "due_date",
  "revision_1_date",
  "revision_2_date",
  "final_date",
  "revision_count",
  "status",
  "priority",
  "difficulty",
  "category",
  "delay_reason",
  "blocked_reason",
  "waiting_on_user_id",
  "proof_url",
  "follow_up_reminder",
  "points",
  "actions",
]);

export function isCoreColumn(key: string): boolean {
  return CORE_COLUMN_KEYS.has(key);
}
