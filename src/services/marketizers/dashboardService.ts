// Marketizers dashboard data composition. Pulls only what the dashboard
// needs and keeps Supabase access out of the page component.

import { previousMonth } from "@/utils/formatters/format";
import { getMarketizersClients } from "./clientsService";
import {
  getMarketizersAllEntries,
  getMarketizersMonthlyEntries,
} from "./monthlyEntriesService";
import type { Client, MonthlyEntry } from "@/types/marketizers";

export type MarketizersDashboardData = {
  clients: Client[];
  currentEntries: MonthlyEntry[];
  previousEntries: MonthlyEntry[];
  allEntries: MonthlyEntry[]; // used for trend chart + month dropdown
};

export async function getMarketizersDashboardData(month: string): Promise<MarketizersDashboardData> {
  const [clients, allEntries] = await Promise.all([
    getMarketizersClients(),
    // For now we still pull all entries because trend chart + month list
    // need them. With more data we'll switch to a date range or RPC.
    getMarketizersAllEntries(),
  ]);
  const prev = previousMonth(month);
  return {
    clients,
    allEntries,
    currentEntries: allEntries.filter((e) => e.month === month),
    previousEntries: allEntries.filter((e) => e.month === prev),
  };
}

export async function getMarketizersTrendData(monthRange: string[]): Promise<MonthlyEntry[]> {
  if (!monthRange.length) return [];
  // Single round-trip
  const { data: entries } = await import("@/integrations/supabase/client").then(
    ({ supabase }) =>
      supabase
        .from("marketizers_monthly_entries" as any)
        .select("*")
        .in("month", monthRange)
        .eq("is_deleted", false),
  );
  return (entries ?? []) as unknown as MonthlyEntry[];
}

// Lightweight month list used by the dropdown.
export async function getMarketizersAvailableMonths(): Promise<string[]> {
  const entries = await getMarketizersMonthlyEntries();
  return Array.from(new Set(entries.map((e) => e.month))).sort().reverse();
}
