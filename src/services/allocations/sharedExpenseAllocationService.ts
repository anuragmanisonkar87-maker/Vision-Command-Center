// Shared expense allocation across brands.
// percentages stored; allocated_amount_in_inr cached for fast reporting.
import { supabase } from "@/integrations/supabase/client";

export type SharedAllocation = {
  id: string;
  source_type: string;
  source_id: string;
  brand_id: string;
  allocation_percentage: number;
  allocated_amount_in_inr: number;
  month: string | null;
  notes: string | null;
};

export type AllocationInput = {
  brand_id: string;
  allocation_percentage: number;
  month?: string | null;
  notes?: string | null;
};

const T = "gwv_shared_expense_allocations";

export async function getAllocations(sourceType: string, sourceId: string): Promise<SharedAllocation[]> {
  const { data, error } = await supabase
    .from(T as any)
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("is_deleted", false);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SharedAllocation[];
}

export function validateAllocationPercentages(allocs: AllocationInput[]): { ok: boolean; total: number } {
  const total = allocs.reduce((a, b) => a + Number(b.allocation_percentage || 0), 0);
  return { ok: Math.abs(total - 100) < 0.01, total };
}

export function calculateAllocatedAmounts(amountInInr: number, allocs: AllocationInput[]) {
  return allocs.map((a) => ({
    ...a,
    allocated_amount_in_inr: +(amountInInr * Number(a.allocation_percentage || 0) / 100).toFixed(2),
  }));
}

/**
 * Replace all allocations for a source with the supplied list (soft-delete prior).
 * Skips zero-percentage rows.
 */
export async function saveAllocations(
  sourceType: string,
  sourceId: string,
  amountInInr: number,
  allocs: AllocationInput[]
): Promise<void> {
  // soft-delete previous
  await softDeleteAllocations(sourceType, sourceId);
  const filled = calculateAllocatedAmounts(amountInInr, allocs).filter(
    (a) => Number(a.allocation_percentage || 0) > 0
  );
  if (!filled.length) return;
  const rows = filled.map((a) => ({
    source_type: sourceType,
    source_id: sourceId,
    brand_id: a.brand_id,
    allocation_percentage: a.allocation_percentage,
    allocated_amount_in_inr: a.allocated_amount_in_inr,
    month: a.month ?? null,
    notes: a.notes ?? null,
  }));
  const { error } = await supabase.from(T as any).insert(rows);
  if (error) throw new Error(error.message);
}

export async function softDeleteAllocations(sourceType: string, sourceId: string): Promise<void> {
  const { error } = await supabase
    .from(T as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("is_deleted", false);
  if (error) throw new Error(error.message);
}

/** Sum of allocated amounts to a single brand for an optional month. */
export async function getBrandAllocatedTotal(
  brandId: string,
  month?: string,
  sourceTypeIn?: string[]
): Promise<number> {
  let q = supabase
    .from(T as any)
    .select("allocated_amount_in_inr, month, source_type, brand_id, is_deleted")
    .eq("is_deleted", false)
    .eq("brand_id", brandId);
  if (month) q = q.eq("month", month);
  if (sourceTypeIn?.length) q = q.in("source_type", sourceTypeIn);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).reduce(
    (a: number, b: any) => a + Number(b.allocated_amount_in_inr || 0),
    0
  );
}
