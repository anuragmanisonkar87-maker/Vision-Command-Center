// Marketizers — collection followups service. UI-free.

import { supabase } from "@/integrations/supabase/client";
import type { CollectionFollowup, FollowupStatus, FollowupPriority } from "@/types/marketizers";

const TABLE = "marketizers_collection_followups" as const;

export type CollectionFilters = {
  month?: string;
  clientId?: string;
  status?: FollowupStatus | "all";
  priority?: FollowupPriority | "all";
  followupOwner?: string;
  dueFrom?: string;
  dueTo?: string;
  overdueOnly?: boolean;
};

export async function getPendingCollections(
  filters: CollectionFilters = {},
): Promise<CollectionFollowup[]> {
  let q = supabase.from(TABLE as any).select("*").eq("is_deleted", false);
  if (filters.month) q = q.eq("month", filters.month);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
  if (filters.followupOwner) q = q.eq("followup_owner", filters.followupOwner);
  if (filters.dueFrom) q = q.gte("due_date", filters.dueFrom);
  if (filters.dueTo) q = q.lte("due_date", filters.dueTo);

  const { data, error } = await q.order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as CollectionFollowup[];
  if (filters.overdueOnly) {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter(
      (r) =>
        r.status !== "collected" &&
        r.status !== "written_off" &&
        r.due_date !== null &&
        r.due_date < today,
    );
  }
  return rows;
}

export async function getCollectionFollowupsByClient(
  clientId: string,
): Promise<CollectionFollowup[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("client_id", clientId)
    .eq("is_deleted", false)
    .order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CollectionFollowup[];
}

export async function getCollectionFollowupById(
  id: string,
): Promise<CollectionFollowup | null> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any) ?? null;
}

export type FollowupInput = Partial<Omit<CollectionFollowup, "id" | "is_deleted">> & {
  client_id: string;
  month: string;
  pending_amount: number;
  status: FollowupStatus;
  priority: FollowupPriority;
};

export async function createCollectionFollowup(input: FollowupInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from(TABLE as any).insert({
    ...input,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateCollectionFollowup(
  id: string,
  input: Partial<FollowupInput>,
): Promise<void> {
  const { error } = await supabase.from(TABLE as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteCollectionFollowup(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(TABLE as any)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Quick actions ---------------------------------------------------------

export async function markCollectionAsFollowedUp(
  id: string,
  data: { channel?: string | null; notes?: string | null; nextFollowupDate?: string | null },
): Promise<void> {
  await updateCollectionFollowup(id, {
    status: "followed_up",
    last_followup_date: new Date().toISOString().slice(0, 10),
    next_followup_date: data.nextFollowupDate ?? null,
    communication_channel: (data.channel as any) ?? null,
    notes: data.notes ?? undefined,
  });
}

export async function markCollectionAsPromised(
  id: string,
  promiseToPayDate: string,
  notes?: string,
): Promise<void> {
  await updateCollectionFollowup(id, {
    status: "promised",
    promise_to_pay_date: promiseToPayDate,
    notes: notes ?? undefined,
    last_followup_date: new Date().toISOString().slice(0, 10),
  });
}

export async function markCollectionAsPartiallyCollected(
  id: string,
  amountRecovered: number,
): Promise<void> {
  await updateCollectionFollowup(id, {
    status: "partially_collected",
    amount_recovered: amountRecovered,
  });
}

export async function markCollectionAsCollected(
  id: string,
  amountRecovered: number,
): Promise<void> {
  await updateCollectionFollowup(id, {
    status: "collected",
    amount_recovered: amountRecovered,
  });
}

// Bulk-create followups for monthly entries that have pending amount but
// no followup yet. Returns count created.
export async function backfillFollowupsFromPendingEntries(): Promise<number> {
  const [{ data: entries, error: eErr }, { data: existing, error: fErr }] = await Promise.all([
    supabase
      .from("marketizers_monthly_entries" as any)
      .select("id, client_id, month, amount_pending")
      .eq("is_deleted", false)
      .gt("amount_pending", 0),
    supabase
      .from(TABLE as any)
      .select("monthly_entry_id, client_id, month")
      .eq("is_deleted", false),
  ]);
  if (eErr) throw new Error(eErr.message);
  if (fErr) throw new Error(fErr.message);

  const seenByEntry = new Set(
    ((existing ?? []) as any[]).map((f) => f.monthly_entry_id).filter(Boolean),
  );
  const seenByClientMonth = new Set(
    ((existing ?? []) as any[]).map((f) => `${f.client_id}__${f.month}`),
  );

  const toCreate = ((entries ?? []) as any[]).filter((e) => {
    if (e.id && seenByEntry.has(e.id)) return false;
    if (seenByClientMonth.has(`${e.client_id}__${e.month}`)) return false;
    return true;
  });
  if (!toCreate.length) return 0;

  const { data: { user } } = await supabase.auth.getUser();
  const payload = toCreate.map((e) => ({
    client_id: e.client_id,
    monthly_entry_id: e.id,
    month: e.month,
    pending_amount: e.amount_pending,
    status: "pending",
    priority: "medium",
    created_by: user?.id ?? null,
  }));
  const { error } = await supabase.from(TABLE as any).insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

// Count of pending entries that don't have a followup yet.
export async function countPendingEntriesWithoutFollowup(): Promise<number> {
  const [{ data: entries }, { data: existing }] = await Promise.all([
    supabase
      .from("marketizers_monthly_entries" as any)
      .select("id, client_id, month")
      .eq("is_deleted", false)
      .gt("amount_pending", 0),
    supabase
      .from(TABLE as any)
      .select("monthly_entry_id, client_id, month")
      .eq("is_deleted", false),
  ]);
  const seenByEntry = new Set(
    ((existing ?? []) as any[]).map((f) => f.monthly_entry_id).filter(Boolean),
  );
  const seenByClientMonth = new Set(
    ((existing ?? []) as any[]).map((f) => `${f.client_id}__${f.month}`),
  );
  return ((entries ?? []) as any[]).filter((e) => {
    if (seenByEntry.has(e.id)) return false;
    if (seenByClientMonth.has(`${e.client_id}__${e.month}`)) return false;
    return true;
  }).length;
}
