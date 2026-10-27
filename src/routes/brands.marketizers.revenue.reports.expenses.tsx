import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard, canEditMarketizersFinance } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, ErrorBanner, LoadingState, EmptyState, ScrollableTable, inputStyle } from "@/components/marketizers/ui";
import { loadReportBundle, sumBy } from "@/utils/reports/marketizersReports";
import { softDeleteSharedExpense, softDeleteTeamSalaryExpense } from "@/services/marketizers/expensesService";
import { formatINR, formatPercent, formatMonthLabel } from "@/utils/formatters/format";
import { calculateGrowthPercent } from "@/utils/calculations/financeCalculations";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/reports/expenses")({
  component: () => (
    <MarketizersAccessGuard>
      <ExpenseBreakdown />
    </MarketizersAccessGuard>
  ),
});

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 8px", fontSize: 13, color: "var(--ink2)" };
const tdN: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };

function ExpenseBreakdown() {
  const canEdit = canEditMarketizersFinance();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Expense Breakdown | Marketizers"; }, []);
  const load = async () => {
    setLoading(true); setError(null);
    try { setBundle(await loadReportBundle(month)); } catch (e: any) { setError(e?.message ?? "Failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [month]);

  const totals = useMemo(() => {
    if (!bundle) return null;
    const direct = sumBy(bundle.current, (e) => e.total_direct_expense);
    const sal = sumBy(bundle.salariesCurr, (s) => s.salary_amount);
    const sharedTotal = sumBy(bundle.sharedCurr, (s) => s.amount);
    const prevDirect = sumBy(bundle.previous, (e) => e.total_direct_expense);
    const prevSal = sumBy(bundle.salariesPrev, (s) => s.salary_amount);
    const prevShared = sumBy(bundle.sharedPrev, (s) => s.amount);
    return { direct, sal, sharedTotal, total: direct + sal + sharedTotal, prevDirect, prevSal, prevShared, prevTotal: prevDirect + prevSal + prevShared };
  }, [bundle]);

  const categories = useMemo(() => {
    if (!bundle || !totals) return [];
    const map: Record<string, { curr: number; prev: number }> = {
      "Direct Client Expenses": { curr: totals.direct, prev: totals.prevDirect },
      "Team Salaries": { curr: totals.sal, prev: totals.prevSal },
    };
    bundle.sharedCurr.forEach((s) => { map[s.category] = map[s.category] ?? { curr: 0, prev: 0 }; map[s.category].curr += Number(s.amount || 0); });
    bundle.sharedPrev.forEach((s) => { map[s.category] = map[s.category] ?? { curr: 0, prev: 0 }; map[s.category].prev += Number(s.amount || 0); });
    const arr = Object.entries(map).map(([cat, v]) => ({
      cat, amount: v.curr, prev: v.prev,
      pct: totals.total > 0 ? (v.curr / totals.total) * 100 : 0,
      growth: calculateGrowthPercent(v.curr, v.prev),
    })).sort((a, b) => b.amount - a.amount);
    return arr;
  }, [bundle, totals]);

  const handleDelSal = async (id: string) => {
    if (!confirm("Soft-delete this salary record?")) return;
    try { await softDeleteTeamSalaryExpense(id); load(); } catch (e: any) { alert(e?.message ?? "Failed."); }
  };
  const handleDelShared = async (id: string) => {
    if (!confirm("Soft-delete this expense?")) return;
    try { await softDeleteSharedExpense(id); load(); } catch (e: any) { alert(e?.message ?? "Failed."); }
  };

  const handleExport = () => {
    if (!bundle || !totals) return;
    const rows = [
      ...categories.map((c) => ({ section: "Category", name: c.cat, amount: c.amount, pct_of_total: c.pct.toFixed(2), growth_pct: c.growth?.toFixed(2) ?? "" })),
      ...bundle.salariesCurr.map((s) => ({ section: "Salary", name: s.team_member_name, amount: s.salary_amount, role: s.role ?? "", status: s.payment_status })),
      ...bundle.sharedCurr.map((s) => ({ section: "Shared", name: s.category, amount: s.amount, description: s.description ?? "", paid_by: s.paid_by ?? "" })),
    ];
    exportToCSV(`marketizers-expense-breakdown-${month}`, rows);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Reporting"
        title="Expense Breakdown"
        subtitle="See where Marketizers money is going across direct, team, and shared expense categories."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-sm" onClick={handleExport} disabled={!bundle}>Export CSV</button>
            <Link to="/brands/marketizers/revenue/reports"><button className="btn-sm">← Reports</button></Link>
          </>
        }
      />
      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading || !bundle || !totals ? <LoadingState rows={6} /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
            <MetricCard accent="red" label="Total Expenses" value={formatINR(totals.total)} delta={formatMonthLabel(month)} />
            <MetricCard accent="amber" label="Direct Client" value={formatINR(totals.direct)} />
            <MetricCard accent="gold" label="Team Salaries" value={formatINR(totals.sal)} />
            <MetricCard accent="amber" label="Shared" value={formatINR(totals.sharedTotal)} />
          </div>

          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><div className="panel-title">Category Breakdown</div></div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!categories.length ? <div style={{ padding: 20 }}><EmptyState icon="💸" title="No expenses" message={`No expenses for ${formatMonthLabel(month)}.`} /></div> : (
                <ScrollableTable minWidth={720}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Category", "Amount", "% of Total", "vs Previous", "Trend"].map((h, i) => <th key={h} style={{ ...th, textAlign: i > 0 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.cat} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}>{c.cat}</td>
                          <td style={tdN}>{formatINR(c.amount)}</td>
                          <td style={tdN}>{formatPercent(c.pct)}</td>
                          <td style={tdN}>{formatINR(c.prev)}</td>
                          <td style={tdN} className={c.growth === null ? "num-neu" : c.growth <= 0 ? "num-pos" : "num-neg"}>{c.growth === null ? "—" : `${c.growth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(c.growth))}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="ph" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="panel-title">Team Salaries</div><div className="panel-sub">{bundle.salariesCurr.length} entries</div></div>
              <Link to="/brands/marketizers/revenue/expenses"><button className="btn-sm">Manage →</button></Link>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!bundle.salariesCurr.length ? <div style={{ padding: 20 }}><EmptyState icon="👥" title="No salary entries" message="No team salaries recorded." /></div> : (
                <ScrollableTable minWidth={760}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Member", "Role", "Month", "Amount", "Status", "Notes", "Actions"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {bundle.salariesCurr.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}>{s.team_member_name}</td>
                          <td style={td}>{s.role ?? "—"}</td>
                          <td style={td}>{s.month}</td>
                          <td style={tdN}>{formatINR(s.salary_amount)}</td>
                          <td style={td}>{s.payment_status}</td>
                          <td style={td}>{s.notes ?? "—"}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <Link to="/brands/marketizers/revenue/expenses"><button className="btn-sm" style={{ marginRight: 4 }}>Edit</button></Link>
                            {canEdit && <button className="btn-sm" onClick={() => handleDelSal(s.id)}>Delete</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="ph" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="panel-title">Shared Expenses</div><div className="panel-sub">{bundle.sharedCurr.length} entries</div></div>
              <Link to="/brands/marketizers/revenue/expenses"><button className="btn-sm">Manage →</button></Link>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {!bundle.sharedCurr.length ? <div style={{ padding: 20 }}><EmptyState icon="💼" title="No shared expenses" message="No shared expenses recorded." /></div> : (
                <ScrollableTable minWidth={760}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Category", "Amount", "Date", "Description", "Paid By", "Actions"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 1 ? "right" : "left" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {bundle.sharedCurr.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                          <td style={td}>{s.category}</td>
                          <td style={tdN}>{formatINR(s.amount)}</td>
                          <td style={td}>{s.expense_date ?? "—"}</td>
                          <td style={td}>{s.description ?? "—"}</td>
                          <td style={td}>{s.paid_by ?? "—"}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <Link to="/brands/marketizers/revenue/expenses"><button className="btn-sm" style={{ marginRight: 4 }}>Edit</button></Link>
                            {canEdit && <button className="btn-sm" onClick={() => handleDelShared(s.id)}>Delete</button>}
                          </td>
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
