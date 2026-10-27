// @ts-nocheck
// Helpers for Daily Lead Reporting: formatting, hashing, exports

export const inr = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const fmtNum = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("en-IN");

export const fmtPct = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toFixed(2) + "%";

export const fmtDateLong = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export type DailyMetricDef = {
  key: string;
  name: string;
  type: "number" | "currency" | "percentage" | "text";
  aggregation?: "sum" | "average" | "weighted_average" | "display_only";
  whatsapp?: boolean;
  exports?: boolean;
};

export type DailyAdAccount = {
  id: string;
  ad_account_name: string;
  ad_spend: number;
  metrics: Record<string, string | number>;
};

export type DailyMediaBuyer = {
  id: string;
  media_buyer_name: string;
  team_member_id?: string | null;
  spend_mode: "combined" | "breakdown";
  combined_spend?: number;
  combined_metrics?: Record<string, string | number>;
  ad_accounts: DailyAdAccount[];
  // source
  lead_source_url: string;
  spreadsheet_id?: string;
  spreadsheet_title?: string;
  tab_name?: string;
  sheet_id?: string;
  date_column?: string;
  available_tabs?: { tabName: string; sheetId: string; headers?: string[] }[];
  // results
  total_leads: number;
  lead_count_source: "google_sheet" | "manual_override";
  status: "ready" | "fetched" | "needs_review" | "failed" | "manual_override" | "missing_spend";
  fetch_metadata?: any;
  save_mapping?: boolean;
};

export type DailyReport = {
  id?: string;
  report_name: string;
  report_date: string; // YYYY-MM-DD
  notes: string;
  client_id?: string | null;
  client_name?: string | null;
  metric_template_id?: string;
  metric_template_name?: string;
  metrics: DailyMetricDef[];
  media_buyers: DailyMediaBuyer[];
};

export function formatMetricValue(def: DailyMetricDef, raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (def.type === "currency") return inr(isNaN(n) ? 0 : n);
  if (def.type === "percentage") return isNaN(n) ? String(raw) : fmtPct(n);
  if (def.type === "number") return isNaN(n) ? String(raw) : fmtNum(n);
  return String(raw);
}

export function calcMediaBuyerSpend(mb: DailyMediaBuyer): number {
  if (mb.spend_mode === "combined") return Number(mb.combined_spend) || 0;
  return mb.ad_accounts.reduce((s, a) => s + (Number(a.ad_spend) || 0), 0);
}

export function calcCpl(spend: number, leads: number): number | null {
  if (!leads || leads <= 0) return null;
  return spend / leads;
}

export async function hashReport(r: DailyReport, createdBy: string | null): Promise<string> {
  const payload = {
    d: r.report_date,
    u: createdBy || "",
    mb: r.media_buyers.map((m) => ({
      n: m.media_buyer_name.toLowerCase().trim(),
      s: calcMediaBuyerSpend(m),
      l: m.total_leads,
      url: (m.lead_source_url || "").trim(),
      tab: (m.tab_name || "").trim(),
    })),
  };
  const txt = JSON.stringify(payload);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ----------------- WhatsApp -----------------
export function buildWhatsApp(r: DailyReport): string {
  const buyers = r.media_buyers.filter((m) => (m.media_buyer_name || "").trim() || calcMediaBuyerSpend(m) > 0 || m.total_leads > 0);
  const totals = buyers.reduce((acc, m) => {
    acc.spend += calcMediaBuyerSpend(m);
    acc.leads += m.total_leads || 0;
    return acc;
  }, { spend: 0, leads: 0 });
  const overallCpl = calcCpl(totals.spend, totals.leads);

  const lines: string[] = [];
  lines.push(`Daily Lead Report - ${fmtDateLong(r.report_date)}`);
  lines.push("");
  lines.push("Overall:");
  if (totals.spend > 0) lines.push(`Ad Spend: ${inr(totals.spend)}`);
  if (totals.leads > 0) lines.push(`Leads: ${fmtNum(totals.leads)}`);
  if (overallCpl != null) lines.push(`Overall CPL: ${inr(overallCpl)}`);
  lines.push("");
  lines.push("Media Buyer Breakdown:");

  for (const mb of buyers) {
    const spend = calcMediaBuyerSpend(mb);
    const cpl = calcCpl(spend, mb.total_leads);
    lines.push("");
    lines.push(mb.media_buyer_name || "(unnamed)");
    if (mb.spend_mode === "breakdown" && mb.ad_accounts.length) {
      const names = mb.ad_accounts.map((a) => a.ad_account_name).filter(Boolean).join(", ");
      if (names) lines.push(`Ad Accounts: ${names}`);
    }
    if (spend > 0) lines.push(`Ad Spend: ${inr(spend)}`);
    if (mb.total_leads > 0) lines.push(`Leads: ${fmtNum(mb.total_leads)}`);
    if (cpl != null) lines.push(`CPL: ${inr(cpl)}`);

    const wmetrics = r.metrics.filter((m) => m.whatsapp !== false);
    for (const def of wmetrics) {
      const vals: number[] = [];
      if (mb.spend_mode === "combined") {
        const sample = mb.combined_metrics?.[def.key];
        if (sample !== undefined && sample !== null && sample !== "") {
          const n = typeof sample === "number" ? sample : parseFloat(String(sample));
          if (!isNaN(n)) vals.push(n);
        }
      } else {
        for (const a of mb.ad_accounts) {
          const v = a.metrics?.[def.key];
          if (v !== undefined && v !== null && v !== "" && !isNaN(parseFloat(String(v)))) vals.push(parseFloat(String(v)));
        }
      }
      if (vals.length === 0) continue;
      const display = def.aggregation === "sum"
        ? vals.reduce((s, v) => s + v, 0)
        : vals.reduce((s, v) => s + v, 0) / vals.length;
      lines.push(`${def.name}: ${formatMetricValue(def, display)}`);
    }
  }

  if (r.notes && r.notes.trim()) {
    lines.push("");
    lines.push("Notes:");
    lines.push(r.notes.trim());
  }

  return lines.join("\n");
}

// ----------------- CSV -----------------
function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function buildCsv(r: DailyReport): string {
  const totals = r.media_buyers.reduce((acc, m) => {
    acc.spend += calcMediaBuyerSpend(m);
    acc.leads += m.total_leads || 0;
    return acc;
  }, { spend: 0, leads: 0 });
  const overallCpl = calcCpl(totals.spend, totals.leads);

  const out: string[] = [];
  out.push("=== DAILY LEAD REPORT ===");
  out.push(`Report Name,${csvEscape(r.report_name)}`);
  out.push(`Report Date,${r.report_date}`);
  out.push(`Generated,${new Date().toISOString()}`);
  out.push(`Total Ad Spend,${totals.spend}`);
  out.push(`Total Leads,${totals.leads}`);
  out.push(`Overall CPL,${overallCpl ?? ""}`);
  if (r.notes) out.push(`Notes,${csvEscape(r.notes)}`);
  out.push("");

  const exportMetrics = r.metrics.filter((m) => m.exports !== false);

  out.push("=== AD ACCOUNT ROWS ===");
  const headers = [
    "Media Buyer", "Lead Source Sheet", "Tab", "Date Column", "Leads Fetched",
    "Lead Count Source", "Media Buyer Total Spend", "Media Buyer CPL",
    "Spend Mode", "Ad Account", "Ad Account Spend",
    ...exportMetrics.map((m) => m.name),
    "Status",
  ];
  out.push(headers.map(csvEscape).join(","));

  for (const mb of r.media_buyers) {
    const spend = calcMediaBuyerSpend(mb);
    const cpl = calcCpl(spend, mb.total_leads);
    const baseCols = [
      mb.media_buyer_name,
      mb.spreadsheet_title || mb.lead_source_url || "",
      mb.tab_name || "",
      mb.date_column || "",
      mb.total_leads,
      mb.lead_count_source,
      spend,
      cpl ?? "",
      mb.spend_mode,
    ];
    if (mb.spend_mode === "combined") {
      const metricCols = exportMetrics.map((m) => mb.combined_metrics?.[m.key] ?? "");
      out.push([...baseCols, "(combined)", spend, ...metricCols, mb.status].map(csvEscape).join(","));
    } else if (mb.ad_accounts.length === 0) {
      const metricCols = exportMetrics.map(() => "");
      out.push([...baseCols, "", "", ...metricCols, mb.status].map(csvEscape).join(","));
    } else {
      for (const a of mb.ad_accounts) {
        const metricCols = exportMetrics.map((m) => a.metrics?.[m.key] ?? "");
        out.push([...baseCols, a.ad_account_name, a.ad_spend, ...metricCols, mb.status].map(csvEscape).join(","));
      }
    }
  }
  return out.join("\n");
}

// ----------------- Google Sheets Ready (TSV) -----------------
export function buildSheetsTSV(r: DailyReport): string {
  const exportMetrics = r.metrics.filter((m) => m.exports !== false);
  const headers = [
    "Report Date", "Report Name", "Media Buyer", "Ad Account",
    "Ad Spend", "Leads", "CPL",
    ...exportMetrics.map((m) => m.name),
    "Notes",
  ];
  const lines: string[] = [headers.join("\t")];
  for (const mb of r.media_buyers) {
    const spend = calcMediaBuyerSpend(mb);
    const cpl = calcCpl(spend, mb.total_leads);
    if (mb.spend_mode === "combined") {
      lines.push([
        r.report_date, r.report_name, mb.media_buyer_name, "(combined)",
        spend, mb.total_leads, cpl ?? "",
        ...exportMetrics.map((m) => mb.combined_metrics?.[m.key] ?? ""),
        (r.notes || "").replace(/\t|\n/g, " "),
      ].join("\t"));
    } else {
      const accs = mb.ad_accounts.length ? mb.ad_accounts : [{ id: "", ad_account_name: "", ad_spend: spend, metrics: {} }];
      for (const a of accs) {
        const aCpl = mb.total_leads ? (Number(a.ad_spend) || 0) / mb.total_leads : "";
        lines.push([
          r.report_date, r.report_name, mb.media_buyer_name, a.ad_account_name,
          a.ad_spend, mb.total_leads, aCpl,
          ...exportMetrics.map((m) => a.metrics?.[m.key] ?? ""),
          (r.notes || "").replace(/\t|\n/g, " "),
        ].join("\t"));
      }
    }
  }
  return lines.join("\n");
}

// History list export (CSV across many reports)
export type HistoryRow = {
  created_at: string;
  report_date: string;
  report_name: string;
  media_buyer_count: number;
  total_ad_spend: number;
  total_leads: number;
  overall_cpl: number | null;
  metric_template_name?: string | null;
};
export function buildHistoryCsv(rows: HistoryRow[]): string {
  const headers = ["Created On", "Report Date", "Report Name", "Media Buyers", "Total Spend", "Total Leads", "Overall CPL", "Template"];
  const out = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    out.push([
      new Date(r.created_at).toISOString(),
      r.report_date, r.report_name, r.media_buyer_count,
      r.total_ad_spend, r.total_leads, r.overall_cpl ?? "",
      r.metric_template_name || "",
    ].map(csvEscape).join(","));
  }
  return out.join("\n");
}
export function buildHistoryTSV(rows: HistoryRow[]): string {
  const headers = ["Created On", "Report Date", "Report Name", "Media Buyers", "Total Spend", "Total Leads", "Overall CPL", "Template"];
  const lines = [headers.join("\t")];
  for (const r of rows) {
    lines.push([
      new Date(r.created_at).toISOString().slice(0, 10),
      r.report_date, r.report_name, r.media_buyer_count,
      r.total_ad_spend, r.total_leads, r.overall_cpl ?? "",
      r.metric_template_name || "",
    ].join("\t"));
  }
  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ----------------- PDF (uses jsPDF + autoTable already in project) -----------------
export async function buildAndDownloadPdf(r: DailyReport) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod as any).default || (autoTableMod as any);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const totals = r.media_buyers.reduce((acc, m) => {
    acc.spend += calcMediaBuyerSpend(m);
    acc.leads += m.total_leads || 0;
    return acc;
  }, { spend: 0, leads: 0 });
  const overallCpl = calcCpl(totals.spend, totals.leads);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(20);
  doc.text("IPC Daily Lead Report", 40, 50);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`Report Date: ${fmtDateLong(r.report_date)}`, 40, 70);
  doc.text(`Generated: ${fmtDateTime(new Date())}`, 40, 86);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 110,
    head: [["Total Ad Spend", "Total Leads", "Overall CPL", "Media Buyers"]],
    body: [[inr(totals.spend), fmtNum(totals.leads), overallCpl == null ? "—" : inr(overallCpl), String(r.media_buyers.length)]],
    theme: "grid",
    headStyles: { fillColor: [247, 246, 243], textColor: 0, fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  // Media buyer breakdown
  const mbBody = r.media_buyers.map((mb) => {
    const spend = calcMediaBuyerSpend(mb);
    const cpl = calcCpl(spend, mb.total_leads);
    const accNames = mb.spend_mode === "breakdown"
      ? mb.ad_accounts.map((a) => a.ad_account_name).filter(Boolean).join(", ")
      : "(combined)";
    return [mb.media_buyer_name, accNames, inr(spend), fmtNum(mb.total_leads), cpl == null ? "—" : inr(cpl), mb.status];
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Media Buyer", "Ad Accounts", "Spend", "Leads", "CPL", "Status"]],
    body: mbBody,
    theme: "grid",
    headStyles: { fillColor: [247, 246, 243], textColor: 0 },
    styles: { fontSize: 9 },
  });

  // Detailed ad account metrics
  const exportMetrics = r.metrics.filter((m) => m.exports !== false);
  const detailHeaders = ["Media Buyer", "Ad Account", "Spend", ...exportMetrics.map((m) => m.name)];
  const detailBody: any[][] = [];
  for (const mb of r.media_buyers) {
    if (mb.spend_mode === "combined") {
      detailBody.push([
        mb.media_buyer_name, "(combined)", inr(Number(mb.combined_spend) || 0),
        ...exportMetrics.map((m) => formatMetricValue(m, mb.combined_metrics?.[m.key])),
      ]);
    } else {
      for (const a of mb.ad_accounts) {
        detailBody.push([
          mb.media_buyer_name, a.ad_account_name, inr(a.ad_spend),
          ...exportMetrics.map((m) => formatMetricValue(m, a.metrics?.[m.key])),
        ]);
      }
    }
  }
  if (detailBody.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [detailHeaders],
      body: detailBody,
      theme: "grid",
      headStyles: { fillColor: [247, 246, 243], textColor: 0 },
      styles: { fontSize: 8 },
    });
  }

  if (r.notes && r.notes.trim()) {
    const y = (doc as any).lastAutoTable.finalY + 24;
    doc.setFontSize(11);
    doc.text("Notes", 40, y);
    doc.setFontSize(10);
    doc.setTextColor(80);
    const split = doc.splitTextToSize(r.notes.trim(), 515);
    doc.text(split, 40, y + 16);
  }

  const fname = `daily-lead-report-${r.report_date}.pdf`;
  doc.save(fname);
}
