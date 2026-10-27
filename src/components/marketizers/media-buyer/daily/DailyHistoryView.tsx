// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildHistoryCsv, buildHistoryTSV, copyToClipboard, downloadFile,
  fmtDateLong, fmtNum, inr, type DailyReport,
} from "@/lib/mediaBuyer/helpers";
import DailyReportDrawer from "./DailyReportDrawer";
import { loadFullReport, runExportAction, softDeleteReport, restoreReport, permanentlyDeleteReport, daysRemaining } from "./sharedActions";
import ExportMenu from "./ExportMenu";

type RowExt = {
  id: string; created_at: string; report_date: string; report_name: string;
  total_ad_spend: number; total_leads: number; overall_cpl: number | null;
  metric_template_id: string | null; report_status: string | null;
  notes?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  client_id?: string | null;
  _client_name?: string | null;
  _media_buyers?: { name: string; spend: number; leads: number }[];
  _ad_accounts?: string[];
  _template_name?: string | null;
};

interface Props {
  onNew: () => void;
  onEditReport: (report: DailyReport) => void;
  onShowAnalytics: () => void;
}

export default function DailyHistoryView({ onNew, onEditReport, onShowAnalytics }: Props) {
  const [rows, setRows] = useState<RowExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [viewing, setViewing] = useState<DailyReport | null>(null);
  const [viewingStatus, setViewingStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const reload = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("daily_lead_reports")
      .select("*, marketizers_clients(client_name)")
      .order("report_date", { ascending: false })
      .limit(500);
    q = showDeleted ? q.eq("is_deleted", true) : q.eq("is_deleted", false);
    const { data: reports } = await q;
    const reportIds = (reports || []).map((r: any) => r.id);
    let mbsByReport: Record<string, any[]> = {};
    if (reportIds.length) {
      const { data: mbs } = await (supabase as any)
        .from("daily_lead_report_media_buyers")
        .select("id, report_id, media_buyer_name, total_ad_spend, total_leads")
        .in("report_id", reportIds);
      for (const m of (mbs || [])) {
        (mbsByReport[m.report_id] ||= []).push(m);
      }
      const mbIds = (mbs || []).map((m: any) => m.id);
      let aaByMb: Record<string, string[]> = {};
      if (mbIds.length) {
        const { data: aas } = await (supabase as any)
          .from("daily_lead_report_ad_accounts")
          .select("report_media_buyer_id, ad_account_name")
          .in("report_media_buyer_id", mbIds);
        for (const a of (aas || [])) {
          (aaByMb[a.report_media_buyer_id] ||= []).push(a.ad_account_name);
        }
      }
      // attach
      for (const r of reports || []) {
        const mbs = mbsByReport[r.id] || [];
        (r as any)._media_buyers = mbs.map((m) => ({
          name: m.media_buyer_name, spend: Number(m.total_ad_spend), leads: Number(m.total_leads),
        }));
        (r as any)._ad_accounts = mbs.flatMap((m) => aaByMb[m.id] || []);
        (r as any)._client_name = (r as any).marketizers_clients?.client_name || null;
      }
    }
    // template names
    const tplIds = Array.from(new Set((reports || []).map((r: any) => r.metric_template_id).filter(Boolean)));
    if (tplIds.length) {
      const { data: tpls } = await (supabase as any)
        .from("daily_metric_templates").select("id, template_name").in("id", tplIds);
      const tplMap = new Map((tpls || []).map((t: any) => [t.id, t.template_name]));
      for (const r of reports || []) (r as any)._template_name = tplMap.get(r.metric_template_id) || null;
    }
    setRows(reports || []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      try { await (supabase as any).rpc("purge_old_deleted_reports"); } catch {}
      reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  const allBuyers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r._media_buyers || []).forEach((m) => s.add(m.name)));
    return Array.from(s).sort();
  }, [rows]);

  const allAccounts = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r._ad_accounts || []).forEach((a) => a && s.add(a)));
    return Array.from(s).sort();
  }, [rows]);

  const allTemplates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r._template_name && s.add(r._template_name));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (from && r.report_date < from) return false;
    if (to && r.report_date > to) return false;
    if (buyerFilter && !(r._media_buyers || []).some((m) => m.name === buyerFilter)) return false;
    if (accountFilter && !(r._ad_accounts || []).some((a) => a === accountFilter)) return false;
    if (templateFilter && r._template_name !== templateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const inName = (r.report_name || "").toLowerCase().includes(q);
      const inNotes = (r.notes || "").toLowerCase().includes(q);
      const inBuyer = (r._media_buyers || []).some((m) => m.name.toLowerCase().includes(q));
      const inAcc = (r._ad_accounts || []).some((a) => (a || "").toLowerCase().includes(q));
      if (!inName && !inNotes && !inBuyer && !inAcc) return false;
    }
    return true;
  }), [rows, from, to, buyerFilter, accountFilter, templateFilter, search]);

  const summary = useMemo(() => {
    const t = filtered.reduce((acc, r) => {
      acc.spend += Number(r.total_ad_spend) || 0;
      acc.leads += Number(r.total_leads) || 0;
      return acc;
    }, { spend: 0, leads: 0 });
    return { ...t, cpl: t.leads ? t.spend / t.leads : null, count: filtered.length };
  }, [filtered]);

  const reset = () => {
    setSearch(""); setFrom(""); setTo("");
    setBuyerFilter(""); setAccountFilter(""); setTemplateFilter("");
  };

  const onRowExport = async (id: string, action: any) => {
    const full = await loadFullReport(id);
    if (!full) { toast.error("Could not load report."); return; }
    if (action === "view") { setViewing(full); setViewingStatus(rows.find((r) => r.id === id)?.report_status || null); return; }
    if (action === "edit") { onEditReport(full); return; }
    await runExportAction(action, full);
  };

  const exportHistory = (action: string) => {
    const histRows = filtered.map((r) => ({
      created_at: r.created_at, report_date: r.report_date, report_name: r.report_name,
      media_buyer_count: (r._media_buyers || []).length,
      total_ad_spend: Number(r.total_ad_spend) || 0,
      total_leads: Number(r.total_leads) || 0,
      overall_cpl: r.overall_cpl == null ? null : Number(r.overall_cpl),
      metric_template_name: r._template_name || null,
    }));
    if (action === "csv" || action === "xlsx" || action === "sheets-download") {
      downloadFile(`daily-reports-history-${new Date().toISOString().slice(0,10)}.csv`, buildHistoryCsv(histRows), "text/csv");
    } else if (action === "sheets-copy") {
      copyToClipboard(buildHistoryTSV(histRows)).then((ok) => {
        if (ok) toast.success("History copied for Google Sheets.");
        else toast.error("Could not copy.");
      });
    } else if (action === "pdf") {
      // minimal PDF for filtered history
      import("jspdf").then(async ({ default: jsPDF }) => {
        const autoTableMod = await import("jspdf-autotable");
        const autoTable = (autoTableMod as any).default || (autoTableMod as any);
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        doc.setFontSize(18);
        doc.text("Daily Reports History", 40, 50);
        doc.setFontSize(10); doc.setTextColor(120);
        doc.text(`Filtered rows: ${histRows.length} · Generated ${new Date().toISOString()}`, 40, 70);
        doc.setTextColor(0);
        autoTable(doc, {
          startY: 90,
          head: [["Created", "Report Date", "Name", "Buyers", "Spend", "Leads", "CPL", "Template"]],
          body: histRows.map((r) => [
            new Date(r.created_at).toISOString().slice(0, 10),
            r.report_date, r.report_name, r.media_buyer_count,
            inr(r.total_ad_spend), fmtNum(r.total_leads), r.overall_cpl == null ? "—" : inr(r.overall_cpl), r.metric_template_name || "",
          ]),
          theme: "grid", styles: { fontSize: 8 },
          headStyles: { fillColor: [247, 246, 243], textColor: 0 },
        });
        doc.save(`daily-reports-history-${new Date().toISOString().slice(0,10)}.pdf`);
      });
    } else if (action === "whatsapp") {
      toast.message("WhatsApp copy is available for individual reports only.");
    }
  };

  const confirmDelete = async (id: string) => {
    if (!confirm("Move this daily report to Trash? It will be hidden from history and permanently deleted after 14 days unless restored.")) return;
    setDeletingId(id);
    try {
      await softDeleteReport(id);
      toast.success("Moved to Trash. Will auto-delete in 14 days.");
      setViewing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete report.");
    } finally { setDeletingId(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <div className="step-title">Daily Reports History</div>
          <div className="step-sub">Review saved daily lead reports, compare media buyers, export reports, or copy WhatsApp summaries.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#555" }}>
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Show deleted (Trash)
          </label>
          <button className="btn btn-k btn-sm" onClick={onNew}>+ New Daily Report</button>
          <button className="btn btn-g btn-sm" onClick={onShowAnalytics}>📊 Analytics</button>
          <ExportMenu label="Export History" onSelect={(a) => exportHistory(a)} includeWhatsapp={false} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="sum-row" style={{ marginBottom: 14 }}>
        <div className="sum-card plain"><div className="sum-lbl">Total Spend</div><div className="sum-val">{inr(summary.spend)}</div></div>
        <div className="sum-card plain"><div className="sum-lbl">Total Leads</div><div className="sum-val">{fmtNum(summary.leads)}</div></div>
        <div className="sum-card gold"><div className="sum-lbl">Overall CPL</div><div className="sum-val">{summary.cpl == null ? "—" : inr(summary.cpl)}</div></div>
        <div className="sum-card plain"><div className="sum-lbl">Reports</div><div className="sum-val">{summary.count}</div></div>
      </div>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14, padding: 12, background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 10 }}>
        <div><label className="fl-sm">From</label><input type="date" className="fi-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="fl-sm">To</label><input type="date" className="fi-sm" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <label className="fl-sm">Media Buyer</label>
          <select className="fi-sm" value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)}>
            <option value="">All</option>
            {allBuyers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Ad Account</label>
          <select className="fi-sm" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">All</option>
            {allAccounts.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Template</label>
          <select className="fi-sm" value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
            <option value="">All</option>
            {allTemplates.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-sm">Search</label>
          <input className="fi-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Report, buyer, account, notes…" />
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn btn-g btn-sm" onClick={reset}>Reset filters</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#888" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 10, padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>No daily reports match these filters</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Adjust filters or create a new daily report.</div>
          <button className="btn btn-k btn-sm" style={{ marginTop: 12 }} onClick={onNew}>+ New Daily Report</button>
        </div>
      ) : (
        <table className="attr-table">
          <thead>
            <tr>
              <th>Created On</th><th>Report Date</th><th>Client</th><th>Report Name</th>
              <th>Media Buyers</th><th>Total Spend</th><th>Total Leads</th><th>Overall CPL</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={r.is_deleted ? { opacity: 0.6 } : undefined}>
                <td style={{ fontSize: 11, color: "#888" }}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                <td>{fmtDateLong(r.report_date)}</td>
                <td style={{ fontSize: 12 }}>{r._client_name || <span style={{ color: "#bbb" }}>—</span>}</td>
                <td>
                  {r.report_name}
                  {r.report_status === "edited" && !r.is_deleted && (
                    <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB", textTransform: "uppercase", letterSpacing: ".08em" }}>edited</span>
                  )}
                  {r.is_deleted && (
                    <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", textTransform: "uppercase", letterSpacing: ".08em" }}>
                      deleted · {daysRemaining(r.deleted_at)}d left
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 11, color: "#888" }}>
                  {(r._media_buyers || []).slice(0, 2).map((m) => m.name).join(", ")}
                  {(r._media_buyers || []).length > 2 && ` +${(r._media_buyers || []).length - 2}`}
                </td>
                <td>{inr(Number(r.total_ad_spend))}</td>
                <td>{fmtNum(r.total_leads)}</td>
                <td>{r.overall_cpl ? inr(Number(r.overall_cpl)) : "—"}</td>
                <td>
                  {r.is_deleted ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-g btn-sm" onClick={async () => {
                        try { await restoreReport(r.id); toast.success("Report restored."); reload(); }
                        catch (e: any) { toast.error(e?.message || "Restore failed."); }
                      }}>↺ Restore</button>
                      <button className="btn btn-g btn-sm" style={{ color: "#DC2626" }} onClick={async () => {
                        if (!confirm("Permanently delete this report now? This cannot be undone.")) return;
                        try { await permanentlyDeleteReport(r.id); toast.success("Report permanently deleted."); reload(); }
                        catch (e: any) { toast.error(e?.message || "Delete failed."); }
                      }}>🗑 Forever</button>
                    </div>
                  ) : (
                    <RowActions
                      onView={() => onRowExport(r.id, "view")}
                      onEdit={() => onRowExport(r.id, "edit")}
                      onWhatsapp={() => onRowExport(r.id, "whatsapp")}
                      onExport={(a) => onRowExport(r.id, a)}
                      onDelete={() => confirmDelete(r.id)}
                      deleting={deletingId === r.id}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {viewing && (
        <DailyReportDrawer
          report={viewing}
          status={viewingStatus}
          onClose={() => setViewing(null)}
          onEdit={() => { const r = viewing; setViewing(null); onEditReport(r); }}
          onDelete={() => viewing.id && confirmDelete(viewing.id)}
        />
      )}
    </div>
  );
}

function RowActions({
  onView, onEdit, onWhatsapp, onExport, onDelete, deleting,
}: any) {
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setExportOpen(false); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={() => { setOpen(false); setExportOpen(false); onClick(); }}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 12px", background: "transparent", border: "none",
        fontFamily: "'Jost',sans-serif", fontSize: 12,
        color: danger ? "#DC2626" : "#0a0a0a", cursor: "pointer", borderRadius: 6,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "#FEF2F2" : "#FBF6E9")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{label}</button>
  );

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", gap: 4 }}>
      <button className="btn btn-g btn-sm" onClick={onView}>View</button>
      <button className="btn btn-g btn-sm" onClick={() => setOpen((o) => !o)} disabled={deleting}>⋯</button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          background: "#fff", border: "1px solid #E8E5DE", borderRadius: 10,
          minWidth: 200, zIndex: 50, padding: 4, boxShadow: "0 4px 12px rgba(0,0,0,.04)",
        }}>
          {item("✏️ Edit", onEdit)}
          {item("📋 Copy WhatsApp", onWhatsapp)}
          <button
            onClick={() => setExportOpen((o) => !o)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", background: "transparent", border: "none",
              fontFamily: "'Jost',sans-serif", fontSize: 12, color: "#0a0a0a",
              cursor: "pointer", borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FBF6E9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >📤 Export ▸</button>
          {exportOpen && (
            <div style={{ paddingLeft: 8, borderLeft: "2px solid #E8E5DE", margin: "0 8px" }}>
              {item("📁 CSV", () => onExport("csv"))}
              {item("📊 Excel (CSV)", () => onExport("xlsx"))}
              {item("📄 PDF", () => onExport("pdf"))}
              {item("📗 Sheets CSV", () => onExport("sheets-download"))}
              {item("📗 Copy for Sheets", () => onExport("sheets-copy"))}
            </div>
          )}
          {item("🗑 Delete", onDelete, true)}
        </div>
      )}
    </div>
  );
}
