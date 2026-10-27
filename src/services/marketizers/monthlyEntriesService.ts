// Marketizers — monthly entries service. UI-free.

import { supabase } from "@/integrations/supabase/client";
import type { MonthlyEntry } from "@/types/marketizers";

const TABLE = "marketizers_monthly_entries" as const;

export async function getMarketizersMonthlyEntries(month?: string): Promise<MonthlyEntry[]> {
  let q = supabase.from(TABLE as any).select("*").eq("is_deleted", false);
  if (month) q = q.eq("month", month);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MonthlyEntry[];
}

export async function getMarketizersAllEntries(): Promise<MonthlyEntry[]> {
  // Used for trend charts; small dataset for now. Switch to month-range
  // filter once volume grows.
  return getMarketizersMonthlyEntries();
}

// Most-recent N entries across all clients, ordered by month desc.
// Used by the Revenue dashboard so we don't fetch the full table on every visit.
export async function getMarketizersRecentMonthlyEntries(limit = 300): Promise<MonthlyEntry[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("is_deleted", false)
    .order("month", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MonthlyEntry[];
}

export async function getMarketizersMonthlyEntryById(id: string): Promise<MonthlyEntry | null> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any) ?? null;
}

export async function getMarketizersMonthlyEntryByClientMonth(
  clientId: string,
  month: string,
): Promise<MonthlyEntry | null> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("client_id", clientId)
    .eq("month", month)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any) ?? null;
}

export type MonthlyEntryPayload = Omit<MonthlyEntry, "id" | "is_deleted" | "is_locked"> & {
  is_locked?: boolean;
  locked_at?: string | null;
};

export async function createMarketizersMonthlyEntry(payload: MonthlyEntryPayload): Promise<void> {
  const { error } = await supabase.from(TABLE as any).insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateMarketizersMonthlyEntry(
  id: string,
  payload: Partial<MonthlyEntryPayload>,
): Promise<void> {
  const { error } = await supabase.from(TABLE as any).update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function lockMarketizersMonthlyEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE as any)
    .update({ is_locked: true, locked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function unlockMarketizersMonthlyEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE as any)
    .update({ is_locked: false, locked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteMarketizersMonthlyEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
