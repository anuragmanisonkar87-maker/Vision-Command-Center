import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard, canEditMarketizersFinance, isAdmin } from "@/components/marketizers/MarketizersAccessGuard";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import { getMarketizersRecentMonthlyEntries, softDeleteMarketizersMonthlyEntry } from "@/services/marketizers/monthlyEntriesService";
import { getMarketizersExpenseSummary } from "@/services/marketizers/expensesService";
import {
  PageHeader, MetricCard, HealthPill, EmptyState, ErrorBanner, SkeletonRow, ScrollableTable,
} from "@/components/marketizers/ui";
import { cached, invalidateCache } from "@/lib/cacheTtl";

// Lazy: ~700-line drawer with dozens of fields. Only parsed when the user
// actually clicks "+ Add Client".
const AddClientDrawer = lazy(() =>
  import("@/components/marketizers/AddClientDrawer").then((m) => ({ default: m.AddClientDrawer })),
);
import {
  type Client, type MonthlyEntry,
  calculateNetProfit, calculateProfitMargin, calculateCollectionPercent, calculatePendingPercent,
  calculateGrowthPercent, getClientHealthStatus, formatINR, formatPercent, previousMonth,
  exportToCSV,
} from "@/lib/marketizersFinanceUtils";

export const Route = createFileRoute("/brands/marketizers/revenue")({
  loader: () => {
    // Warm the cache during hover/intent preload. Fire-and-forget.
    void cached("mz:clients", () => getMarketizersClients());
    void cached("mz:entries:300", () => getMarketizersRecentMonthlyEntries(300));
  },
  component: () => (
    <MarketizersAccessGuard>
      <MarketizersRevenueRoute />
    </MarketizersAccessGuard>
  ),
});

const BRAND_BLUE = "#6090E0";

function MarketizersRevenueRoute() {
  const location = useLocation();
  return location.pathname === "/brands/marketizers/revenue" ? <MarketizersRevenueDashboard /> : <Outlet />;
}

function MarketizersRevenueDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [entries, setEntries] = useState<MonthlyEntry[]>([]);
  const [month, setMonth] = useState<string>("2025-05");
  const [expSummary, setExpSummary] = useState<{ teamSalary: number; sharedTotal: number }>({ teamSalary: 0, sharedTotal: 0 });
  const [addClientOpen, setAddClientOpen] = useState(false);

  useEffect(() => { document.title = "Marketizers Revenue | GWV Vision Center"; }, []);

  const load = async (force = false) => {
    setLoading(true); setError(null);
    try {
      if (force) invalidateCache("mz:");
      const [c, e] = await Promise.all([
        cached("mz:clients", () => getMarketizersClients()),
        cached("mz:entries:300", () => getMarketizersRecentMonthlyEntries(300)),
      ]);
      setClients(c);
      setEntries(e);
      const months = Array.from(new Set(e.map((r: MonthlyEntry) => r.month))).sort();
      if (months.length) setMonth(months[months.length - 1]);
    } catch (err: any) {
      setError(err?.message ?? "Could not load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    getMarketizersExpenseSummary(month)
      .then((r) => setExpSummary({ teamSalary: r.teamSalary, sharedTotal: r.sharedTotal }))
      .catch(() => setExpSummary({ teamSalary: 0, sharedTotal: 0 }));
  }, [month]);

  const allMonths = useMemo(
    () => Array.from(new Set(entries.map((e) => e.month))).sort().reverse(),
    [entries],
  );

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const currentEntries = useMemo(() => entries.filter((e) => e.month === month), [entries, month]);
  const prevMonthStr = previousMonth(month);
  const prevEntries = useMemo(() => entries.filter((e) => e.month === prevMonthStr), [entries, prevMonthStr]);

  const totals = useMemo(() => {
    const sum = (arr: MonthlyEntry[], k: keyof MonthlyEntry) =>
      arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);
    const revenue = sum(currentEntries, "marketizers_revenue");
    const collected = sum(currentEntries, "amount_collected");
    const pending = sum(currentEntries, "amount_pending");
    const directExpense = sum(currentEntries, "total_direct_expense");
    const totalExpense = directExpense + expSummary.teamSalary + expSummary.sharedTotal;
    const netProfit = revenue - totalExpense;

    const prevRevenue = sum(prevEntries, "marketizers_revenue");
    const prevCollected = sum(prevEntries, "amount_collected");
    const prevPending = sum(prevEntries, "amount_pending");
    const prevNetProfit = prevRevenue - sum(prevEntries, "total_direct_expense");

    return {
      revenue, collected, pending, netProfit, directExpense, totalExpense,
      revenueGrowth: calculateGrowthPercent(revenue, prevRevenue),
      collectedGrowth: calculateGrowthPercent(collected, prevCollected),
      pendingGrowth: calculateGrowthPercent(pending, prevPending),
      profitGrowth: calculateGrowthPercent(netProfit, prevNetProfit),
    };
  }, [currentEntries, prevEntries, expSummary]);

  const rows = useMemo(() => {
    const prevByClient = Object.fromEntries(prevEntries.map((e) => [e.client_id, e]));
    return currentEntries
      .map((e) => {
        const prev = (prevByClient[e.client_id] as MonthlyEntry | undefined) ?? null;
        const netProfit = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
        const margin = calculateProfitMargin(netProfit, e.marketizers_revenue);
        const growth = prev ? calculateGrowthPercent(e.marketizers_revenue, prev.marketizers_revenue) : null;
        return {
          entry: e,
          client: clientMap[e.client_id],
          netProfit, margin, growth,
          health: getClientHealthStatus(e, prev),
          pendingPct: calculatePendingPercent(e.amount_pending, e.marketizers_revenue) ?? 0,
        };
      })
      .filter((r) => r.client)
      .sort((a, b) => b.entry.marketizers_revenue - a.entry.marketizers_revenue);
  }, [currentEntries, prevEntries, clientMap]);

  const trendMonths = useMemo(() => {
    const all = Array.from(new Set(entries.map((e) => e.month))).sort();
    return all.slice(-3);
  }, [entries]);

  const trend = trendMonths.map((m) => {
    const ms = entries.filter((e) => e.month === m);
    const rev = ms.reduce((a, b) => a + Number(b.marketizers_revenue), 0);
    const exp = ms.reduce((a, b) => a + Number(b.total_direct_expense), 0);
    return { month: m, revenue: rev, profit: rev - exp };
  });
  const trendMax = Math.max(1, ...trend.flatMap((t) => [t.revenue, Math.max(0, t.profit)]));

  const best = useMemo(() => {
    if (!rows.length) return null;
    return {
      highestRev: [...rows].sort((a, b) => b.entry.marketizers_revenue - a.entry.marketizers_revenue)[0],
      bestMargin: [...rows].filter((r) => r.margin !== null).sort((a, b) => (b.margin! - a.margin!))[0],
      attention:
        [...rows].sort((a, b) => {
          const score = (r: typeof rows[number]) =>
            (r.netProfit < 0 ? 1000 : 0) +
            (r.pendingPct > 30 ? 500 : 0) +
            ((r.growth ?? 0) < -10 ? 200 : 0);
          return score(b) - score(a);
        })[0],
    };
  }, [rows]);

  const canEdit = canEditMarketizersFinance();

  const admin = isAdmin();

  const handleExport = () => {
    exportToCSV(`marketizers-revenue-${month}`, rows.map((r) => ({
      client: r.client.client_name,
      niche: r.client.niche ?? "",
      revenue: r.entry.marketizers_revenue,
      collected: r.entry.amount_collected,
      pending: r.entry.amount_pending,
      net_profit: r.netProfit,
      margin_pct: r.margin?.toFixed(2) ?? "",
      growth_pct: r.growth?.toFixed(2) ?? "",
      health: r.health,
    })));
  };

  const handleExportEntries = () => {
    exportToCSV(`marketizers-monthly-entries-${month}`, [...entries]
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((e) => {
        const c = clientMap[e.client_id];
        const np = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
        return {
          month: e.month,
          client: c?.client_name ?? "—",
          revenue: e.marketizers_revenue,
          collected: e.amount_collected,
          pending: e.amount_pending,
          net_profit: np,
          locked: e.is_locked ? "yes" : "no",
        };
      }));
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm("Soft-delete this monthly entry? It can be restored by an admin.")) return;
    try {
      await softDeleteMarketizersMonthlyEntry(id);
    } catch (e: any) {
      alert(e?.message ?? "Delete failed.");
      return;
    }
    load(true);
  };

  return (
    <div>
      <style>{`.mz-row{transition:background .15s ease}.mz-row:hover{background:var(--parchment)}`}</style>
      <PageHeader
        eyebrow="Marketizers Financial Intelligence"
        title="Client Revenue & Profit Tracker"
        subtitle="Track client-wise revenue, collections, expenses, profit, and growth for Marketizers."
        actions={
          <>
            <select className="select-mini" value={month} onChange={(e) => setMonth(e.target.value)}>
              {(allMonths.length ? allMonths : [month]).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="btn-sm" onClick={handleExport} disabled={!rows.length}>Export CSV</button>
            {canEdit && (
              <button
                className="btn-sm"
                style={{ background: "var(--gold, #c9a14a)", color: "var(--ink)", borderColor: "var(--gold, #c9a14a)", fontWeight: 600 }}
                onClick={() => setAddClientOpen(true)}
              >
                + Add Client
              </button>
            )}
            <Link to="/brands/marketizers/revenue/clients">
              <button className="btn-sm">Clients</button>
            </Link>
            <Link to="/brands/marketizers/revenue/expenses">
              <button className="btn-sm">Expenses</button>
            </Link>
            <Link to="/brands/marketizers/revenue/collections">
              <button className="btn-sm">Pending Collections</button>
            </Link>
            <Link to="/brands/marketizers/revenue/reports">
              <button className="btn-sm btn-primary">Reports</button>
            </Link>
            {canEdit && (
              <Link to="/brands/marketizers/revenue/entry">
                <button className="btn-sm btn-primary">+ Monthly Entry</button>
              </Link>
            )}
          </>
        }
      />

      {addClientOpen && (
        <Suspense fallback={null}>
          <AddClientDrawer
            open={addClientOpen}
            onClose={() => setAddClientOpen(false)}
            onSaved={() => { setAddClientOpen(false); load(true); }}
            onSavedAndAddEntry={(id) => {
              setAddClientOpen(false);
              load(true);
              navigate({ to: "/brands/marketizers/revenue/entry", search: { clientId: id } as any });
            }}
          />
        </Suspense>
      )}
      {/* spacer to keep the original markup unchanged */}
      {error && <ErrorBanner message={`Could not load Marketizers revenue data. ${error}`} onRetry={load} />}

      {/* METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="panel" style={{ padding: 22 }}>
              <SkeletonRow height={10} width={80} />
              <div style={{ height: 10 }} />
              <SkeletonRow height={28} width={140} />
              <div style={{ height: 8 }} />
              <SkeletonRow height={10} width={120} />
            </div>
          ))
        ) : (
          <>
            <MetricCard
              accent="gold" label="Total Revenue" value={formatINR(totals.revenue)}
              delta={totals.revenueGrowth !== null ? `${totals.revenueGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(totals.revenueGrowth))} vs last month` : "— no prior month"}
              deltaTone={totals.revenueGrowth === null ? "na" : totals.revenueGrowth >= 0 ? "up" : "dn"}
            />
            <MetricCard
              accent="green" label="Amount Collected" value={formatINR(totals.collected)}
              delta={totals.collectedGrowth !== null ? `${totals.collectedGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(totals.collectedGrowth))} vs last month` : "—"}
              deltaTone={totals.collectedGrowth === null ? "na" : totals.collectedGrowth >= 0 ? "up" : "dn"}
            />
            <MetricCard
              emphasis
              accent={totals.netProfit >= 0 ? "green" : "red"} label="Net Profit" value={formatINR(totals.netProfit)}
              delta={totals.profitGrowth !== null ? `${totals.profitGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(totals.profitGrowth))} vs last month` : "—"}
              deltaTone={totals.profitGrowth === null ? "na" : totals.profitGrowth >= 0 ? "up" : "dn"}
              helper={totals.netProfit >= 0 ? "Profit after direct expenses" : "Loss / needs review"}
            />
            <MetricCard
              accent={totals.pending > totals.revenue * 0.3 ? "red" : "amber"}
              label="Pending Collection" value={formatINR(totals.pending)}
              delta={totals.pendingGrowth !== null ? `${totals.pendingGrowth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(totals.pendingGrowth))} vs last month` : "—"}
              deltaTone={totals.pendingGrowth === null ? "na" : totals.pendingGrowth <= 0 ? "up" : "dn"}
            />
          </>
        )}
      </div>

      {/* SECOND ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 28 }}>
        {/* CLIENT HEALTH */}
        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Client Health</div>
              <div className="panel-sub">Sorted by Marketizers revenue · {month}</div>
            </div>
          </div>
          <div style={{ padding: "0 26px" }}>
            {loading ? (
              <div style={{ padding: "20px 0", display: "grid", gap: 12 }}>
                {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} height={18} />)}
              </div>
            ) : !rows.length ? (
              <div style={{ padding: "32px 0" }}>
                <EmptyState
                  icon="📊"
                  title="Marketizers revenue is empty"
                  message="Add the first monthly client entry to start tracking client-wise revenue and profit."
                  action={canEdit ? (
                    <Link to="/brands/marketizers/revenue/entry">
                      <button className="btn-sm btn-primary">+ Add Monthly Entry</button>
                    </Link>
                  ) : null}
                />
              </div>
            ) : (
              <ScrollableTable minWidth={880}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Client", "Revenue", "Collected", "Pending", "Net Profit", "Margin", "Growth", "Status"].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.entry.id} className="mz-row" style={{ borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--parchment2)" }}>
                      <td style={tdL}>
                        <Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: r.client.id }} style={{ textDecoration: "none" }}>
                          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13 }}>{r.client.client_name}</div>
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 1 }}>{r.client.niche ?? "—"}</div>
                      </td>
                      <td style={tdN} className="num-neu">{formatINR(r.entry.marketizers_revenue)}</td>
                      <td style={tdN} className="num-pos">{formatINR(r.entry.amount_collected)}</td>
                      <td style={tdN} className={r.entry.amount_pending > 0 ? "num-neg" : "num-neu"}>{formatINR(r.entry.amount_pending)}</td>
                      <td style={tdN} className={r.netProfit >= 0 ? "num-pos" : "num-neg"}>{formatINR(r.netProfit)}</td>
                      <td style={tdN} className="num-neu">{formatPercent(r.margin)}</td>
                      <td style={tdN} className={r.growth === null ? "num-neu" : r.growth >= 0 ? "num-pos" : "num-neg"}>
                        {r.growth === null ? "—" : `${r.growth >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(r.growth))}`}
                      </td>
                      <td style={{ ...tdN, textAlign: "right" }}><HealthPill status={r.health} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </ScrollableTable>
            )}
          </div>
        </div>

        {/* COLLECTION RISK */}
        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Collection Risk</div>
              <div className="panel-sub">Pending amounts for {month}</div>
            </div>
          </div>
          <div className="panel-body">
            {loading ? (
              <div style={{ display: "grid", gap: 10 }}>
                {[0, 1, 2].map((i) => <SkeletonRow key={i} height={28} />)}
              </div>
            ) : (() => {
              const risky = rows.filter((r) => r.entry.amount_pending > 0)
                .sort((a, b) => b.entry.amount_pending - a.entry.amount_pending);
              if (!risky.length) {
                return <p style={{ fontSize: 12.5, color: "var(--ink4)" }}>No pending collections for this month.</p>;
              }
              return risky.map((r, i) => {
                const pct = r.pendingPct;
                const risk = pct > 30 ? "High Risk" : pct > 15 ? "Medium Risk" : "Low Risk";
                const cls = pct > 30 ? "sp-loss" : pct > 15 ? "sp-warn" : "sp-profit";
                return (
                  <div key={r.entry.id} style={{ padding: "11px 0", borderBottom: i === risky.length - 1 ? "none" : "1px solid var(--parchment2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.client.client_name}</div>
                      <span className={`status-pill ${cls}`}>{risk}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>
                      <span>{formatINR(r.entry.amount_pending)} pending</span>
                      <span>{formatPercent(pct)}</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* EXPENSE SUMMARY */}
      <div className="panel" style={{ marginBottom: 28 }}>
        <div className="ph" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="panel-title">Expense Summary</div>
            <div className="panel-sub">All Marketizers expenses for {month}</div>
          </div>
          <Link to="/brands/marketizers/revenue/expenses">
            <button className="btn-sm">Manage Expenses →</button>
          </Link>
        </div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <ExpenseStat label="Client Direct" value={formatINR(totals.directExpense)} accent="amber" hint="Costs billed per client" />
          <ExpenseStat label="Team Salaries" value={formatINR(expSummary.teamSalary)} accent="gold" hint="Allocated team payroll" />
          <ExpenseStat label="Shared / Operating" value={formatINR(expSummary.sharedTotal)} accent="gold" hint="Office, tools, shared ops" />
          <ExpenseStat label="Total Expenses" value={formatINR(totals.totalExpense)} accent="red" hint="All expenses for the month" highlight />
        </div>
      </div>

      {/* THIRD ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 28 }}>
        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Revenue vs Profit Trend</div>
              <div className="panel-sub">Last 3 months</div>
            </div>
          </div>
          <div className="panel-body">
            {!trend.length ? (
              <p style={{ fontSize: 12.5, color: "var(--ink4)" }}>Not enough data.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 24, height: 200, padding: "8px 0" }}>
                {trend.map((t) => (
                  <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, width: "100%", justifyContent: "center" }}>
                      <div title={`Revenue ${formatINR(t.revenue)}`} style={{ width: 28, height: `${(t.revenue / trendMax) * 100}%`, background: BRAND_BLUE, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                      <div title={`Profit ${formatINR(t.profit)}`} style={{ width: 28, height: `${(Math.max(0, t.profit) / trendMax) * 100}%`, background: "var(--green)", borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)" }}>{t.month}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 11.5, color: "var(--ink3)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, background: BRAND_BLUE, borderRadius: 2 }} /> Revenue</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, background: "var(--green)", borderRadius: 2 }} /> Net Profit</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Best / Worst Accounts</div>
              <div className="panel-sub">{month}</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 12 }}>
            {!best ? (
              <p style={{ fontSize: 12.5, color: "var(--ink4)" }}>No data yet.</p>
            ) : (
              <>
                <BestCard label="Highest Revenue" tone="gold" name={best.highestRev?.client.client_name} value={formatINR(best.highestRev?.entry.marketizers_revenue)} />
                <BestCard label="Best Margin" tone="good" name={best.bestMargin?.client.client_name} value={formatPercent(best.bestMargin?.margin ?? null)} />
                <BestCard label="Needs Attention" tone="warn" name={best.attention?.client.client_name} value={best.attention?.health ?? "—"} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* RECENT ENTRIES */}
      <div className="panel">
        <div className="ph" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="panel-title">Recent Monthly Entries</div>
            <div className="panel-sub">All months · most recent first</div>
          </div>
          <button className="btn-sm" onClick={handleExportEntries} disabled={!entries.length}>Export CSV</button>
        </div>
        <div style={{ padding: "0 26px 18px" }}>
          {!entries.length ? (
            <div style={{ padding: "28px 0" }}>
              <EmptyState
                icon="🗂️"
                title="No monthly entries yet"
                message="Once you add your first monthly entry, the most recent activity will appear here."
                action={canEdit ? (
                  <Link to="/brands/marketizers/revenue/entry">
                    <button className="btn-sm btn-primary">+ Add Monthly Entry</button>
                  </Link>
                ) : null}
              />
            </div>
          ) : (
            <ScrollableTable minWidth={840}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Month", "Client", "Revenue", "Collected", "Pending", "Net Profit", "Status", "Actions"].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i < 2 ? "left" : i === 7 ? "right" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...entries].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12).map((e, i, arr) => {
                  const c = clientMap[e.client_id];
                  if (!c) return null;
                  const np = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
                  const prev = entries.find((x) => x.client_id === e.client_id && x.month === previousMonth(e.month)) ?? null;
                  const health = getClientHealthStatus(e, prev);
                  const editable = canEdit && (!e.is_locked || admin);
                  return (
                    <tr key={e.id} className="mz-row" style={{ borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--parchment2)" }}>
                      <td style={{ ...tdL, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                        {e.month}{e.is_locked && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink4)" }}>🔒</span>}
                      </td>
                      <td style={tdL}>{c.client_name}</td>
                      <td style={tdN} className="num-neu">{formatINR(e.marketizers_revenue)}</td>
                      <td style={tdN} className="num-pos">{formatINR(e.amount_collected)}</td>
                      <td style={tdN} className={e.amount_pending > 0 ? "num-neg" : "num-neu"}>{formatINR(e.amount_pending)}</td>
                      <td style={tdN} className={np >= 0 ? "num-pos" : "num-neg"}>{formatINR(np)}</td>
                      <td style={{ ...tdN, textAlign: "right" }}><HealthPill status={health} /></td>
                      <td style={{ ...tdN, textAlign: "right" }}>
                        {editable && (
                          <Link to="/brands/marketizers/revenue/entry" search={{ entry: e.id } as any}>
                            <button className="btn-sm" style={{ marginRight: 6 }}>Edit</button>
                          </Link>
                        )}
                        {canEdit && !e.is_locked && (
                          <button className="btn-sm" onClick={() => handleSoftDelete(e.id)}>Delete</button>
                        )}
                        {!editable && !canEdit && <span style={{ fontSize: 11, color: "var(--ink4)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </ScrollableTable>
          )}
        </div>
      </div>
    </div>
  );
}

function BestCard({ label, name, value, tone }: { label: string; name?: string; value?: string; tone?: "warn" | "good" | "gold" }) {
  const accent = tone === "warn" ? "var(--amber)" : tone === "good" ? "var(--green)" : "var(--gold3)";
  const bg = tone === "warn" ? "var(--amber-bg)" : tone === "good" ? "var(--green-bg)" : "var(--gold-bg)";
  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderLeft: `3px solid ${accent}`, borderRadius: 8, background: bg }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{name && name.trim() ? name : "—"}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: accent, marginTop: 2 }}>{value && value !== "—" ? value : "Not enough data"}</div>
    </div>
  );
}

function ExpenseStat({
  label, value, highlight, accent = "gold", hint,
}: { label: string; value: string; highlight?: boolean; accent?: "gold" | "green" | "amber" | "red"; hint?: string }) {
  const c = { gold: "var(--gold3)", green: "var(--green)", amber: "var(--amber)", red: "var(--red)" }[accent];
  const bg = highlight
    ? { gold: "var(--gold-bg)", green: "var(--green-bg)", amber: "var(--amber-bg)", red: "var(--red-bg)" }[accent]
    : "var(--parchment)";
  return (
    <div style={{
      padding: "14px 16px", border: "1px solid var(--border)", borderLeft: `3px solid ${c}`,
      borderRadius: 8, background: bg,
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: highlight ? c : "var(--ink)" }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: "var(--ink4)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 0",
  borderBottom: "1px solid var(--border)", fontWeight: 400,
};
const tdL: React.CSSProperties = { padding: "13px 8px 13px 0", verticalAlign: "middle", fontSize: 13 };
const tdN: React.CSSProperties = {
  padding: "13px 0 13px 8px", verticalAlign: "middle", textAlign: "right",
  fontFamily: "'DM Mono',monospace", fontSize: 12,
};
