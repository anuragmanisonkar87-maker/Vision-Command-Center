import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState, EmptyState, ScrollableTable, HealthPill, inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, totalsFor, buildClientRows, sumBy } from "@/utils/reports/marketizersReports";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { getClientHealthStatus } from "@/utils/calculations/financeCalculations";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports/pl")({
  component: () => (
    <MarketizersAccessGuard>
      <PLReport />
    </MarketizersAccessGuard>
  ),
});

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 8px", fontSize: 13, color: "var(--ink2)" };
const tdN: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };

function PLReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Marketizers P&L | GWV Vision Center"; }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try { setBundle(await loadReportBundle(month)); }
    catch (e: any) { setError(e?.message ?? "Failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const t = useMemo(() => bundle ? totalsFor(bundle) : null, [bundle]);
  const rows = useMemo(() => bundle ? buildClientRows(bundle) : [], [bundle]);
  const sharedByCat = useMemo(() => {
    const map: Record<string, number> = {};
    bundle?.sharedCurr.forEach((s) => { map[s.category] = (map[s.category] ?? 0) + Number(s.amount || 0); });
    return map;
  }, [bundle]);

  const handleExport = () => {
    if (!t) return;
    exportToCSV(`marketizers-pl-${month}`, [
      { line: "Client Revenue Earned", amount: t.revenue },
      { line: "Amount Collected", amount: t.collected },
      { line: "Pending Collection", amount: t.pending },
      { line: "Client Gross Revenue", amount: t.grossClient },
      { line: "Total Marketizers Revenue", amount: t.revenue },
      { line: "Direct Client Expenses", amount: t.directExpense },
      { line: "Team Salary Expenses", amount: t.teamSalary },
      { line: "Shared Expenses", amount: t.sharedTotal },
      { line: "Total Expenses", amount: t.totalExpenses },
      { line: "Net Profit", amount: t.netProfit },
      { line: "Cash Profit", amount: t.cashProfit },
      { line: "Net Margin %", amount: t.netMargin?.toFixed(2) ?? "" },
      { line: "Collection %", amount: t.collectionPct?.toFixed(2) ?? "" },
    ]);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Profit & Loss Report"
        subtitle="Formal Marketizers P&L for the selected month, with client contribution and prior-period comparison."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-sm" onClick={handleExport} disabled={!t}>Export CSV</button>
            <Link to="/brands/marketizers/revenue/reports"><button className="btn-sm">← Reports</button></Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !t || !bundle ? <LoadingState rows={6} /> : (
        <>
          {/* Profit summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
            <MetricCard accent="gold" label="Revenue" value={formatINR(t.revenue)} delta={t.revenueGrowth === null ? "—" : `${t.revenueGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(t.revenueGrowth))} vs prev`} deltaTone={t.revenueGrowth === null ? "na" : t.revenueGrowth >= 0 ? "up" : "dn"} />
            <MetricCard accent="red" label="Total Expenses" value={formatINR(t.totalExpenses)} delta={t.expenseGrowth === null ? "—" : `${t.expenseGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(t.expenseGrowth))} vs prev`} deltaTone={t.expenseGrowth === null ? "na" : t.expenseGrowth <= 0 ? "up" : "dn"} />
            <MetricCard accent={t.netProfit >= 0 ? "green" : "red"} label="Net Profit" value={formatINR(t.netProfit)} delta={`Margin ${formatPercent(t.netMargin)}`} deltaTone={t.netProfit >= 0 ? "up" : "dn"} />
            <MetricCard accent={t.cashProfit >= 0 ? "green" : "amber"} label="Cash Profit" value={formatINR(t.cashProfit)} delta={`Collection ${formatPercent(t.collectionPct)}`} />
          </div>

          {/* Sections A/B/C */}
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Revenue</div><div className="panel-sub">For {formatMonthLabel(month)}</div></div>
            <div className="panel-body">
              <PLRow label="Client Revenue Earned" amount={t.revenue} />
              <PLRow label="Amount Collected" amount={t.collected} tone="pos" />
              <PLRow label="Pending Collection" amount={t.pending} tone={t.pending > 0 ? "neg" : "neu"} />
              <PLRow label="Client Gross Revenue Generated" amount={t.grossClient} muted />
              <PLRow label="Total Marketizers Revenue" amount={t.revenue} bold />
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Expenses</div><div className="panel-sub">All Marketizers expense categories</div></div>
            <div className="panel-body">
              <PLRow label="Direct Client Expenses" amount={t.directExpense} />
              <PLRow label="Team Salary Expenses" amount={t.teamSalary} />
              <PLRow label="Shared Expenses" amount={t.sharedTotal} />
              {Object.entries(sharedByCat).map(([k, v]) => <PLRow key={k} label={`— ${k}`} amount={v} muted />)}
              <PLRow label="Total Expenses" amount={t.totalExpenses} bold tone="neg" />
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Profit Summary</div></div>
            <div className="panel-body">
              <PLRow label="Net Profit (Revenue − Expenses)" amount={t.netProfit} bold tone={t.netProfit >= 0 ? "pos" : "neg"} />
              <PLRow label="Cash Profit (Collected − Expenses)" amount={t.cashProfit} bold tone={t.cashProfit >= 0 ? "pos" : "neg"} />
              <PLRow label="Net Margin %" amount={t.netMargin} percent />
              <PLRow label="Collection %" amount={t.collectionPct} percent />
              <PLRow label="Pending %" amount={t.pendingPct} percent />
            </div>
          </div>

          {/* Client Contribution */}
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Client Contribution</div></div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!rows.length ? <div style={{ padding: 20 }}><EmptyState icon="📊" title="No entries" message={`No client entries for ${formatMonthLabel(month)}.`} /></div> : (
                <ScrollableTable minWidth={920}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Client", "Revenue", "Collected", "Pending", "Direct Expense", "Net Profit", "Margin", "Status"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 ? "left" : "right" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.entry.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}><Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: r.client.id }} style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>{r.client.client_name}</Link></td>
                          <td style={tdN}>{formatINR(r.entry.marketizers_revenue)}</td>
                          <td style={tdN} className="num-pos">{formatINR(r.entry.amount_collected)}</td>
                          <td style={tdN} className={r.entry.amount_pending > 0 ? "num-neg" : "num-neu"}>{formatINR(r.entry.amount_pending)}</td>
                          <td style={tdN}>{formatINR(r.entry.total_direct_expense)}</td>
                          <td style={tdN} className={r.netProfit >= 0 ? "num-pos" : "num-neg"}>{formatINR(r.netProfit)}</td>
                          <td style={tdN}>{formatPercent(r.margin)}</td>
                          <td style={{ ...tdN, textAlign: "right" }}><HealthPill status={getClientHealthStatus(r.entry, r.prev)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          {/* Comparison */}
          <div className="panel">
            <div className="ph"><div className="panel-title">Comparison vs Previous Period</div></div>
            <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <CompareCard label="Revenue Growth" pct={t.revenueGrowth} positiveIsGood />
              <CompareCard label="Profit Growth" pct={t.profitGrowth} positiveIsGood />
              <CompareCard label="Expense Growth" pct={t.expenseGrowth} positiveIsGood={false} />
              <CompareCard label="Pending Growth" pct={t.pendingGrowth} positiveIsGood={false} />
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 8, fontFamily: "'DM Mono',monospace" }}>
            Direct totals: {formatINR(sumBy(bundle.current, (e) => e.total_direct_expense))}
          </div>
        </>
      )}
    </div>
  );
}

function PLRow({ label, amount, bold, muted, tone, percent }: { label: string; amount: number | null; bold?: boolean; muted?: boolean; tone?: "pos" | "neg" | "neu"; percent?: boolean }) {
  const toneClass = tone === "pos" ? "num-pos" : tone === "neg" ? "num-neg" : "";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--parchment2)", fontSize: 13, color: muted ? "var(--ink4)" : "var(--ink2)", fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span>
      <span className={toneClass} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5 }}>
        {percent ? formatPercent(amount) : formatINR(amount)}
      </span>
    </div>
  );
}

function CompareCard({ label, pct, positiveIsGood }: { label: string; pct: number | null; positiveIsGood: boolean }) {
  const tone: "up" | "dn" | "na" = pct === null ? "na" : (pct >= 0 ? (positiveIsGood ? "up" : "dn") : (positiveIsGood ? "dn" : "up"));
  return <MetricCard accent={tone === "up" ? "green" : tone === "dn" ? "red" : "amber"} label={label} value={pct === null ? "—" : `${pct >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(pct))}`} deltaTone={tone} />;
}
