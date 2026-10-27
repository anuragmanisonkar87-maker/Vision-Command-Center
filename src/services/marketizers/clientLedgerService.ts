// Client Finance Ledger — data layer for per-client income/expense ledger
// and editable profit-split rules. UI-free.

import { supabase } from "@/integrations/supabase/client";

export type LedgerEntryType = "income" | "expense";

export type LedgerEntryDeduction = {
  label?: string;
  type?: "flat" | "percent";
  amount?: number;
  notes?: string;
};

export type LedgerEntryMetadata = {
  gst_applicable?: boolean;
  gst_rate?: number;
  auto_excl?: boolean;
  deduction?: LedgerEntryDeduction;
  custom?: Record<string, string>;
};

export type LedgerEntry = {
  id: string;
  client_id: string;
  ledger_month: string; // YYYY-MM
  entry_type: LedgerEntryType;
  entry_date: string | null;
  name: string | null;
  category: string | null;
  amount_inclusive_gst: number;
  amount_excluding_gst: number;
  source: string | null;
  notes: string | null;
  is_deleted: boolean;
  metadata?: LedgerEntryMetadata | null;
  created_at?: string;
  updated_at?: string;
};


export type ProfitSplit = {
  id: string;
  client_id: string;
  receiver_name: string;
  receiver_type: "Marketizers" | "Partner" | "Other";
  split_percent: number;
  is_marketizers_revenue: boolean;
  sort_order: number;
  is_deleted: boolean;
};

const ENTRIES = "marketizers_client_ledger_entries" as const;
const SPLITS = "marketizers_client_profit_splits" as const;
const MONTHLY = "marketizers_monthly_entries" as const;

export type LedgerPushStatus = {
  exists: boolean;
  monthlyEntryId: string | null;
  marketizersRevenue: number;
  ledgerPushedAmount: number | null;
  ledgerPushedAt: string | null;
  ledgerSource: string | null;
};

export async function getMonthlyEntryPushStatus(
  clientId: string,
  month: string,
): Promise<LedgerPushStatus> {
  const { data, error } = await supabase
    .from(MONTHLY as any)
    .select("id, marketizers_revenue, ledger_source, ledger_pushed_amount, ledger_pushed_at")
    .eq("client_id", clientId)
    .eq("month", month)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      exists: false,
      monthlyEntryId: null,
      marketizersRevenue: 0,
      ledgerPushedAmount: null,
      ledgerPushedAt: null,
      ledgerSource: null,
    };
  }
  const row = data as any;
  return {
    exists: true,
    monthlyEntryId: row.id,
    marketizersRevenue: Number(row.marketizers_revenue ?? 0),
    ledgerPushedAmount:
      row.ledger_pushed_amount == null ? null : Number(row.ledger_pushed_amount),
    ledgerPushedAt: row.ledger_pushed_at ?? null,
    ledgerSource: row.ledger_source ?? null,
  };
}

export async function pushMarketizersShareToMonthlyEntry(
  clientId: string,
  month: string,
  marketizersShare: number,
): Promise<LedgerPushStatus> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const now = new Date().toISOString();

  const existing = await getMonthlyEntryPushStatus(clientId, month);
  if (existing.exists && existing.monthlyEntryId) {
    const { error } = await supabase
      .from(MONTHLY as any)
      .update({
        marketizers_revenue: marketizersShare,
        ledger_source: "client_ledger",
        ledger_pushed_amount: marketizersShare,
        ledger_pushed_at: now,
        ledger_pushed_by: userId,
      })
      .eq("id", existing.monthlyEntryId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from(MONTHLY as any).insert({
      client_id: clientId,
      month,
      marketizers_revenue: marketizersShare,
      ledger_source: "client_ledger",
      ledger_pushed_amount: marketizersShare,
      ledger_pushed_at: now,
      ledger_pushed_by: userId,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
  }
  return getMonthlyEntryPushStatus(clientId, month);
}

export async function listLedgerEntries(
  clientId: string,
  month: string,
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from(ENTRIES as any)
    .select("*")
    .eq("client_id", clientId)
    .eq("ledger_month", month)
    .eq("is_deleted", false)
    .order("entry_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LedgerEntry[];
}

export async function createLedgerEntry(
  clientId: string,
  month: string,
  entry_type: LedgerEntryType,
): Promise<LedgerEntry> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(ENTRIES as any)
    .insert({
      client_id: clientId,
      ledger_month: month,
      entry_type,
      entry_date: new Date().toISOString().slice(0, 10),
      amount_inclusive_gst: 0,
      amount_excluding_gst: 0,
      created_by: u.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LedgerEntry;
}

export async function updateLedgerEntry(
  id: string,
  patch: Partial<LedgerEntry>,
): Promise<void> {
  const { error } = await supabase
    .from(ENTRIES as any)
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from(ENTRIES as any)
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type LedgerImportRow = {
  entry_type: LedgerEntryType;
  entry_date: string | null;
  name: string | null;
  category: string | null;
  amount_inclusive_gst: number;
  amount_excluding_gst: number;
  source: string | null;
  notes: string | null;
};

export type LedgerImportBatch = {
  id: string;
  client_id: string;
  ledger_month: string;
  import_type: "income" | "expense" | "mixed";
  rows_imported: number;
  rows_skipped: number;
  duplicates_skipped: number;
  income_total_excl_gst: number;
  expense_total_excl_gst: number;
  source_name: string | null;
  created_by: string | null;
  created_at: string;
  is_undone: boolean;
  undone_at: string | null;
  undone_by: string | null;
};

const BATCHES = "marketizers_client_ledger_import_batches" as const;
const TEMPLATES = "marketizers_ledger_import_mapping_templates" as const;

export async function bulkCreateLedgerEntries(
  clientId: string,
  month: string,
  rows: LedgerImportRow[],
  meta?: {
    source_name?: string | null;
    rows_skipped?: number;
    duplicates_skipped?: number;
  },
): Promise<{ entries: LedgerEntry[]; batch: LedgerImportBatch | null }> {
  if (!rows.length) return { entries: [], batch: null };
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;

  const incomeTotal = rows
    .filter((r) => r.entry_type === "income")
    .reduce((s, r) => s + Number(r.amount_excluding_gst || 0), 0);
  const expenseTotal = rows
    .filter((r) => r.entry_type === "expense")
    .reduce((s, r) => s + Number(r.amount_excluding_gst || 0), 0);
  const hasIncome = rows.some((r) => r.entry_type === "income");
  const hasExpense = rows.some((r) => r.entry_type === "expense");
  const importType: "income" | "expense" | "mixed" =
    hasIncome && hasExpense ? "mixed" : hasIncome ? "income" : "expense";

  const { data: batchRow, error: bErr } = await supabase
    .from(BATCHES as any)
    .insert({
      client_id: clientId,
      ledger_month: month,
      import_type: importType,
      rows_imported: rows.length,
      rows_skipped: meta?.rows_skipped ?? 0,
      duplicates_skipped: meta?.duplicates_skipped ?? 0,
      income_total_excl_gst: incomeTotal,
      expense_total_excl_gst: expenseTotal,
      source_name: meta?.source_name ?? null,
      created_by: userId,
    })
    .select("*")
    .single();
  if (bErr) throw new Error(bErr.message);
  const batch = batchRow as unknown as LedgerImportBatch;

  const payload = rows.map((r) => ({
    client_id: clientId,
    ledger_month: month,
    entry_type: r.entry_type,
    entry_date: r.entry_date,
    name: r.name,
    category: r.category,
    amount_inclusive_gst: r.amount_inclusive_gst,
    amount_excluding_gst: r.amount_excluding_gst,
    source: r.source,
    notes: r.notes,
    import_batch_id: batch.id,
    import_source: meta?.source_name ?? null,
    created_by: userId,
  }));
  const { data, error } = await supabase
    .from(ENTRIES as any)
    .insert(payload)
    .select("*");
  if (error) throw new Error(error.message);
  return { entries: (data ?? []) as unknown as LedgerEntry[], batch };
}

export async function listImportBatches(
  clientId: string,
  month: string,
): Promise<LedgerImportBatch[]> {
  const { data, error } = await supabase
    .from(BATCHES as any)
    .select("*")
    .eq("client_id", clientId)
    .eq("ledger_month", month)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LedgerImportBatch[];
}

export async function undoImportBatch(batchId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const now = new Date().toISOString();
  // Soft-delete only rows still attached to this batch (manual rows untouched)
  const { error: e1 } = await supabase
    .from(ENTRIES as any)
    .update({ is_deleted: true })
    .eq("import_batch_id", batchId)
    .eq("is_deleted", false);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase
    .from(BATCHES as any)
    .update({ is_undone: true, undone_at: now, undone_by: userId })
    .eq("id", batchId);
  if (e2) throw new Error(e2.message);
}

export type MappingTemplate = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  name: string;
  headers: string[];
  mapping: string[];
  default_row_type: LedgerEntryType;
  created_at: string;
};

export async function listMappingTemplates(
  clientId: string,
): Promise<MappingTemplate[]> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  let q = supabase
    .from(TEMPLATES as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).filter(
    (t: any) => !t.client_id || t.client_id === clientId,
  ) as unknown as MappingTemplate[];
}

export async function saveMappingTemplate(
  name: string,
  headers: string[],
  mapping: string[],
  defaultRowType: LedgerEntryType,
  clientId: string | null,
): Promise<MappingTemplate> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const { data, error } = await supabase
    .from(TEMPLATES as any)
    .insert({
      user_id: userId,
      client_id: clientId,
      name,
      headers,
      mapping,
      default_row_type: defaultRowType,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as MappingTemplate;
}


export async function listProfitSplits(clientId: string): Promise<ProfitSplit[]> {
  const { data, error } = await supabase
    .from(SPLITS as any)
    .select("*")
    .eq("client_id", clientId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProfitSplit[];
}

export async function createProfitSplit(
  clientId: string,
  init?: Partial<ProfitSplit>,
): Promise<ProfitSplit> {
  const { data, error } = await supabase
    .from(SPLITS as any)
    .insert({
      client_id: clientId,
      receiver_name: init?.receiver_name ?? "",
      receiver_type: init?.receiver_type ?? "Partner",
      split_percent: init?.split_percent ?? 0,
      is_marketizers_revenue: init?.is_marketizers_revenue ?? false,
      sort_order: init?.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ProfitSplit;
}

export async function updateProfitSplit(
  id: string,
  patch: Partial<ProfitSplit>,
): Promise<void> {
  const { error } = await supabase
    .from(SPLITS as any)
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProfitSplit(id: string): Promise<void> {
  const { error } = await supabase
    .from(SPLITS as any)
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─────────────────────────────── Ledger Categories ─────────────────────────────── */

const CATEGORIES = "marketizers_ledger_categories" as const;

export type LedgerCategory = {
  id: string;
  category_type: LedgerEntryType;
  name: string;
  is_active: boolean;
  created_at?: string;
};

export async function listLedgerCategories(
  type?: LedgerEntryType,
): Promise<LedgerCategory[]> {
  let q = supabase
    .from(CATEGORIES as any)
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (type) q = q.eq("category_type", type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LedgerCategory[];
}

export async function createLedgerCategory(
  type: LedgerEntryType,
  name: string,
): Promise<LedgerCategory> {
  const cleaned = name.trim();
  if (!cleaned) throw new Error("Category name required.");
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(CATEGORIES as any)
    .insert({
      category_type: type,
      name: cleaned,
      created_by: u.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) {
    const { data: existing } = await supabase
      .from(CATEGORIES as any)
      .select("*")
      .eq("category_type", type)
      .ilike("name", cleaned)
      .maybeSingle();
    if (existing) return existing as unknown as LedgerCategory;
    throw new Error(error.message);
  }
  return data as unknown as LedgerCategory;
}

/* ─────────────────────────────── Ledger Sources ─────────────────────────────── */

const SOURCES = "marketizers_ledger_sources" as const;

export type LedgerSource = {
  id: string;
  source_type: "income" | "expense" | "both";
  name: string;
  is_active: boolean;
};

export async function listLedgerSources(
  type?: LedgerEntryType,
): Promise<LedgerSource[]> {
  let q = supabase
    .from(SOURCES as any)
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (type) q = q.in("source_type", [type, "both"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LedgerSource[];
}

export async function createLedgerSource(
  type: LedgerEntryType,
  name: string,
): Promise<LedgerSource> {
  const cleaned = name.trim();
  if (!cleaned) throw new Error("Source name required.");
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(SOURCES as any)
    .insert({
      source_type: type,
      name: cleaned,
      created_by: u.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) {
    const { data: existing } = await supabase
      .from(SOURCES as any)
      .select("*")
      .in("source_type", [type, "both"])
      .ilike("name", cleaned)
      .maybeSingle();
    if (existing) return existing as unknown as LedgerSource;
    throw new Error(error.message);
  }
  return data as unknown as LedgerSource;
}

/* ─────────────────────────── Insert / Duplicate ─────────────────────────── */

export async function insertBlankLedgerEntry(
  clientId: string,
  month: string,
  entry_type: LedgerEntryType,
  refDate: string | null,
): Promise<LedgerEntry> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(ENTRIES as any)
    .insert({
      client_id: clientId,
      ledger_month: month,
      entry_type,
      entry_date: refDate ?? new Date().toISOString().slice(0, 10),
      amount_inclusive_gst: 0,
      amount_excluding_gst: 0,
      created_by: u.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LedgerEntry;
}

export async function duplicateLedgerEntry(source: LedgerEntry): Promise<LedgerEntry> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(ENTRIES as any)
    .insert({
      client_id: source.client_id,
      ledger_month: source.ledger_month,
      entry_type: source.entry_type,
      entry_date: source.entry_date,
      name: source.name,
      category: source.category,
      amount_inclusive_gst: source.amount_inclusive_gst,
      amount_excluding_gst: source.amount_excluding_gst,
      source: source.source,
      notes: source.notes,
      created_by: u.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LedgerEntry;
}


