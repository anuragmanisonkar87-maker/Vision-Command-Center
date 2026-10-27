import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState, EmptyState, ScrollableTable, HealthPill, inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, buildClientRows, type ClientReportRow } from "@/utils/reports/marketizersReports";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { getClientHealthStatus } from "@/utils/calculations/financeCalculations";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports/leaderboard")({
  component: () => (
    <MarketizersAccessGuard>
      <Leaderboard />
    </MarketizersAccessGuard>
  ),
});

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 8px", fontSize: 13, color: "var(--ink2)" };
const tdN: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };

type TabKey = "revenue" | "profit" | "margin" | "pending" | "growth-up" | "growth-dn" | "loss";

const TABS: { key: TabKey; label: string }[] = [
  { key: "revenue", label: "Highest Revenue" },
  { key: "profit", label: "Highest Profit" },
  { key: "margin", label: "Best Margin" },
  { key: "pending", label: "Highest Pending" },
  { key: "growth-up", label: "Biggest Growth" },
  { key: "growth-dn", label: "Biggest Decline" },
  { key: "loss", label: "Loss-Making" },
];

function Leaderboard() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [tab, setTab] = useState<TabKey>("revenue");
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Client Leaderboard | Marketizers"; }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try { setBundle(await loadReportBundle(month)); }
    catch (e: any) { setError(e?.message ?? "Failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const allRows = useMemo(() => bundle ? buildClientRows(bundle) : [], [bundle]);

  const rows = useMemo(() => allRows.filter((r) => {
    if (statusFilter !== "all" && (r.client.status || "") !== statusFilter) return false;
    if (modelFilter !== "all" && (r.entry.revenue_model || r.client.revenue_model || "") !== modelFilter) return false;
    return true;
  }), [allRows, statusFilter, modelFilter]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    switch (tab) {
      case "revenue": arr.sort((a, b) => b.entry.marketizers_revenue - a.entry.marketizers_revenue); break;
      case "profit": arr.sort((a, b) => b.netProfit - a.netProfit); break;
      case "margin": arr.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity)); break;
      case "pending": arr.sort((a, b) => b.entry.amount_pending - a.entry.amount_pending); break;
      case "growth-up": arr.sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity)); break;
      case "growth-dn": arr.sort((a, b) => (a.growth ?? Infinity) - (b.growth ?? Infinity)); break;
      case "loss": return arr.filter((r) => r.netProfit < 0).sort((a, b) => a.netProfit - b.netProfit);
    }
    return arr;
  }, [rows, tab]);

  const insights = useMemo(() => {
    if (!rows.length) return null;
    const best = [...rows].sort((a, b) => b.netProfit - a.netProfit)[0];
    const risky = [...rows].sort((a, b) => b.entry.amount_pending - a.entry.amount_pending)[0];
    const grow = [...rows].sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity))[0];
    const attn = [...rows].sort((a, b) => {
      const s = (r: ClientReportRow) => (r.netProfit < 0 ? 1000 : 0) + ((r.growth ?? 0) < -10 ? 200 : 0) + (r.entry.amount_pending > r.entry.marketizers_revenue * 0.3 ? 500 : 0);
      return s(b) - s(a);
    })[0];
    return { best, risky, grow, attn };
  }, [rows]);

  const handleExport = () => {
    exportToCSV(`marketizers-leaderboard-${tab}-${month}`, sortedRows.map((r, i) => ({
      rank: i + 1, client: r.client.client_name, niche: r.client.niche ?? "",
      revenue_model: r.entry.revenue_model || r.client.revenue_model || "",
      revenue: r.entry.marketizers_revenue, profit: r.netProfit,
      margin_pct: r.margin?.toFixed(2) ?? "", pending: r.entry.amount_pending,
      growth_pct: r.growth?.toFixed(2) ?? "", status: r.client.status,
    })));
  };

  const statuses = useMemo(() => Array.from(new Set((bundle?.clients ?? []).map((c) => c.status).filter(Boolean))), [bundle]);
  const models = useMemo(() => Array.from(new Set([...(bundle?.clients ?? []).map((c) => c.revenue_model), ...(bundle?.current ?? []).map((e) => e.revenue_model)].filter(Boolean) as string[])), [bundle]);

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Client Leaderboard"
        subtitle="Rank clients by revenue, profit, margin, growth, pending, and identify loss-makers."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <select style={{ ...inputStyle, width: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={{ ...inputStyle, width: 160 }} value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
              <option value="all">All models</option>
              {models.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-sm" onClick={handleExport} disabled={!sortedRows.length}>Export CSV</button>
            <Link to="/brands/marketizers/revenue/reports"><button className="btn-sm">← Reports</button></Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !bundle ? <LoadingState rows={6} /> : (
        <>
          {insights && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
              <MetricCard accent="green" label="Best Client" value={insights.best.client.client_name} delta={formatINR(insights.best.netProfit)} deltaTone="up" />
              <MetricCard accent="red" label="Most Risky" value={insights.risky.client.client_name} delta={`${formatINR(insights.risky.entry.amount_pending)} pending`} />
              <MetricCard accent="gold" label="Biggest Growth" value={insights.grow.client.client_name} delta={insights.grow.growth === null ? "—" : formatPercent(insights.grow.growth)} deltaTone="up" />
              <MetricCard accent="amber" label="Needs Attention" value={insights.attn.client.client_name} delta="Review margin & follow-ups" />
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {TABS.map((t) => (
              <button key={t.key} className="btn-sm" onClick={() => setTab(t.key)} style={{ whiteSpace: "nowrap", borderBottom: tab === t.key ? "2px solid var(--gold3)" : "2px solid transparent", borderRadius: 0, background: "transparent" }}>{t.label}</button>
            ))}
          </div>

          <div className="panel">
            <div className="ph"><div className="panel-title">{TABS.find((t) => t.key === tab)?.label}</div><div className="panel-sub">{formatMonthLabel(month)}</div></div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!sortedRows.length ? <div style={{ padding: 20 }}><EmptyState icon="🏁" title="No data" message="No clients match the current filters." /></div> : (
                <ScrollableTable minWidth={1000}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["#", "Client", "Niche", "Model", "Revenue", "Profit", "Margin", "Pending", "Growth", "Status"].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 3 && i < 9 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {sortedRows.map((r, i) => (
                        <tr key={r.entry.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}>{i + 1}</td>
                          <td style={td}><Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: r.client.id }} style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>{r.client.client_name}</Link></td>
                          <td style={td}>{r.client.niche ?? "—"}</td>
                          <td style={td}>{r.entry.revenue_model || r.client.revenue_model || "—"}</td>
                          <td style={tdN}>{formatINR(r.entry.marketizers_revenue)}</td>
                          <td style={tdN} className={r.netProfit >= 0 ? "num-pos" : "num-neg"}>{formatINR(r.netProfit)}</td>
                          <td style={tdN}>{formatPercent(r.margin)}</td>
                          <td style={tdN} className={r.entry.amount_pending > 0 ? "num-neg" : "num-neu"}>{formatINR(r.entry.amount_pending)}</td>
                          <td style={tdN} className={r.growth === null ? "num-neu" : r.growth >= 0 ? "num-pos" : "num-neg"}>{r.growth === null ? "—" : `${r.growth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(r.growth))}`}</td>
                          <td style={td}><HealthPill status={getClientHealthStatus(r.entry, r.prev)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
