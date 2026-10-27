// Client-side service for the Google Sheets API-key connector.
// All Sheets API calls go through the `google-sheets-api-key-fetch` edge function.
import { supabase } from "@/integrations/supabase/client";

export type SheetTab = { tabName: string; sheetId: string };

export type FetchResult = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  tabs: SheetTab[];
  sheetName: string | null;
  range: string;
  headers: string[];
  rows: any[][];
  totalRows: number;
  error?: string;
  detail?: string;
};

export type SheetConnection = {
  id: string;
  connection_name: string;
  spreadsheet_id: string;
  sheet_url: string;
  sheet_name: string | null;
  date_column: string | null;
  destination_module: string | null;
  status: string;
  last_synced_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SyncRun = {
  id: string;
  connection_id: string;
  synced_by: string | null;
  row_count: number | null;
  status: string;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export async function fetchSheet(input: {
  sheet_url?: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  range?: string;
  include_metadata?: boolean;
}): Promise<FetchResult> {
  const { data, error } = await supabase.functions.invoke("google-sheets-api-key-fetch", {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as FetchResult;
}

export async function listConnections(): Promise<SheetConnection[]> {
  const { data, error } = await (supabase as any)
    .from("vc_google_sheet_connections")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SheetConnection[];
}

export async function saveConnection(payload: {
  connection_name: string;
  sheet_url: string;
  spreadsheet_id: string;
  sheet_name: string | null;
  date_column: string | null;
  destination_module?: string | null;
}): Promise<SheetConnection> {
  const { data: u } = await supabase.auth.getUser();
  const insert = { ...payload, status: "active", is_active: true, created_by: u.user?.id ?? null };
  const { data, error } = await (supabase as any)
    .from("vc_google_sheet_connections")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SheetConnection;
}

export async function deleteConnection(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("vc_google_sheet_connections")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listSyncRuns(connectionId: string): Promise<SyncRun[]> {
  const { data, error } = await (supabase as any)
    .from("vc_google_sheet_sync_runs")
    .select("*")
    .eq("connection_id", connectionId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as SyncRun[];
}

export async function recordSyncRun(
  connectionId: string,
  result: { row_count: number; status: "success" | "error"; error_message?: string | null },
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const insert = {
    connection_id: connectionId,
    synced_by: u.user?.id ?? null,
    row_count: result.row_count,
    status: result.status,
    error_message: result.error_message ?? null,
    started_at: now,
    finished_at: now,
  };
  const { error } = await (supabase as any).from("vc_google_sheet_sync_runs").insert(insert);
  if (error) throw new Error(error.message);

  if (result.status === "success") {
    await (supabase as any)
      .from("vc_google_sheet_connections")
      .update({ last_synced_at: now, status: "active" })
      .eq("id", connectionId);
  }
}

// ---------- Date filtering helpers ----------

export type DateRangePreset = "today" | "yesterday" | "this_month" | "custom";

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function presetRange(preset: DateRangePreset, customFrom?: string, customTo?: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (preset === "today") {
    const s = ymd(now); return { from: s, to: s };
  }
  if (preset === "yesterday") {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const s = ymd(y); return { from: s, to: s };
  }
  if (preset === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: ymd(from), to: ymd(now) };
  }
  return { from: customFrom ?? null, to: customTo ?? null };
}

export function normalizeDate(raw: any): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let y = m[3]; if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return ymd(d);
  return null;
}

export function filterRowsByDate(
  headers: string[],
  rows: any[][],
  dateColumn: string,
  range: { from: string | null; to: string | null },
): any[][] {
  if (!dateColumn || (!range.from && !range.to)) return rows;
  const idx = headers.findIndex((h) => h.toLowerCase() === dateColumn.toLowerCase());
  if (idx < 0) return rows;
  return rows.filter((row) => {
    const n = normalizeDate(row[idx]);
    if (!n) return false;
    if (range.from && n < range.from) return false;
    if (range.to && n > range.to) return false;
    return true;
  });
}
