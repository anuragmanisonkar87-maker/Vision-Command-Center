import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MarketizersAccessGuard } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState } from "@/components/marketizers/ui";
import { inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, totalsFor } from "@/utils/reports/marketizersReports";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports")({
  component: () => (
    <MarketizersAccessGuard>
      <ReportsRoute />
    </MarketizersAccessGuard>
  ),
});

function defaultMonth() { return new Date().toISOString().slice(0, 7); }

function ReportsRoute() {
  const location = useLocation();
  return location.pathname === "/brands/marketizers/revenue/reports" ? <ReportsHub /> : <Outlet />;
}

function ReportsHub() {
  const [month, setMonth] = useState(defaultMonth());
  const [t, setT] = useState<ReturnType<typeof totalsFor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Marketizers Reports | GWV Vision Center"; }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const b = await loadReportBundle(month);
      setT(totalsFor(b));
    } catch (e: any) { setError(e?.message ?? "Failed to load reports."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const handleExportSummary = () => {
    if (!t) return;
    exportToCSV(`marketizers-summary-${month}`, [{
      month, revenue: t.revenue, collected: t.collected, pending: t.pending,
      direct_expense: t.directExpense, team_salary: t.teamSalary, shared_expense: t.sharedTotal,
      total_expenses: t.totalExpenses, net_profit: t.netProfit, cash_profit: t.cashProfit,
      net_margin_pct: t.netMargin?.toFixed(2) ?? "", collection_pct: t.collectionPct?.toFixed(2) ?? "",
    }]);
  };

  const cards: { to: string; title: string; desc: string; preview: string }[] = t ? [
    { to: "/brands/marketizers/revenue/reports/pl", title: "P&L Report", desc: "Formal Marketizers Profit & Loss view.", preview: `Net Profit: ${formatINR(t.netProfit)}` },
    { to: "/brands/marketizers/revenue/reports/leaderboard", title: "Client Leaderboard", desc: "Best and worst clients by revenue, profit, margin, and pending.", preview: `Revenue: ${formatINR(t.revenue)}` },
    { to: "/brands/marketizers/revenue/reports/revenue-models", title: "Revenue Model Breakdown", desc: "Which pricing models are generating money?", preview: `Margin: ${formatPercent(t.netMargin)}` },
    { to: "/brands/marketizers/revenue/reports/expenses", title: "Expense Breakdown", desc: "Team salary, shared expenses, and direct client expenses.", preview: `Total Expenses: ${formatINR(t.totalExpenses)}` },
    { to: "/brands/marketizers/revenue/reports/growth", title: "Growth / Decline", desc: "Month-on-month client and brand growth trends.", preview: `Profit Growth: ${t.profitGrowth === null ? "—" : formatPercent(t.profitGrowth)}` },
    { to: "/brands/marketizers/revenue/collections", title: "Collections Report", desc: "Pending collections and follow-ups.", preview: `Pending: ${formatINR(t.pending)}` },
  ] : [];

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Reports & Financial Intelligence"
        subtitle="Analyze revenue, profit, expenses, growth, client health, and collections across Marketizers."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-sm" onClick={handleExportSummary} disabled={!t}>Export Summary CSV</button>
            <Link to="/brands/marketizers/revenue"><button className="btn-sm">← Dashboard</button></Link>
          </>
        }
      />
      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !t ? <LoadingState rows={4} /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            <MetricCard accent="gold" label="Revenue" value={formatINR(t.revenue)} delta={formatMonthLabel(month)} />
            <MetricCard accent="green" label="Net Profit" value={formatINR(t.netProfit)} delta={formatPercent(t.netMargin)} deltaTone={t.netProfit >= 0 ? "up" : "dn"} />
            <MetricCard accent="amber" label="Pending" value={formatINR(t.pending)} delta={formatPercent(t.pendingPct)} />
            <MetricCard accent="red" label="Total Expenses" value={formatINR(t.totalExpenses)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {cards.map((c) => (
              <div key={c.to} className="panel" style={{ padding: 22 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.6, marginBottom: 14 }}>{c.desc}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--ink2)", marginBottom: 16 }}>{c.preview}</div>
                <Link to={c.to as any}><button className="btn-sm btn-primary">Open Report →</button></Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
