import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState, EmptyState, ScrollableTable, inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, loadTrendBundle, lastNMonths, sumBy } from "@/utils/reports/marketizersReports";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { calculateGrowthPercent, calculateNetProfit } from "@/utils/calculations/financeCalculations";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import type { Client } from "@/types/marketizers";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports/growth")({
  component: () => (
    <MarketizersAccessGuard>
      <GrowthReport />
    </MarketizersAccessGuard>
  ),
});

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 8px", fontSize: 13, color: "var(--ink2)" };
const tdN: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };

function GrowthReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [trend, setTrend] = useState<Awaited<ReturnType<typeof loadTrendBundle>> | null>(null);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Growth Report | Marketizers"; }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const months = lastNMonths(month, 6);
      const [t, b, c] = await Promise.all([loadTrendBundle(months), loadReportBundle(month), getMarketizersClients()]);
      setTrend(t); setBundle(b); setClients(c);
    } catch (e: any) { setError(e?.message ?? "Failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const trendRows = useMemo(() => {
    if (!trend) return [];
    return lastNMonths(month, 6).map((m) => {
      const ent = trend.entries.filter((e) => e.month === m);
      const sal = trend.salaries.filter((s) => s.month === m);
      const she = trend.shared.filter((s) => s.month === m);
      const revenue = sumBy(ent, (e) => e.marketizers_revenue);
      const direct = sumBy(ent, (e) => e.total_direct_expense);
      const expenses = direct + sumBy(sal, (s) => s.salary_amount) + sumBy(she, (s) => s.amount);
      return {
        month: m, revenue, expenses,
        profit: revenue - expenses,
        pending: sumBy(ent, (e) => e.amount_pending),
      };
    });
  }, [trend, month]);

  const trendMax = Math.max(1, ...trendRows.flatMap((t) => [t.revenue, Math.max(0, t.profit)]));

  const clientRows = useMemo(() => {
    if (!bundle) return [];
    const cMap = Object.fromEntries(clients.map((c) => [c.id, c]));
    const prevMap = Object.fromEntries(bundle.previous.map((e) => [e.client_id, e]));
    return bundle.current.map((e) => {
      const prev = prevMap[e.client_id];
      const curProfit = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
      const prevProfit = prev ? calculateNetProfit(prev.marketizers_revenue, prev.total_direct_expense) : 0;
      return {
        client: cMap[e.client_id] as Client,
        currRev: Number(e.marketizers_revenue || 0),
        prevRev: Number(prev?.marketizers_revenue || 0),
        revGrowth: prev ? calculateGrowthPercent(e.marketizers_revenue, prev.marketizers_revenue) : null,
        currProfit: curProfit,
        prevProfit,
        profitGrowth: prev ? calculateGrowthPercent(curProfit, prevProfit) : null,
      };
    }).filter((r) => r.client);
  }, [bundle, clients]);

  const insights = useMemo(() => {
    if (!clientRows.length) return null;
    const fastest = [...clientRows].sort((a, b) => (b.revGrowth ?? -Infinity) - (a.revGrowth ?? -Infinity))[0];
    const declining = [...clientRows].sort((a, b) => (a.revGrowth ?? Infinity) - (b.revGrowth ?? Infinity))[0];
    const profUp = [...clientRows].sort((a, b) => (b.profitGrowth ?? -Infinity) - (a.profitGrowth ?? -Infinity))[0];
    const profDn = [...clientRows].sort((a, b) => (a.profitGrowth ?? Infinity) - (b.profitGrowth ?? Infinity))[0];
    const newClients = clientRows.filter((r) => r.prevRev === 0 && r.currRev > 0);
    const inactive = clients.filter((c) => c.status === "paused" || c.status === "closed");
    const decisions: string[] = [];
    clientRows.forEach((r) => {
      if (r.currRev > 0 && (bundle?.current.find((e) => e.client_id === r.client.id)?.amount_pending ?? 0) > r.currRev * 0.3) {
        decisions.push(`${r.client.client_name} has high revenue but pending collection is above 30%. Follow-up should be prioritized.`);
      }
      if (r.currProfit < 0) decisions.push(`${r.client.client_name} is loss-making this month. Review service cost or pricing.`);
      if (r.revGrowth !== null && r.revGrowth < -20) decisions.push(`${r.client.client_name} revenue dropped over 20% vs last month. Check delivery and engagement.`);
    });
    return { fastest, declining, profUp, profDn, newClients, inactive, decisions: decisions.slice(0, 8) };
  }, [clientRows, bundle, clients]);

  const handleExport = () => {
    exportToCSV(`marketizers-growth-${month}`, clientRows.map((r) => ({
      client: r.client.client_name, current_revenue: r.currRev, previous_revenue: r.prevRev,
      revenue_growth_pct: r.revGrowth?.toFixed(2) ?? "", current_profit: r.currProfit,
      previous_profit: r.prevProfit, profit_growth_pct: r.profitGrowth?.toFixed(2) ?? "",
      status: r.client.status,
    })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Growth & Decline Report"
        subtitle="Track 6-month trend and compare clients month-on-month."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-sm" onClick={handleExport} disabled={!clientRows.length}>Export CSV</button>
            <Link to="/brands/marketizers/revenue/reports"><button className="btn-sm">← Reports</button></Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !bundle ? <LoadingState rows={6} /> : (
        <>
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">6-Month Trend</div></div>
            <div className="panel-body">
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${trendRows.length},1fr)`, gap: 12, alignItems: "end", height: 180 }}>
                {trendRows.map((t) => {
                  const rH = (t.revenue / trendMax) * 100;
                  const pH = (Math.max(0, t.profit) / trendMax) * 100;
                  return (
                    <div key={t.month} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "end", height: 140 }}>
                        <div title={`Revenue ${formatINR(t.revenue)}`} style={{ width: 14, height: `${rH}%`, background: "var(--gold3)", borderRadius: 2 }} />
                        <div title={`Profit ${formatINR(t.profit)}`} style={{ width: 14, height: `${pH}%`, background: t.profit >= 0 ? "var(--green)" : "var(--red)", borderRadius: 2 }} />
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: "var(--ink4)", marginTop: 6 }}>{formatMonthLabel(t.month).split(" ")[0].slice(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--ink4)", marginTop: 12 }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--gold3)", marginRight: 6, verticalAlign: "middle" }} />Revenue</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--green)", marginRight: 6, verticalAlign: "middle" }} />Profit</span>
              </div>
              <ScrollableTable minWidth={620}>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
                  <thead><tr>{["Month", "Revenue", "Expenses", "Net Profit", "Pending"].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 0 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {trendRows.map((t) => (
                      <tr key={t.month} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                        <td style={td}>{formatMonthLabel(t.month)}</td>
                        <td style={tdN}>{formatINR(t.revenue)}</td>
                        <td style={tdN}>{formatINR(t.expenses)}</td>
                        <td style={tdN} className={t.profit >= 0 ? "num-pos" : "num-neg"}>{formatINR(t.profit)}</td>
                        <td style={tdN}>{formatINR(t.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>

          {insights && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 22 }}>
              <MetricCard accent="green" label="Fastest Growing" value={insights.fastest.client.client_name} delta={insights.fastest.revGrowth === null ? "—" : formatPercent(insights.fastest.revGrowth)} deltaTone="up" />
              <MetricCard accent="red" label="Biggest Decline" value={insights.declining.client.client_name} delta={insights.declining.revGrowth === null ? "—" : formatPercent(insights.declining.revGrowth)} deltaTone="dn" />
              <MetricCard accent="gold" label="Profit Improved Most" value={insights.profUp.client.client_name} delta={insights.profUp.profitGrowth === null ? "—" : formatPercent(insights.profUp.profitGrowth)} deltaTone="up" />
              <MetricCard accent="amber" label="Profit Dropped Most" value={insights.profDn.client.client_name} delta={insights.profDn.profitGrowth === null ? "—" : formatPercent(insights.profDn.profitGrowth)} deltaTone="dn" />
              <MetricCard accent="green" label="New Clients" value={String(insights.newClients.length)} delta={insights.newClients.map((r) => r.client.client_name).join(", ") || "—"} />
              <MetricCard accent="amber" label="Paused / Closed" value={String(insights.inactive.length)} delta={insights.inactive.map((c) => c.client_name).slice(0, 3).join(", ") || "—"} />
            </div>
          )}

          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Client Growth</div></div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!clientRows.length ? <div style={{ padding: 20 }}><EmptyState icon="📈" title="No data" message="No client comparison available." /></div> : (
                <ScrollableTable minWidth={920}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Client", "Curr Revenue", "Prev Revenue", "Rev Growth", "Curr Profit", "Prev Profit", "Profit Growth", "Status"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 || i === 7 ? "left" : "right" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {clientRows.map((r) => (
                        <tr key={r.client.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}><Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: r.client.id }} style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>{r.client.client_name}</Link></td>
                          <td style={tdN}>{formatINR(r.currRev)}</td>
                          <td style={tdN}>{formatINR(r.prevRev)}</td>
                          <td style={tdN} className={r.revGrowth === null ? "num-neu" : r.revGrowth >= 0 ? "num-pos" : "num-neg"}>{r.revGrowth === null ? "—" : `${r.revGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(r.revGrowth))}`}</td>
                          <td style={tdN} className={r.currProfit >= 0 ? "num-pos" : "num-neg"}>{formatINR(r.currProfit)}</td>
                          <td style={tdN}>{formatINR(r.prevProfit)}</td>
                          <td style={tdN} className={r.profitGrowth === null ? "num-neu" : r.profitGrowth >= 0 ? "num-pos" : "num-neg"}>{r.profitGrowth === null ? "—" : `${r.profitGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(r.profitGrowth))}`}</td>
                          <td style={td}>{r.client.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          {insights?.decisions && insights.decisions.length > 0 && (
            <div className="panel">
              <div className="ph"><div className="panel-title">Founder Decision Notes</div><div className="panel-sub">Rule-based insights from this month's data</div></div>
              <div className="panel-body" style={{ display: "grid", gap: 8 }}>
                {insights.decisions.map((d, i) => (
                  <div key={i} style={{ padding: "11px 14px", background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--ink2)", lineHeight: 1.5 }}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
