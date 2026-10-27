// Collection / followup helpers — pure functions, safe with null/undefined.

import type {
  CollectionFollowup,
  FollowupPriority,
  FollowupStatus,
  MonthlyEntry,
} from "@/types/marketizers";

const DAY_MS = 86400000;

export function getDaysPending(dueOrMonth: string | null | undefined): number | null {
  if (!dueOrMonth) return null;
  const d = new Date(dueOrMonth);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

export function calculateOutstandingAmount(
  pending: number,
  recovered: number,
): number {
  return Math.max(0, (pending || 0) - (recovered || 0));
}

export type CollectionRiskLevel = "high" | "medium" | "low" | "none";

// Works for either a follow-up or the underlying monthly entry. The first
// truthy signal wins.
export function getCollectionRiskLevel(
  source:
    | CollectionFollowup
    | (MonthlyEntry & { priority?: FollowupPriority; due_date?: string | null }),
): CollectionRiskLevel {
  // Followup-shaped
  const f = source as CollectionFollowup;
  const hasFollowupShape = "status" in f && "priority" in f && "amount_recovered" in f;

  if (hasFollowupShape) {
    if (f.status === "collected" || f.status === "written_off") return "none";
    const outstanding = calculateOutstandingAmount(f.pending_amount, f.amount_recovered);
    if (outstanding <= 0) return "none";

    const dpOverdue = f.due_date ? (getDaysPending(f.due_date) ?? 0) : 0;
    if (f.priority === "urgent" || f.priority === "high" || dpOverdue > 7) return "high";
    if (f.priority === "medium" || dpOverdue > 0 || f.status === "promised" || f.status === "followed_up") return "medium";
    return "low";
  }

  // Entry-shaped fallback (Phase 1 monthly entry without a followup)
  const e = source as MonthlyEntry;
  if (!e.amount_pending || e.amount_pending <= 0) return "none";
  const pct = e.marketizers_revenue
    ? (e.amount_pending / e.marketizers_revenue) * 100
    : 0;
  if (pct > 30) return "high";
  if (pct > 15) return "medium";
  return "low";
}

export function getFollowupStatusLabel(status: FollowupStatus): string {
  const map: Record<FollowupStatus, string> = {
    pending: "Pending",
    followed_up: "Followed up",
    promised: "Promised",
    partially_collected: "Partially collected",
    collected: "Collected",
    disputed: "Disputed",
    overdue: "Overdue",
    written_off: "Written off",
  };
  return map[status];
}

export function getFollowupStatusPill(status: FollowupStatus): "sp-profit" | "sp-warn" | "sp-loss" {
  if (status === "collected") return "sp-profit";
  if (status === "disputed" || status === "overdue") return "sp-loss";
  return "sp-warn";
}

export function getFollowupPriorityLabel(p: FollowupPriority): string {
  return ({ low: "Low", medium: "Medium", high: "High", urgent: "Urgent" } as const)[p];
}

export function getFollowupPriorityPill(
  p: FollowupPriority,
): "sp-profit" | "sp-warn" | "sp-loss" {
  if (p === "urgent" || p === "high") return "sp-loss";
  if (p === "medium") return "sp-warn";
  return "sp-profit";
}

// ---------- Lifetime aggregates for one client ----------

export function calculateClientLifetimeRevenue(entries: MonthlyEntry[]): number {
  return entries.reduce((s, e) => s + (e.marketizers_revenue || 0), 0);
}

export function calculateClientLifetimePending(entries: MonthlyEntry[]): number {
  return entries.reduce((s, e) => s + (e.amount_pending || 0), 0);
}

export function calculateClientLifetimeCollected(entries: MonthlyEntry[]): number {
  return entries.reduce((s, e) => s + (e.amount_collected || 0), 0);
}

export function calculateClientLifetimeProfit(entries: MonthlyEntry[]): number {
  return entries.reduce(
    (s, e) => s + ((e.marketizers_revenue || 0) - (e.total_direct_expense || 0)),
    0,
  );
}

export function calculateAverageMonthlyRevenue(entries: MonthlyEntry[]): number | null {
  if (!entries.length) return null;
  return calculateClientLifetimeRevenue(entries) / entries.length;
}

export function calculateAverageMonthlyProfit(entries: MonthlyEntry[]): number | null {
  if (!entries.length) return null;
  return calculateClientLifetimeProfit(entries) / entries.length;
}

export function calculateAverageMonthlyMargin(entries: MonthlyEntry[]): number | null {
  if (!entries.length) return null;
  const margins = entries
    .map((e) => {
      if (!e.marketizers_revenue) return null;
      const np = (e.marketizers_revenue || 0) - (e.total_direct_expense || 0);
      return (np / e.marketizers_revenue) * 100;
    })
    .filter((v): v is number => v !== null);
  if (!margins.length) return null;
  return margins.reduce((a, b) => a + b, 0) / margins.length;
}
