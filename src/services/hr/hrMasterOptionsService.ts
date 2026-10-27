// Quick-save master options. Reuses the existing gwv_master_options table.
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type MasterOption = { id: string; option_type: string; option_key: string; label: string; value: string };

export async function listOptions(option_type: string): Promise<MasterOption[]> {
  const { data, error } = await sb
    .from("gwv_master_options")
    .select("id, option_type, option_key, label, value")
    .eq("option_type", option_type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw error;
  return (data || []) as MasterOption[];
}

export async function quickSaveOption(option_type: string, label: string): Promise<MasterOption> {
  const { data: user } = await sb.auth.getUser();
  const value = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const insert = {
    option_type,
    option_key: value,
    label: label.trim(),
    value,
    created_by: user?.user?.id ?? null,
  };
  const { data, error } = await sb.from("gwv_master_options")
    .insert(insert).select("id, option_type, option_key, label, value").single();
  if (error) throw error;
  return data as MasterOption;
}
