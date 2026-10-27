// @ts-nocheck
import { useMemo } from "react";
import { toast } from "sonner";
import {
  buildWhatsApp, calcCpl, calcMediaBuyerSpend, copyToClipboard,
  fmtDateLong, fmtNum, formatMetricValue, inr,
  type DailyReport,
} from "@/lib/mediaBuyer/helpers";
import ExportMenu from "./ExportMenu";
import { runExportAction } from "./sharedActions";

interface Props {
  report: DailyReport;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  status?: string | null;
}

export default function DailyReportDrawer({ report, onClose, onEdit, onDelete, status }: Props) {
  const totals = useMemo(() => {
    const t = report.media_buyers.reduce((acc, m) => {
      acc.spend += calcMediaBuyerSpend(m);
      acc.leads += m.total_leads || 0;
      return acc;
    }, { spend: 0, leads: 0 });
    return { ...t, cpl: calcCpl(t.spend, t.leads) };
  }, [report]);

  const wa = useMemo(() => buildWhatsApp(report), [report]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", width: "min(720px, 96vw)", height: "100vh", overflowY: "auto",
          borderLeft: "1px solid #E8E5DE", padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, lineHeight: 1.1 }}>
              Daily Lead Report — {fmtDateLong(report.report_date)}
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              {report.report_name}
              {status && (
                <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "#FBF6E9", border: "1px solid #E8D49A", color: "#7A5E10", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  {status}
                </span>
              )}
            </div>
          </div>
          <button className="mb-card-x" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <button className="btn btn-k btn-sm" onClick={onEdit}>✏️ Edit</button>
          <ExportMenu onSelect={(a) => runExportAction(a, report)} align="left" />
          <button className="btn btn-g btn-sm" onClick={async () => {
            const ok = await copyToClipboard(wa);
            if (ok) toast.success("WhatsApp report copied.");
            else toast.error("Could not copy automatically. Please select and copy the text below.");
          }}>📋 Copy WhatsApp</button>
          <button className="btn btn-g btn-sm" style={{ color: "#DC2626", borderColor: "#FECACA" }} onClick={onDelete}>🗑 Delete</button>
        </div>

        <div className="sum-row" style={{ marginBottom: 18 }}>
          <div className="sum-card plain"><div className="sum-lbl">Total Spend</div><div className="sum-val">{inr(totals.spend)}</div></div>
          <div className="sum-card plain"><div className="sum-lbl">Total Leads</div><div className="sum-val">{fmtNum(totals.leads)}</div></div>
          <div className="sum-card gold"><div className="sum-lbl">Overall CPL</div><div className="sum-val">{totals.cpl == null ? "—" : inr(totals.cpl)}</div></div>
          <div className="sum-card plain"><div className="sum-lbl">Media Buyers</div><div className="sum-val">{report.media_buyers.length}</div></div>
        </div>

        <SectionTitle>Media Buyer Breakdown</SectionTitle>
        <table className="attr-table" style={{ marginBottom: 20 }}>
          <thead>
            <tr><th>Media Buyer</th><th>Ad Accounts</th><th>Spend</th><th>Leads</th><th>CPL</th></tr>
          </thead>
          <tbody>
            {report.media_buyers.map((mb) => {
              const spend = calcMediaBuyerSpend(mb);
              const cpl = calcCpl(spend, mb.total_leads);
              const accs = mb.spend_mode === "combined"
                ? "(combined)"
                : mb.ad_accounts.map((a) => a.ad_account_name).filter(Boolean).join(", ") || "—";
              return (
                <tr key={mb.id}>
                  <td>{mb.media_buyer_name}</td>
                  <td>{accs}</td>
                  <td>{inr(spend)}</td>
                  <td>{fmtNum(mb.total_leads)}</td>
                  <td>{cpl == null ? "—" : inr(cpl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <SectionTitle>Ad Account Details</SectionTitle>
        <table className="attr-table" style={{ marginBottom: 20 }}>
          <thead>
            <tr>
              <th>Media Buyer</th><th>Ad Account</th><th>Spend</th>
              {report.metrics.filter((m) => m.exports !== false).map((m) => <th key={m.key}>{m.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.media_buyers.flatMap((mb) =>
              (mb.spend_mode === "combined"
                ? [{ id: "c", ad_account_name: "(combined)", ad_spend: Number(mb.combined_spend) || 0, metrics: mb.combined_metrics || {} }]
                : mb.ad_accounts
              ).map((a) => (
                <tr key={mb.id + ":" + a.id}>
                  <td>{mb.media_buyer_name}</td>
                  <td>{a.ad_account_name}</td>
                  <td>{inr(a.ad_spend)}</td>
                  {report.metrics.filter((m) => m.exports !== false).map((m) => (
                    <td key={m.key}>{formatMetricValue(m, a.metrics?.[m.key])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <SectionTitle>WhatsApp Message Preview</SectionTitle>
        <div style={{ marginBottom: 10 }}>
          <button className="btn btn-k btn-sm" onClick={async () => {
            const ok = await copyToClipboard(wa);
            if (ok) toast.success("WhatsApp report copied.");
            else toast.error("Could not copy automatically. Please select the text below and copy manually.");
          }}>📋 Copy Full WhatsApp Report</button>
        </div>
        <pre style={{
          background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 8,
          padding: 14, whiteSpace: "pre-wrap", fontFamily: "'Jost',sans-serif",
          fontSize: 12, lineHeight: 1.6, marginBottom: 20,
        }}>{wa}</pre>

        {report.notes && report.notes.trim() && (
          <>
            <SectionTitle>Notes</SectionTitle>
            <div style={{ background: "#F7F6F3", border: "1px solid #E8E5DE", borderRadius: 8, padding: 12, fontSize: 12, color: "#0a0a0a", whiteSpace: "pre-wrap" }}>
              {report.notes}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Jost',sans-serif", fontSize: 11, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: ".12em", color: "#888",
      marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #E8E5DE",
    }}>{children}</div>
  );
}
