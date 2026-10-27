// @ts-nocheck
// Shared helpers for Daily Lead Reporting views
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_BASIC_METRICS_KEY,
} from "./constants";
import {
  buildCsv, buildAndDownloadPdf, buildWhatsApp, buildSheetsTSV, copyToClipboard,
  downloadFile, type DailyReport, type DailyMediaBuyer,
} from "@/lib/mediaBuyer/helpers";
import type { ExportAction } from "./ExportMenu";

const DEFAULT_BASIC_METRICS = DEFAULT_BASIC_METRICS_KEY;

export async function loadFullReport(reportId: string): Promise<DailyReport | null> {
  const { data: r } = await (supabase as any).from("daily_lead_reports").select("*, marketizers_clients(client_name)").eq("id", reportId).single();
  if (!r) return null;
  const { data: mbs } = await (supabase as any).from("daily_lead_report_media_buyers").select("*").eq("report_id", reportId);
  const mbList: DailyMediaBuyer[] = [];
  for (const mb of (mbs || [])) {
    const { data: aas } = await (supabase as any).from("daily_lead_report_ad_accounts").select("*").eq("report_media_buyer_id", mb.id);
    const ads = aas || [];
    const isCombined = ads.length === 1 && ads[0].ad_account_name === "(combined)";
    mbList.push({
      id: mb.id,
      media_buyer_name: mb.media_buyer_name,
      spend_mode: isCombined ? "combined" : "breakdown",
      combined_spend: isCombined ? Number(ads[0].ad_spend) : undefined,
      combined_metrics: isCombined ? (ads[0].metrics || {}) : undefined,
      ad_accounts: ads.map((a: any) => ({
        id: a.id, ad_account_name: a.ad_account_name,
        ad_spend: Number(a.ad_spend), metrics: a.metrics || {},
      })),
      lead_source_url: mb.lead_source_url || "",
      spreadsheet_id: mb.spreadsheet_id,
      spreadsheet_title: mb.spreadsheet_title,
      tab_name: mb.tab_name,
      sheet_id: mb.sheet_id,
      date_column: mb.date_column,
      total_leads: mb.total_leads,
      lead_count_source: mb.lead_count_source,
      status: mb.status,
      fetch_metadata: mb.fetch_metadata,
    });
  }
  let metrics = DEFAULT_BASIC_METRICS;
  if (r.metric_template_id) {
    const { data: tpl } = await (supabase as any)
      .from("daily_metric_templates").select("metrics, template_name").eq("id", r.metric_template_id).single();
    if (tpl?.metrics) metrics = tpl.metrics;
  }
  return {
    id: r.id, report_name: r.report_name || "",
    report_date: r.report_date, notes: r.notes || "",
    client_id: r.client_id || null,
    client_name: r.marketizers_clients?.client_name || null,
    metric_template_id: r.metric_template_id,
    metrics,
    media_buyers: mbList,
  };
}

export async function softDeleteReport(reportId: string) {
  const { error } = await (supabase as any)
    .from("daily_lead_reports")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function restoreReport(reportId: string) {
  const { error } = await (supabase as any)
    .from("daily_lead_reports")
    .update({ is_deleted: false, deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function permanentlyDeleteReport(reportId: string) {
  const { data: mbs } = await (supabase as any)
    .from("daily_lead_report_media_buyers").select("id").eq("report_id", reportId);
  const mbIds = (mbs || []).map((m: any) => m.id);
  if (mbIds.length) {
    await (supabase as any).from("daily_lead_report_ad_accounts").delete().in("report_media_buyer_id", mbIds);
  }
  await (supabase as any).from("daily_lead_report_media_buyers").delete().eq("report_id", reportId);
  const { error } = await (supabase as any).from("daily_lead_reports").delete().eq("id", reportId);
  if (error) throw error;
}

export function daysRemaining(deletedAt?: string | null): number {
  if (!deletedAt) return 14;
  const ms = new Date(deletedAt).getTime() + 14 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export async function runExportAction(action: ExportAction, full: DailyReport) {
  const slug = full.report_date;
  if (action === "csv") downloadFile(`daily-lead-report-${slug}.csv`, buildCsv(full), "text/csv");
  else if (action === "xlsx") downloadFile(`daily-lead-report-${slug}.csv`, buildCsv(full), "text/csv");
  else if (action === "pdf") await buildAndDownloadPdf(full);
  else if (action === "whatsapp") {
    const ok = await copyToClipboard(buildWhatsApp(full));
    if (ok) toast.success("WhatsApp report copied.");
    else toast.error("Could not copy automatically. Please copy manually from the report view.");
  } else if (action === "sheets-download") {
    downloadFile(`daily-lead-report-${slug}-sheets.csv`, buildSheetsTSV(full).replace(/\t/g, ","), "text/csv");
  } else if (action === "sheets-copy") {
    const ok = await copyToClipboard(buildSheetsTSV(full));
    if (ok) toast.success("Google Sheets-ready table copied.");
    else toast.error("Could not copy. Please try Download instead.");
  }
}
