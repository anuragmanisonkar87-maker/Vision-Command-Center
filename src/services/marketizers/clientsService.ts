// Marketizers — client accounts service. UI-free. Returns typed data or
// throws Error with a clean message. Centralizes Supabase access.

import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/types/marketizers";

const TABLE = "marketizers_clients" as const;

// Slim column set used by list views — avoids hauling all ~40 extended fields
// (added in the Add Client upgrade) over the wire on every page load.
const LIST_COLUMNS =
  "id, client_name, founder_name, niche, revenue_model, start_date, status, assigned_manager, notes, is_deleted";

// Tiny in-memory cache so re-visiting the page is instant.
// Any write (create / update / archive) clears it.
let _clientsCache: { data: Client[]; ts: number } | null = null;
const CLIENTS_CACHE_MS = 60_000;
export function invalidateMarketizersClientsCache() { _clientsCache = null; }

export async function getMarketizersClients(force = false): Promise<Client[]> {
  if (!force && _clientsCache && Date.now() - _clientsCache.ts < CLIENTS_CACHE_MS) {
    return _clientsCache.data;
  }
  const { data, error } = await supabase
    .from(TABLE as any)
    .select(LIST_COLUMNS)
    .eq("is_deleted", false)
    .order("client_name");
  if (error) throw new Error(error.message);
  const list = (data ?? []) as unknown as Client[];
  _clientsCache = { data: list, ts: Date.now() };
  return list;
}

/** Returns all clients including soft-deleted ones. Used by the "Deleted" filter. */
export async function getAllMarketizersClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select(LIST_COLUMNS + ", deleted_at")
    .order("client_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Client[];
}

export async function getMarketizersClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any) ?? null;
}

export type ClientInput = {
  client_name: string;
  founder_name?: string | null;
  niche?: string | null;
  revenue_model: string;
  start_date?: string | null;
  status?: string;
  assigned_manager?: string | null;
  notes?: string | null;
  // Extended optional fields (added in Add Client drawer upgrade).
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  social_url?: string | null;
  business_category?: string | null;
  client_stage?: string | null;
  monthly_retainer_amount?: number | null;
  billing_cycle?: string | null;
  billing_date?: string | null;
  collection_due_date?: string | null;
  gst_applicable?: boolean | null;
  revenue_share_percentage?: number | null;
  revenue_base?: string | null;
  settlement_frequency?: string | null;
  minimum_guarantee?: number | null;
  revenue_tracking_source?: string | null;
  revenue_tracking_sources?: string[] | null;
  base_retainer_amount?: number | null;
  bonus_trigger?: string | null;
  trigger_target_value?: number | null;
  bonus_type?: string | null;
  bonus_amount?: number | null;
  metric_used?: string | null;
  setup_fee?: number | null;
  setup_payment_status?: string | null;
  setup_delivery_deadline?: string | null;
  setup_scope?: string | null;
  trial_duration?: string | null;
  trial_fee?: number | null;
  trial_end_date?: string | null;
  trial_conversion_plan?: string | null;
  custom_revenue_terms?: string | null;
  expected_monthly_revenue?: number | null;
  billing_notes?: string | null;
  account_owner?: string | null;
  media_buyer?: string | null;
  sales_owner?: string | null;
  client_risk?: string | null;
  payment_risk?: string | null;
  important_reminder?: string | null;
};

export async function createMarketizersClient(input: ClientInput): Promise<string> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .insert({ ...input, status: input.status || "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  invalidateMarketizersClientsCache();
  return (data as any).id as string;
}

export async function updateMarketizersClient(id: string, input: Partial<ClientInput>): Promise<void> {
  const { error } = await supabase.from(TABLE as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  invalidateMarketizersClientsCache();
}

export async function archiveMarketizersClient(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), status: "closed" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidateMarketizersClientsCache();
}

/** Soft-delete a client with an audit reason. Records who deleted it and why.
 *  Linked monthly entries / collections / expenses stay intact for finance history. */
export async function softDeleteMarketizersClient(id: string, reason: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(TABLE as any)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      delete_reason: reason || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidateMarketizersClientsCache();
}

/** Restore a soft-deleted client back to active state. */
export async function restoreMarketizersClient(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE as any)
    .update({ is_deleted: false, deleted_at: null, deleted_by: null, delete_reason: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidateMarketizersClientsCache();
}

export async function checkDuplicateMarketizersClient(
  name: string,
  excludeId?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("id, client_name")
    .eq("is_deleted", false);
  if (error) throw new Error(error.message);
  const needle = name.trim().toLowerCase();
  return ((data ?? []) as any[]).some(
    (c) => c.client_name.trim().toLowerCase() === needle && c.id !== excludeId,
  );
}
