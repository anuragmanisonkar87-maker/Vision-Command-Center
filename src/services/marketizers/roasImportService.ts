// Marketizers ROAS — CSV/sheet import helpers.
// Templates table: marketizers_roas_import_mappings
// Import rows reuse saveRoasSession (no second formula system).
import { supabase } from "@/integrations/supabase/client";
import { saveRoasSession, type RoasSessionInput } from "./roasService";

const TPL = "marketizers_roas_import_mappings" as const;
const SESS = "marketizers_roas_sessions" as const;

export type ImportMappingTemplate = {
  id: string;
  template_name: string;
  client_id: string | null;
  event_type: string | null;
  mapping: Record<string, string>; // roasField -> csvColumn
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export async function listImportMappings(): Promise<ImportMappingTemplate[]> {
  const { data, error } = await supabase
    .from(TPL as any)
    .select("*")
    .eq("is_deleted", false)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ImportMappingTemplate[];
}

export async function saveImportMapping(input: {
  id?: string;
  template_name: string;
  client_id?: string | null;
  event_type?: string | null;
  mapping: Record<string, string>;
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const payload = {
    template_name: input.template_name,
    client_id: input.client_id ?? null,
    event_type: input.event_type ?? null,
    mapping: input.mapping,
    last_used_at: new Date().toISOString(),
    ...(input.id ? {} : { created_by: u?.user?.id ?? null }),
  };
  if (input.id) {
    const { error } = await supabase.from(TPL as any).update(payload as any).eq("id", input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await supabase
    .from(TPL as any)
    .insert(payload as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as any).id;
}

export async function deleteImportMapping(id: string): Promise<void> {
  const { error } = await supabase
    .from(TPL as any)
    .update({ is_deleted: true } as any)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function touchImportMapping(id: string): Promise<void> {
  await supabase
    .from(TPL as any)
    .update({ last_used_at: new Date().toISOString() } as any)
    .eq("id", id);
}

// Duplicate detection — client + event date(s) + campaign date range + campaign/event name.
export async function findDuplicateRoasSession(input: {
  client_id?: string | null;
  client_name?: string | null;
  campaign_date_from?: string | null;
  campaign_date_to?: string | null;
  event_dates?: string[] | null;
  event_name?: string | null;
  campaign_name?: string | null;
}): Promise<string | null> {
  let q = supabase
    .from(SESS as any)
    .select("id, event_dates, event_name, campaign_name")
    .is("deleted_at", null);
  if (input.client_id) q = q.eq("client_id", input.client_id);
  else if (input.client_name) q = q.eq("client_name", input.client_name);
  if (input.campaign_date_from) q = q.eq("campaign_date_from", input.campaign_date_from);
  if (input.campaign_date_to) q = q.eq("campaign_date_to", input.campaign_date_to);
  const { data, error } = await q.limit(50);
  if (error) return null;
  const rows = (data ?? []) as any[];
  if (!rows.length) return null;
  const matchName = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const inEvDates = (rowDates: string[] | null) => {
    if (!input.event_dates?.length || !rowDates?.length) return false;
    const set = new Set(rowDates);
    return input.event_dates.some((d) => set.has(d));
  };
  for (const r of rows) {
    if (
      matchName(r.event_name, input.event_name ?? null) ||
      matchName(r.campaign_name, input.campaign_name ?? null) ||
      inEvDates(r.event_dates)
    ) {
      return r.id as string;
    }
    // If both date range fields matched at query level and nothing else known, treat as dup
    if (
      input.campaign_date_from && input.campaign_date_to &&
      !input.event_dates?.length && !input.event_name && !input.campaign_name
    ) {
      return r.id as string;
    }
  }
  return null;
}

export async function importRoasRow(payload: RoasSessionInput): Promise<string> {
  return saveRoasSession(payload, []);
}
