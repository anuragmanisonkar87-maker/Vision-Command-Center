// All financial math. Pure functions. Safe with 0 / null / undefined.
// UI must render "—" when these return null.

import type { MonthlyEntry, HealthStatus } from "@/types/marketizers";

const safe = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const safeDivide = (num: number, den: number): number | null => {
  const d = safe(den);
  if (d === 0) return null;
  return safe(num) / d;
};

export const calculateNetProfit = (revenue: number, expense: number) =>
  safe(revenue) - safe(expense);

export const calculateProfitMargin = (netProfit: number, revenue: number) => {
  const r = safeDivide(netProfit, revenue);
  return r === null ? null : r * 100;
};

export const calculateCollectionPercent = (collected: number, revenue: number) => {
  const r = safeDivide(collected, revenue);
  return r === null ? null : r * 100;
};

export const calculatePendingPercent = (pending: number, revenue: number) => {
  const r = safeDivide(pending, revenue);
  return r === null ? null : r * 100;
};

export const calculateClientROAS = (gross: number, adSpend: number) =>
  safeDivide(gross, adSpend);

export const calculateCPL = (adSpend: number, leads: number) =>
  safeDivide(adSpend, leads);

export const calculateCostPerSale = (adSpend: number, sales: number) =>
  safeDivide(adSpend, sales);

export const calculateLeadToSalePercent = (sales: number, leads: number) => {
  const r = safeDivide(sales, leads);
  return r === null ? null : r * 100;
};

export const calculateGrowthPercent = (current: number, previous: number) => {
  const p = safe(previous);
  if (p === 0) return null;
  return ((safe(current) - p) / p) * 100;
};

export const calculateRevenueVariance = (actual: number, target: number) =>
  calculateGrowthPercent(actual, target);

export const calculateProfitVariance = (actual: number, target: number) =>
  calculateGrowthPercent(actual, target);

export function getClientHealthStatus(
  entry: MonthlyEntry,
  previous: MonthlyEntry | null,
): HealthStatus {
  const status = (entry.account_status || "active").toLowerCase();
  if (status === "paused" || status === "closed") return "Inactive";

  const netProfit = calculateNetProfit(entry.marketizers_revenue, entry.total_direct_expense);
  if (netProfit < 0) return "Loss-making";

  const pendingPct = calculatePendingPercent(entry.amount_pending, entry.marketizers_revenue);
  if (pendingPct !== null && pendingPct > 30) return "Payment Pending";

  const collectionPct = calculateCollectionPercent(entry.amount_collected, entry.marketizers_revenue);
  const margin = calculateProfitMargin(netProfit, entry.marketizers_revenue);
  const growth = previous
    ? calculateGrowthPercent(entry.marketizers_revenue, previous.marketizers_revenue)
    : null;

  if (
    (collectionPct !== null && collectionPct < 80) ||
    (growth !== null && growth < -10) ||
    (margin !== null && margin < 20)
  ) {
    return "Watch";
  }
  return "Healthy";
}

export type CollectionRisk = "High Risk" | "Medium Risk" | "Low Risk" | "None";

export function getCollectionRisk(entry: MonthlyEntry): CollectionRisk {
  if (entry.amount_pending <= 0) return "None";
  const pct = calculatePendingPercent(entry.amount_pending, entry.marketizers_revenue) ?? 0;
  if (pct > 30) return "High Risk";
  if (pct > 15) return "Medium Risk";
  return "Low Risk";
}
