// Shared aggregation helpers for Marketizers reports.
import { supabase } from "@/integrations/supabase/client";
import type { Client, MonthlyEntry } from "@/types/marketizers";
import {
  calculateNetProfit, calculateProfitMargin, calculateCollectionPercent,
  calculatePendingPercent, calculateGrowthPercent,
} from "@/utils/calculations/financeCalculations";
import { previousMonth } from "@/utils/formatters/format";

export type ReportPeriod = { month: string; previous: string };

export function makePeriod(month: string): ReportPeriod {
  return { month, previous: previousMonth(month) };
}

export type SalaryRow = { id: string; month: string; team_member_name: string; role: string | null; salary_amount: number; payment_status: string; payment_date: string | null; notes: string | null };
export type SharedRow = { id: string; month: string; category: string; amount: number; expense_date: string | null; description: string | null; paid_by: string | null };

export type ReportBundle = {
  clients: Client[];
  current: MonthlyEntry[];
  previous: MonthlyEntry[];
  salariesCurr: SalaryRow[];
  salariesPrev: SalaryRow[];
  sharedCurr: SharedRow[];
  sharedPrev: SharedRow[];
};

// Resolve marketizers brand id (cached) for allocation-aware reporting.
let _marketizersBrandIdCache: string | null = null;
async function getMarketizersBrandId(): Promise<string | null> {
  if (_marketizersBrandIdCache) return _marketizersBrandIdCache;
  const { data } = await supabase
    .from("gwv_brands" as any)
    .select("id")
    .eq("slug", "marketizers")
    .eq("is_deleted", false)
    .maybeSingle();
  _marketizersBrandIdCache = (data as any)?.id ?? null;
  return _marketizersBrandIdCache;
}

/** Build map of expense_entry_id -> Marketizers-allocated INR amount. */
async function loadMarketizersAllocationMap(months: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!months.length) return map;
  const brandId = await getMarketizersBrandId();
  if (!brandId) return map;
  const { data } = await supabase
    .from("gwv_shared_expense_allocations" as any)
    .select("source_id, allocated_amount_in_inr, source_type, brand_id, month, is_deleted")
    .eq("is_deleted", false)
    .eq("brand_id", brandId)
    .eq("source_type", "marketizers_expense_entry")
    .in("month", months);
  for (const r of (data ?? []) as any[]) {
    map.set(r.source_id, (map.get(r.source_id) ?? 0) + Number(r.allocated_amount_in_inr || 0));
  }
  return map;
}

/** Resolve effective Marketizers-attributable amount for an expense entry. */
function effectiveAmount(e: any, allocMap: Map<string, number>): number {
  if (e.is_shared_expense) return allocMap.get(e.id) ?? 0;
  return Number(e.amount_in_inr || 0);
}

export async function loadReportBundle(month: string): Promise<ReportBundle> {
  const prev = previousMonth(month);
  const [clients, entries, expEntries, allocMap] = await Promise.all([
    supabase.from("marketizers_clients" as any).select("*").eq("is_deleted", false),
    supabase.from("marketizers_monthly_entries" as any).select("*").eq("is_deleted", false).in("month", [month, prev]),
    supabase.from("marketizers_expense_entries" as any).select("*").eq("is_deleted", false).eq("entry_status", "active").in("month", [month, prev]),
    loadMarketizersAllocationMap([month, prev]),
  ]);
  if (clients.error) throw new Error(clients.error.message);
  if (entries.error) throw new Error(entries.error.message);
  if (expEntries.error) throw new Error(expEntries.error.message);
  const ent = (entries.data ?? []) as unknown as MonthlyEntry[];
  const exp = (expEntries.data ?? []) as any[];
  const toSal = (e: any): SalaryRow => ({
    id: e.id, month: e.month, team_member_name: e.employee_name ?? e.expense_name,
    role: e.role, salary_amount: effectiveAmount(e, allocMap),
    payment_status: e.payment_status, payment_date: e.expense_date, notes: e.notes,
  });
  const toShe = (e: any): SharedRow => ({
    id: e.id, month: e.month, category: e.category, amount: effectiveAmount(e, allocMap),
    expense_date: e.expense_date, description: e.notes, paid_by: e.payment_handler,
  });
  const sal = exp.filter((e) => e.category === "Team Salaries").map(toSal);
  const she = exp.filter((e) => e.category !== "Team Salaries").map(toShe);
  return {
    clients: (clients.data ?? []) as unknown as Client[],
    current: ent.filter((e) => e.month === month),
    previous: ent.filter((e) => e.month === prev),
    salariesCurr: sal.filter((s) => s.month === month),
    salariesPrev: sal.filter((s) => s.month === prev),
    sharedCurr: she.filter((s) => s.month === month),
    sharedPrev: she.filter((s) => s.month === prev),
  };
}

export async function loadTrendBundle(months: string[]): Promise<{
  entries: MonthlyEntry[]; salaries: SalaryRow[]; shared: SharedRow[];
}> {
  if (!months.length) return { entries: [], salaries: [], shared: [] };
  const [e, exp, allocMap] = await Promise.all([
    supabase.from("marketizers_monthly_entries" as any).select("*").eq("is_deleted", false).in("month", months),
    supabase.from("marketizers_expense_entries" as any).select("*").eq("is_deleted", false).eq("entry_status", "active").in("month", months),
    loadMarketizersAllocationMap(months),
  ]);
  if (e.error) throw new Error(e.error.message);
  if (exp.error) throw new Error(exp.error.message);
  const expRows = (exp.data ?? []) as any[];
  const sal: SalaryRow[] = expRows.filter((x) => x.category === "Team Salaries").map((x) => ({
    id: x.id, month: x.month, team_member_name: x.employee_name ?? x.expense_name,
    role: x.role, salary_amount: effectiveAmount(x, allocMap),
    payment_status: x.payment_status, payment_date: x.expense_date, notes: x.notes,
  }));
  const she: SharedRow[] = expRows.filter((x) => x.category !== "Team Salaries").map((x) => ({
    id: x.id, month: x.month, category: x.category, amount: effectiveAmount(x, allocMap),
    expense_date: x.expense_date, description: x.notes, paid_by: x.payment_handler,
  }));
  return { entries: (e.data ?? []) as unknown as MonthlyEntry[], salaries: sal, shared: she };
}

const num = (v: unknown) => Number(v ?? 0) || 0;
export const sumBy = <T,>(arr: T[], k: (x: T) => number) => arr.reduce((a, b) => a + num(k(b)), 0);

export function totalsFor(b: { current: MonthlyEntry[]; previous: MonthlyEntry[]; salariesCurr: SalaryRow[]; salariesPrev: SalaryRow[]; sharedCurr: SharedRow[]; sharedPrev: SharedRow[] }) {
  const revenue = sumBy(b.current, (e) => e.marketizers_revenue);
  const collected = sumBy(b.current, (e) => e.amount_collected);
  const pending = sumBy(b.current, (e) => e.amount_pending);
  const grossClient = sumBy(b.current, (e) => e.client_gross_revenue);
  const directExpense = sumBy(b.current, (e) => e.total_direct_expense);
  const teamSalary = sumBy(b.salariesCurr, (e) => e.salary_amount);
  const sharedTotal = sumBy(b.sharedCurr, (e) => e.amount);
  const totalExpenses = directExpense + teamSalary + sharedTotal;
  const netProfit = revenue - totalExpenses;
  const cashProfit = collected - totalExpenses;
  const netMargin = calculateProfitMargin(netProfit, revenue);
  const collectionPct = calculateCollectionPercent(collected, revenue);
  const pendingPct = calculatePendingPercent(pending, revenue);

  const pRev = sumBy(b.previous, (e) => e.marketizers_revenue);
  const pCol = sumBy(b.previous, (e) => e.amount_collected);
  const pPen = sumBy(b.previous, (e) => e.amount_pending);
  const pDir = sumBy(b.previous, (e) => e.total_direct_expense);
  const pSal = sumBy(b.salariesPrev, (e) => e.salary_amount);
  const pShe = sumBy(b.sharedPrev, (e) => e.amount);
  const pExp = pDir + pSal + pShe;
  const pProfit = pRev - pExp;

  return {
    revenue, collected, pending, grossClient,
    directExpense, teamSalary, sharedTotal, totalExpenses,
    netProfit, cashProfit, netMargin, collectionPct, pendingPct,
    revenueGrowth: calculateGrowthPercent(revenue, pRev),
    collectedGrowth: calculateGrowthPercent(collected, pCol),
    pendingGrowth: calculateGrowthPercent(pending, pPen),
    expenseGrowth: calculateGrowthPercent(totalExpenses, pExp),
    profitGrowth: calculateGrowthPercent(netProfit, pProfit),
  };
}

export type ClientReportRow = {
  client: Client;
  entry: MonthlyEntry;
  prev: MonthlyEntry | null;
  netProfit: number;
  margin: number | null;
  growth: number | null;
};

export function buildClientRows(b: ReportBundle): ClientReportRow[] {
  const cMap = Object.fromEntries(b.clients.map((c) => [c.id, c]));
  const prevByClient = Object.fromEntries(b.previous.map((e) => [e.client_id, e]));
  return b.current
    .map((e) => {
      const np = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
      const prev = (prevByClient[e.client_id] as MonthlyEntry | undefined) ?? null;
      return {
        client: cMap[e.client_id] as Client,
        entry: e,
        prev,
        netProfit: np,
        margin: calculateProfitMargin(np, e.marketizers_revenue),
        growth: prev ? calculateGrowthPercent(e.marketizers_revenue, prev.marketizers_revenue) : null,
      };
    })
    .filter((r) => r.client);
}

export function lastNMonths(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
