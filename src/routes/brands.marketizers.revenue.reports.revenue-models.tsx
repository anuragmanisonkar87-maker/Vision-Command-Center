import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState, EmptyState, ScrollableTable, inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, buildClientRows } from "@/utils/reports/marketizersReports";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { calculateGrowthPercent, calculateProfitMargin, calculateCollectionPercent } from "@/utils/calculations/financeCalculations";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports/revenue-models")({
  component: () => (
    <MarketizersAccessGuard>
      <RevenueModels />
    </MarketizersAccessGuard>
  ),
});

const MODELS = ["Fixed Retainer", "Revenue Share", "Hybrid", "One-Time Setup", "Performance Bonus", "Other"];

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 8px", fontSize: 13, color: "var(--ink2)" };
const tdN: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };

function RevenueModels() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Revenue Models | Marketizers"; }, []);
  const load = async () => {
    setLoading(true); setError(null);
    try { setBundle(await loadReportBundle(month)); } catch (e: any) { setError(e?.message ?? "Failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const stats = useMemo(() => {
    if (!bundle) return [];
    const curr = buildClientRows(bundle);
    const prevByClient: Record<string, typeof bundle.previous[number]> = {};
    bundle.previous.forEach((p) => { prevByClient[p.client_id] = p; });
    const groups = new Map<string, typeof curr>();
    curr.forEach((r) => {
      const m = r.entry.revenue_model || r.client.revenue_model || "Other";
      const key = MODELS.includes(m) ? m : "Other";
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    });
    const out = Array.from(groups.entries()).map(([model, rows]) => {
      const revenue = rows.reduce((a, r) => a + Number(r.entry.marketizers_revenue || 0), 0);
      const collected = rows.reduce((a, r) => a + Number(r.entry.amount_collected || 0), 0);
      const pending = rows.reduce((a, r) => a + Number(r.entry.amount_pending || 0), 0);
      const profit = rows.reduce((a, r) => a + r.netProfit, 0);
      const prevRev = rows.reduce((a, r) => a + Number(prevByClient[r.client.id]?.marketizers_revenue || 0), 0);
      const margins = rows.map((r) => r.margin).filter((x): x is number => x !== null);
      const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
      return {
        model, count: rows.length, revenue, collected, pending, profit,
        avgMargin, avgCollection: calculateCollectionPercent(collected, revenue),
        growth: calculateGrowthPercent(revenue, prevRev),
        margin: calculateProfitMargin(profit, revenue),
      };
    }).sort((a, b) => b.revenue - a.revenue);
    return out;
  }, [bundle]);

  const totalRev = stats.reduce((a, b) => a + b.revenue, 0);

  const insights = useMemo(() => {
    if (!stats.length) return null;
    const profitable = [...stats].sort((a, b) => b.profit - a.profit)[0];
    const worstColl = [...stats].sort((a, b) => (a.avgCollection ?? 100) - (b.avgCollection ?? 100))[0];
    const grow = [...stats].sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity))[0];
    return { profitable, worstColl, grow };
  }, [stats]);

  const handleExport = () => exportToCSV(`marketizers-revenue-models-${month}`, stats.map((s) => ({
    model: s.model, clients: s.count, revenue: s.revenue, collected: s.collected, pending: s.pending,
    profit: s.profit, avg_margin_pct: s.avgMargin?.toFixed(2) ?? "", avg_collection_pct: s.avgCollection?.toFixed(2) ?? "",
    growth_pct: s.growth?.toFixed(2) ?? "",
  })));

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Revenue Model Breakdown"
        subtitle="Compare clients, revenue, profit, and growth across pricing models."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-sm" onClick={handleExport} disabled={!stats.length}>Export CSV</button>
            <Link to="/brands/marketizers/revenue/reports"><button className="btn-sm">← Reports</button></Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !bundle ? <LoadingState rows={6} /> : !stats.length ? (
        <EmptyState icon="📈" title="No data" message={`No revenue model data for ${formatMonthLabel(month)}.`} />
      ) : (
        <>
          {insights && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 22 }}>
              <MetricCard accent="green" label="Most Profitable Model" value={insights.profitable.model} delta={formatINR(insights.profitable.profit)} deltaTone="up" />
              <MetricCard accent="red" label="Worst Collection Model" value={insights.worstColl.model} delta={formatPercent(insights.worstColl.avgCollection)} />
              <MetricCard accent="gold" label="Highest Growth Model" value={insights.grow.model} delta={insights.grow.growth === null ? "—" : formatPercent(insights.grow.growth)} deltaTone="up" />
            </div>
          )}

          {/* Bar visualization */}
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Revenue Share</div></div>
            <div className="panel-body" style={{ display: "grid", gap: 10 }}>
              {stats.map((s) => {
                const pct = totalRev > 0 ? (s.revenue / totalRev) * 100 : 0;
                return (
                  <div key={s.model}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--ink2)" }}>{s.model}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--ink4)" }}>{formatINR(s.revenue)} · {pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 8, background: "var(--parchment2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--gold3)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="ph"><div className="panel-title">Model Performance</div><div className="panel-sub">{formatMonthLabel(month)}</div></div>
            <div className="panel-body" style={{ padding: 0 }}>
              <ScrollableTable minWidth={920}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Model", "Clients", "Revenue", "Collected", "Pending", "Profit", "Avg Margin", "Avg Collection", "Growth"].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 0 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.model} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                        <td style={td}>{s.model}</td>
                        <td style={tdN}>{s.count}</td>
                        <td style={tdN}>{formatINR(s.revenue)}</td>
                        <td style={tdN} className="num-pos">{formatINR(s.collected)}</td>
                        <td style={tdN} className={s.pending > 0 ? "num-neg" : "num-neu"}>{formatINR(s.pending)}</td>
                        <td style={tdN} className={s.profit >= 0 ? "num-pos" : "num-neg"}>{formatINR(s.profit)}</td>
                        <td style={tdN}>{formatPercent(s.avgMargin)}</td>
                        <td style={tdN}>{formatPercent(s.avgCollection)}</td>
                        <td style={tdN} className={s.growth === null ? "num-neu" : s.growth >= 0 ? "num-pos" : "num-neg"}>{s.growth === null ? "—" : `${s.growth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(s.growth))}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
