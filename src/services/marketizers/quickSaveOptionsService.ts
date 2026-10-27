// Marketizers — quick-save options service. Lets the Add Client drawer
// (and other forms) persist user-added dropdown values per option_group.

import { supabase } from "@/integrations/supabase/client";

const TABLE = "marketizers_quick_save_options" as const;

export type QuickSaveOption = {
  id: string;
  option_group: string;
  label: string;
  value: string;
  is_active: boolean;
};

export async function listQuickSaveOptions(group: string): Promise<QuickSaveOption[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("id, option_group, label, value, is_active")
    .eq("option_group", group)
    .eq("is_active", true)
    .order("label");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QuickSaveOption[];
}

export async function listQuickSaveOptionsBulk(
  groups: string[],
): Promise<Record<string, QuickSaveOption[]>> {
  if (!groups.length) return {};
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("id, option_group, label, value, is_active")
    .in("option_group", groups)
    .eq("is_active", true)
    .order("label");
  if (error) throw new Error(error.message);
  const out: Record<string, QuickSaveOption[]> = {};
  for (const g of groups) out[g] = [];
  for (const row of (data ?? []) as any[]) {
    (out[row.option_group] ??= []).push(row as QuickSaveOption);
  }
  return out;
}

export async function addQuickSaveOption(
  group: string,
  label: string,
): Promise<QuickSaveOption> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Value cannot be empty.");
  // Try insert; on unique conflict, fetch existing row.
  const { data, error } = await supabase
    .from(TABLE as any)
    .insert({ option_group: group, label: trimmed, value: trimmed })
    .select("id, option_group, label, value, is_active")
    .maybeSingle();
  if (error) {
    // Likely a duplicate — fetch the existing one.
    const existing = await listQuickSaveOptions(group);
    const match = existing.find((o) => o.value.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;
    throw new Error(error.message);
  }
  return data as unknown as QuickSaveOption;
}
