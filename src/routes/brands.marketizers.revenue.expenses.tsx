// Marketizers Expenses Center — full hub with 8 tabs.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard, canEditMarketizersFinance } from "@/components/marketizers/MarketizersAccessGuard";
import {
  PageHeader, MetricCard, EmptyState, ErrorBanner, LoadingState, FieldLabel, inputStyle, ScrollableTable,
} from "@/components/marketizers/ui";
import { ExpenseDrawer } from "@/components/marketizers/expenses/ExpenseDrawer";
import { SalarySheetTab } from "@/components/marketizers/expenses/SalarySheetTab";
import {
  getExpenseEntriesByMonth, softDeleteExpenseEntry, markExpensePaid, markExpenseSkipped, markExpenseCancelled,
  getExpenseTemplates, pauseExpenseTemplate, cancelExpenseTemplate, softDeleteExpenseTemplate, updateExpenseTemplate,
  generateRecurringExpensesForMonth,
  getExpenseMonthlyClose, lockExpenseMonth, unlockExpenseMonth,
  getExpenseTrend,
  getExpenseMasterOptions, createExpenseMasterOption, softDeleteExpenseMasterOption,
  type ExpenseEntry, type ExpenseTemplate, type MasterOption,
} from "@/services/marketizers/expensesService";
import { formatINR, formatMonthLabel } from "@/utils/formatters/format";
import { exportToCSV } from "@/utils/export/csv";

export const Route = createFileRoute("/brands/marketizers/revenue/expenses")({
  component: () => (
    <MarketizersAccessGuard>
      <ExpensesCenterPage />
    </MarketizersAccessGuard>
  ),
});

type Tab = "overview" | "entries" | "recurring" | "salary-sheet" | "salaries" | "tools" | "close" | "analytics" | "master";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "entries", label: "Expense Entries" },
  { key: "recurring", label: "Recurring Items" },
  { key: "salary-sheet", label: "Salary Sheet" },
  { key: "salaries", label: "Salaries" },
  { key: "tools", label: "Tools" },
  { key: "close", label: "Monthly Close" },
  { key: "analytics", label: "Analytics" },
  { key: "master", label: "Master Data" },
];

function ExpensesCenterPage() {
  const canEdit = canEditMarketizersFinance();
  const [tab, setTab] = useState<Tab>("overview");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Partial<ExpenseEntry> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { document.title = "Expenses Center | Marketizers"; }, []);

  const reload = async () => {
    setLoading(true); setError(null);
    try {
      const [e, t] = await Promise.all([getExpenseEntriesByMonth(month), getExpenseTemplates()]);
      setEntries(e); setTemplates(t);
    } catch (err: any) { setError(err?.message ?? "Failed to load."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [month]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Expense Control"
        title="Expenses Center"
        subtitle="Every expense — recurring, one-time, client-specific, company-wide — in one place."
        actions={
          <>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
            {canEdit && (
              <button className="btn-sm btn-primary" onClick={() => setDrawer({ month })}>+ Add Expense</button>
            )}
            <Link to="/brands/marketizers/revenue"><button className="btn-sm">← Dashboard</button></Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.key} className="btn-sm" onClick={() => setTab(t.key)}
            style={{
              borderRadius: 0, background: "transparent",
              borderBottom: tab === t.key ? "2px solid var(--gold3)" : "2px solid transparent",
              color: tab === t.key ? "var(--ink)" : "var(--ink3)",
              fontWeight: tab === t.key ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState rows={5} /> : (
        <>
          {tab === "overview" && <OverviewTab entries={entries} templates={templates} month={month} />}
          {tab === "entries" && <EntriesTab entries={entries} month={month} canEdit={canEdit} onEdit={setDrawer} reload={reload} flash={flash} />}
          {tab === "recurring" && <RecurringTab templates={templates} entries={entries} month={month} canEdit={canEdit} reload={reload} flash={flash} />}
          {tab === "salary-sheet" && <SalarySheetTab month={month} canEdit={canEdit} flash={flash} />}
          {tab === "salaries" && <SalariesEntriesTab entries={entries.filter((e) => e.category === "Team Salaries")} templates={templates} month={month} canEdit={canEdit} onEdit={setDrawer} onAdd={() => setDrawer({ month, category: "Team Salaries", expense_scope: "Team-Specific", expense_type: "recurring" })} reload={reload} flash={flash} />}
          {tab === "tools" && <FilteredEntriesTab entries={entries.filter((e) => e.category === "Software & Tools")} canEdit={canEdit} onEdit={setDrawer} onAdd={() => setDrawer({ month, category: "Software & Tools", expense_scope: "Tool-Specific", expense_type: "recurring" })} reload={reload} flash={flash} addLabel="+ Add Tool" emptyMsg="No tool subscriptions this month." />}
          {tab === "close" && <MonthlyCloseTab month={month} entries={entries} canEdit={canEdit} flash={flash} reload={reload} />}
          {tab === "analytics" && <AnalyticsTab month={month} entries={entries} />}
          {tab === "master" && <MasterDataTab canEdit={canEdit} />}
        </>
      )}

      {drawer && (
        <ExpenseDrawer initial={drawer} onClose={() => setDrawer(null)}
          onSaved={() => { reload(); flash(drawer.id ? "Expense updated" : "Expense saved"); }} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "var(--ink)", color: "var(--parchment)", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 80 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────
function OverviewTab({ entries, templates, month }: { entries: ExpenseEntry[]; templates: ExpenseTemplate[]; month: string }) {
  const active = entries.filter((e) => e.entry_status === "active");
  const sum = (xs: ExpenseEntry[]) => xs.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
  const sumTemplates = (xs: ExpenseTemplate[]) => xs.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
  const total = sum(active);
  const recurring = sum(active.filter((e) => e.expense_type === "recurring"));
  const optimization = sum(active.filter((e) => ["Under Review", "Wasteful"].includes(e.impact_type ?? "")));
  const recurringPct = total > 0 ? Math.round((recurring / total) * 100) : 0;
  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of active) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount_in_inr || 0));
    return Array.from(m, ([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount);
  }, [active]);
  const alerts: string[] = [];
  if (recurringPct > 70) alerts.push(`Recurring expenses are ${recurringPct}% of total — high fixed burden.`);
  if (active.some((e) => e.payment_status === "pending" || e.payment_status === "partial")) alerts.push("Some expenses are still pending payment.");
  if (active.some((e) => e.receipt_status === "Missing")) alerts.push("Some expenses are missing receipts.");
  if (active.some((e) => e.impact_type === "Under Review")) alerts.push("Items flagged Under Review need a decision.");

  const pendingSalaryTemplates = templates.filter(
    (t) => t.category === "Team Salaries" && t.template_status === "active" && t.is_recurring
      && (!t.recurring_start_month || month >= t.recurring_start_month)
      && (!t.recurring_end_month || month <= t.recurring_end_month)
      && !active.some((e) => e.template_id === t.id),
  );
  const activeSalaryTemplates = templates.filter(
    (t) => t.category === "Team Salaries" && t.template_status === "active" && t.is_recurring
      && (!t.recurring_start_month || month >= t.recurring_start_month)
      && (!t.recurring_end_month || month <= t.recurring_end_month),
  );
  const pendingSalaryAmount = sumTemplates(pendingSalaryTemplates);
  const fullMonthPayroll = sumTemplates(activeSalaryTemplates);
  const accruedDay = getAccruedPayrollDay(month);
  const accruedSalary = (fullMonthPayroll * accruedDay) / 30;

  return (
    <div>
      {pendingSalaryTemplates.length > 0 && (
        <div style={{ background: "var(--parchment2)", border: "1px solid var(--border)", padding: "12px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13, color: "var(--ink2)" }}>
          <strong style={{ color: "var(--ink)" }}>{formatINR(pendingSalaryAmount)} salaries ready to generate for {formatMonthLabel(month)}.</strong>{" "}
          Generate from the Salaries tab to post them into expenses ({pendingSalaryTemplates.length} pending).
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
        <MetricCard accent="red" label="Total Expenses" value={formatINR(total)} delta={formatMonthLabel(month)} />
        <MetricCard accent="amber" label="Recurring Burden" value={formatINR(recurring)} delta={`${recurringPct}% of total`} />
        <MetricCard accent="gold" label="Optimization Potential" value={formatINR(optimization)} delta="Under review + wasteful" />
        <MetricCard accent="green" label="Active Recurring Templates" value={String(templates.filter((t) => t.template_status === "active" && t.is_recurring).length)} />
        <MetricCard accent="gold" label="Full Month Payroll" value={formatINR(fullMonthPayroll)} delta={formatMonthLabel(month)} />
        <MetricCard accent="amber" label="Accrued Till Today" value={formatINR(accruedSalary)} delta={`${accruedDay}/30 days`} />
      </div>


      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div className="panel" style={{ padding: 20 }}>
          <h4 style={panelTitle}>Category Breakdown</h4>
          {breakdown.length === 0 ? <p style={muted}>No expenses yet.</p> : breakdown.map((b) => (
            <div key={b.category} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--parchment2)", fontSize: 13 }}>
              <span>{b.category}</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>{formatINR(b.amount)}</span>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <h4 style={panelTitle}>Intelligence Alerts</h4>
          {alerts.length === 0 ? <p style={muted}>No alerts. Looking clean.</p> : alerts.map((a, i) => (
            <div key={i} style={{ padding: "8px 10px", background: "var(--parchment2)", borderRadius: 6, fontSize: 12.5, color: "var(--ink2)", marginBottom: 6 }}>⚠ {a}</div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <h4 style={panelTitle}>Recent Entries</h4>
        {active.slice(0, 8).length === 0 ? <p style={muted}>No entries this month.</p> : (
          <ScrollableTable minWidth={620}>
            <table style={tbl}>
              <thead><tr>{["Name", "Category", "Scope", "Amount", "Status"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{h}</th>)}</tr></thead>
              <tbody>{active.slice(0, 8).map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={td}>{e.expense_name}</td><td style={td}>{e.category}</td><td style={td}>{e.expense_scope}</td>
                  <td style={tdNum}>{formatINR(e.amount_in_inr)}</td><td style={td}>{e.payment_status}</td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollableTable>
        )}
      </div>
    </div>
  );
}

// ── Generic entries table ─────────────────────────────────────
function EntriesTab({ entries, month, canEdit, onEdit, reload, flash }: {
  entries: ExpenseEntry[]; month: string; canEdit: boolean;
  onEdit: (e: ExpenseEntry) => void; reload: () => void; flash: (s: string) => void;
}) {
  const [filter, setFilter] = useState({ category: "", scope: "", status: "", search: "" });
  const filtered = entries.filter((e) =>
    (!filter.category || e.category === filter.category) &&
    (!filter.scope || e.expense_scope === filter.scope) &&
    (!filter.status || e.payment_status === filter.status) &&
    (!filter.search || e.expense_name.toLowerCase().includes(filter.search.toLowerCase()))
  );
  const cats = Array.from(new Set(entries.map((e) => e.category))).sort();
  const scopes = Array.from(new Set(entries.map((e) => e.expense_scope))).sort();

  const exportCsv = () => {
    exportToCSV(`marketizers-expenses-${month}`, filtered.map((e) => ({
      month: e.month, expense_name: e.expense_name, category: e.category, scope: e.expense_scope,
      amount: e.amount, currency: e.currency, amount_in_inr: e.amount_in_inr,
      payment_status: e.payment_status, payment_handler: e.payment_handler ?? "",
      impact: e.impact_type ?? "", receipt_status: e.receipt_status ?? "", date: e.expense_date ?? "",
    })));
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, maxWidth: 220 }} placeholder="Search…" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <select style={{ ...inputStyle, maxWidth: 180 }} value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select style={{ ...inputStyle, maxWidth: 180 }} value={filter.scope} onChange={(e) => setFilter({ ...filter, scope: e.target.value })}>
          <option value="">All scopes</option>{scopes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inputStyle, maxWidth: 160 }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All statuses</option>{["paid", "pending", "partial", "skipped", "cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn-sm" onClick={exportCsv}>Export CSV</button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="💸" title="No expenses match your filters" message="Try clearing the filters or add a new expense." />
      ) : (
        <div className="panel">
          <ScrollableTable minWidth={900}>
            <table style={tbl}>
              <thead><tr>{["Name", "Type", "Scope", "Category", "Handler", "Status", "Receipt", "Impact", "Amount", ""].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 8 ? "right" : "left" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{filtered.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={td}>{e.expense_name}</td>
                  <td style={td}>{e.expense_type === "recurring" ? "Recurring" : "One-Time"}</td>
                  <td style={td}>{e.expense_scope}</td>
                  <td style={td}>{e.category}</td>
                  <td style={td}>{e.payment_handler ?? "—"}</td>
                  <td style={td}>{e.payment_status}</td>
                  <td style={td}>{e.receipt_status ?? "—"}</td>
                  <td style={td}>{e.impact_type ?? "—"}</td>
                  <td style={tdNum}>{formatINR(e.amount_in_inr)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && (
                      <>
                        <button className="btn-sm" onClick={() => onEdit(e)}>Edit</button>{" "}
                        {e.payment_status !== "paid" && <button className="btn-sm" onClick={async () => { await markExpensePaid(e.id); reload(); flash("Marked paid"); }}>Paid</button>}{" "}
                        <button className="btn-sm" onClick={async () => { if (confirm("Delete this expense?")) { await softDeleteExpenseEntry(e.id); reload(); flash("Deleted"); } }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
    </>
  );
}

function FilteredEntriesTab({ entries, canEdit, onEdit, onAdd, reload, flash, addLabel, emptyMsg }: {
  entries: ExpenseEntry[]; canEdit: boolean; onEdit: (e: ExpenseEntry) => void; onAdd: () => void;
  reload: () => void; flash: (s: string) => void; addLabel: string; emptyMsg: string;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        {canEdit && <button className="btn-sm btn-primary" onClick={onAdd}>{addLabel}</button>}
      </div>
      {entries.length === 0 ? (
        <EmptyState icon="📋" title="Nothing yet" message={emptyMsg} action={canEdit ? <button className="btn-sm btn-primary" onClick={onAdd}>{addLabel}</button> : null} />
      ) : (
        <div className="panel">
          <ScrollableTable minWidth={780}>
            <table style={tbl}>
              <thead><tr>{["Name", "Vendor / Person", "Role / Dept", "Status", "Amount", ""].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 4 ? "right" : "left" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={td}>{e.expense_name}</td>
                  <td style={td}>{e.vendor_or_tool ?? e.employee_name ?? e.freelancer_name ?? "—"}</td>
                  <td style={td}>{[e.role, e.department].filter(Boolean).join(" / ") || "—"}</td>
                  <td style={td}>{e.payment_status}</td>
                  <td style={tdNum}>{formatINR(e.amount_in_inr)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {canEdit && (
                      <>
                        <button className="btn-sm" onClick={() => onEdit(e)}>Edit</button>{" "}
                        <button className="btn-sm" onClick={async () => { if (confirm("Delete?")) { await softDeleteExpenseEntry(e.id); reload(); flash("Deleted"); } }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
    </>
  );
}

// Salaries tab — adds a "templates ready / Generate" banner when no entries
// exist yet for the month but active Team Salaries templates are present.
function SalariesEntriesTab({ entries, templates, month, canEdit, onEdit, onAdd, reload, flash }: {
  entries: ExpenseEntry[]; templates: ExpenseTemplate[]; month: string; canEdit: boolean;
  onEdit: (e: ExpenseEntry) => void; onAdd: () => void; reload: () => void; flash: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const activeSalaryTemplates = templates.filter(
    (t) => t.category === "Team Salaries" && t.template_status === "active" && t.is_recurring &&
      isMonthInRange(month, t.recurring_start_month, t.recurring_end_month),
  );
  const generatedIds = new Set(entries.filter((e) => e.template_id).map((e) => e.template_id));
  const pending = activeSalaryTemplates.filter((t) => !generatedIds.has(t.id));
  const onGenerate = async () => {
    setBusy(true);
    try {
      const r = await generateRecurringExpensesForMonth(month, { category: "Team Salaries" });
      if (r.errors?.length) alert(`Some salaries failed to generate:\n\n${r.errors.join("\n")}`);
      flash(`Generated ${r.created} of ${r.total} salaries for ${month}`);
      reload();
    } catch (e: any) { alert(e?.message ?? "Generation failed."); }
    finally { setBusy(false); }
  };
  const pendingTotal = pending.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
  return (
    <>
      {pending.length > 0 && (
        <div style={{ background: "var(--parchment2)", border: "1px solid var(--border)", padding: "12px 16px", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>
            <strong style={{ color: "var(--ink)" }}>{pending.length}</strong> salary template{pending.length === 1 ? "" : "s"} ready for {formatMonthLabel(month)} · {formatINR(pendingTotal)}.
          </div>
          {canEdit && <button className="btn-sm btn-primary" onClick={onGenerate} disabled={busy}>Generate {month}</button>}
        </div>
      )}
      {pending.length > 0 && (
        <div className="panel" style={{ marginBottom: entries.length ? 14 : 0 }}>
          <ScrollableTable minWidth={920}>
            <table style={tbl}>
              <thead><tr>{["Employee", "Role / Department", "Salary Month", "Amount", "Payment Date", "Status", "Source"].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{pending.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={td}>{t.employee_name ?? t.expense_name}</td>
                  <td style={td}>{[t.role, t.department].filter(Boolean).join(" / ") || "—"}</td>
                  <td style={td}>{formatMonthLabel(month)}</td>
                  <td style={tdNum}>{formatINR(t.amount_in_inr)}</td>
                  <td style={td}>{t.payment_day ? `Day ${t.payment_day}` : "—"}</td>
                  <td style={td}><span className="status-pill sp-warn">Ready to Generate</span></td>
                  <td style={td}>Team Access Control</td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
      {entries.length === 0 && pending.length > 0 ? null : (
      <FilteredEntriesTab
        entries={entries} canEdit={canEdit} onEdit={onEdit} onAdd={onAdd}
        reload={reload} flash={flash} addLabel="+ Add Salary"
        emptyMsg={pending.length > 0
          ? "Click Generate above to post these templates as monthly salary entries."
          : "No salary entries this month."}
      />
      )}
    </>
  );
}

// ── Recurring ─────────────────────────────────────────────────
function isMonthInRange(month: string, start: string | null, end: string | null) {
  if (start && month < start) return false;
  if (end && month > end) return false;
  return true;
}

function getAccruedPayrollDay(month: string) {
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  if (month < currentMonth) return 30;
  if (month > currentMonth) return 0;
  return Math.min(Math.max(today.getDate(), 1), 30);
}

function RecurringTab({ templates, entries, month, canEdit, reload, flash }: {
  templates: ExpenseTemplate[]; entries: ExpenseEntry[]; month: string; canEdit: boolean; reload: () => void; flash: (s: string) => void;
}) {
  const recurring = templates.filter((t) => t.is_recurring);
  // Compute preview locally — avoids redundant network round trips.
  const preview = useMemo(() => {
    const eligible = recurring.filter((t) => t.template_status === "active" && isMonthInRange(month, t.recurring_start_month, t.recurring_end_month));
    const generated = new Set(entries.filter((e) => e.template_id).map((e) => e.template_id));
    return {
      toGenerate: eligible.filter((t) => !generated.has(t.id)),
      alreadyGenerated: eligible.filter((t) => generated.has(t.id)),
    };
  }, [recurring, entries, month]);

  const generate = async () => {
    const r = await generateRecurringExpensesForMonth(month);
    flash(`Generated ${r.created} of ${r.total} recurring expenses`);
    reload();
  };

  return (
    <>
      <div className="panel" style={{ padding: 16, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)" }}>
          For <strong>{formatMonthLabel(month)}</strong>:{" "}
          {preview.toGenerate.length} pending generation, {preview.alreadyGenerated.length} already generated.
        </div>
        {canEdit && preview.toGenerate.length > 0 && (
          <button className="btn-sm btn-primary" onClick={generate}>Generate Recurring for {formatMonthLabel(month)}</button>
        )}
      </div>

      {recurring.length === 0 ? (
        <EmptyState icon="🔁" title="No recurring templates yet" message="Create a recurring template via Add Expense → Recurring." />
      ) : (
        <div className="panel">
          <ScrollableTable minWidth={860}>
            <table style={tbl}>
              <thead><tr>{["Name", "Category", "Scope", "Amount", "Period", "Pay Day", "Status", ""].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{h}</th>
              ))}</tr></thead>
              <tbody>{recurring.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={td}>{t.expense_name}</td>
                  <td style={td}>{t.category}</td>
                  <td style={td}>{t.expense_scope}</td>
                  <td style={tdNum}>{formatINR(t.amount_in_inr)}</td>
                  <td style={td}>{t.recurring_period_start_day}–{t.recurring_period_end_day}</td>
                  <td style={td}>{t.payment_day ?? "—"}</td>
                  <td style={td}>{t.template_status}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && t.template_status === "active" && (
                      <button className="btn-sm" onClick={async () => { await pauseExpenseTemplate(t.id); reload(); flash("Paused"); }}>Pause</button>
                    )}{" "}
                    {canEdit && t.template_status === "paused" && (
                      <button className="btn-sm" onClick={async () => { await updateExpenseTemplate(t.id, { template_status: "active" }); reload(); flash("Resumed"); }}>Resume</button>
                    )}{" "}
                    {canEdit && t.template_status !== "cancelled" && (
                      <button className="btn-sm" onClick={async () => {
                        const reason = prompt("Cancellation reason?") ?? "";
                        await cancelExpenseTemplate(t.id, reason, month); reload(); flash("Cancelled");
                      }}>Cancel</button>
                    )}{" "}
                    {canEdit && (
                      <button className="btn-sm" onClick={async () => { if (confirm("Delete template?")) { await softDeleteExpenseTemplate(t.id); reload(); flash("Deleted"); } }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
    </>
  );
}

// ── Monthly Close ─────────────────────────────────────────────
function MonthlyCloseTab({ month, entries, canEdit, flash, reload }: {
  month: string; entries: ExpenseEntry[]; canEdit: boolean; flash: (s: string) => void; reload: () => void;
}) {
  const [closure, setClosure] = useState<any>(null);
  // Compute totals locally from already-loaded entries.
  const totals = useMemo(() => {
    const active = entries.filter((e) => e.entry_status === "active");
    const sum = (xs: ExpenseEntry[]) => xs.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
    return {
      total_expenses: sum(active),
      recurring_expenses: sum(active.filter((e) => e.expense_type === "recurring")),
      one_time_expenses: sum(active.filter((e) => e.expense_type === "one_time")),
      client_specific_expenses: sum(active.filter((e) => e.expense_scope === "Client-Specific")),
      company_wide_expenses: sum(active.filter((e) => e.expense_scope === "Company-Wide")),
      team_salary_expenses: sum(active.filter((e) => e.category === "Team Salaries")),
      tools_expenses: sum(active.filter((e) => e.category === "Software & Tools")),
      pending_expenses: sum(active.filter((e) => e.payment_status === "pending" || e.payment_status === "partial")),
      missing_receipts_count: active.filter((e) => e.receipt_status === "Missing" || e.receipt_status === "Invoice Pending").length,
      review_items_count: active.filter((e) => e.impact_type === "Under Review" || e.impact_type === "Wasteful").length,
    };
  }, [entries]);
  useEffect(() => { getExpenseMonthlyClose(month).then(setClosure).catch(() => {}); }, [month]);

  const warnings: string[] = [];
  if (totals.pending_expenses > 0) warnings.push(`${formatINR(totals.pending_expenses)} in pending payments.`);
  if (totals.missing_receipts_count > 0) warnings.push(`${totals.missing_receipts_count} entries missing receipts.`);
  if (totals.review_items_count > 0) warnings.push(`${totals.review_items_count} items flagged for review.`);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        <MetricCard accent="red" label="Total Expenses" value={formatINR(totals.total_expenses)} />
        <MetricCard accent="amber" label="Recurring" value={formatINR(totals.recurring_expenses)} />
        <MetricCard accent="gold" label="One-Time" value={formatINR(totals.one_time_expenses)} />
        <MetricCard accent="amber" label="Pending" value={formatINR(totals.pending_expenses)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
        <MetricCard accent="green" label="Team Salaries" value={formatINR(totals.team_salary_expenses)} />
        <MetricCard accent="gold" label="Tools" value={formatINR(totals.tools_expenses)} />
        <MetricCard accent="amber" label="Client-Specific" value={formatINR(totals.client_specific_expenses)} />
        <MetricCard accent="green" label="Company-Wide" value={formatINR(totals.company_wide_expenses)} />
      </div>

      <div className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h4 style={panelTitle}>Pre-Close Warnings</h4>
        {warnings.length === 0 ? <p style={muted}>All clear. Ready to lock.</p> :
          warnings.map((w, i) => <div key={i} style={{ padding: "8px 10px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 6, fontSize: 12.5, marginBottom: 6 }}>⚠ {w}</div>)}
      </div>

      {closure?.is_locked ? (
        <div className="panel" style={{ padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 12 }}>🔒 {formatMonthLabel(month)} is locked. Total: <strong>{formatINR(closure.total_expenses)}</strong></p>
          {canEdit && <button className="btn-sm" onClick={async () => { await unlockExpenseMonth(month); setClosure(await getExpenseMonthlyClose(month)); reload(); flash("Month unlocked"); }}>Unlock Month</button>}
        </div>
      ) : (
        canEdit && <button className="btn-sm btn-primary" onClick={async () => {
          if (!confirm(`Lock ${formatMonthLabel(month)}? Totals will be saved.`)) return;
          await lockExpenseMonth(month); setClosure(await getExpenseMonthlyClose(month)); reload(); flash("Month locked");
        }}>Lock {formatMonthLabel(month)}</button>
      )}
    </>
  );
}

// ── Analytics ─────────────────────────────────────────────────
function AnalyticsTab({ month, entries }: { month: string; entries: ExpenseEntry[] }) {
  const [trend, setTrend] = useState<{ month: string; total: number }[]>([]);
  // Compute breakdown + flags locally — avoids two extra full-table reads.
  const active = useMemo(() => entries.filter((e) => e.entry_status === "active"), [entries]);
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of active) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount_in_inr || 0));
    return Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [active]);
  const flags = useMemo(() => ({
    underReview: active.filter((e) => e.impact_type === "Under Review"),
    wasteful: active.filter((e) => e.impact_type === "Wasteful"),
    pending: active.filter((e) => e.payment_status === "pending" || e.payment_status === "partial"),
    missingReceipts: active.filter((e) => e.receipt_status === "Missing" || e.receipt_status === "Invoice Pending"),
  }), [active]);
  useEffect(() => {
    const months: string[] = [];
    const [y, m] = month.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    getExpenseTrend(months).then(setTrend).catch(() => {});
  }, [month]);

  const max = Math.max(1, ...trend.map((t) => t.total));
  const top10 = [...entries].filter((e) => e.entry_status === "active").sort((a, b) => Number(b.amount_in_inr) - Number(a.amount_in_inr)).slice(0, 10);

  return (
    <>
      <div className="panel" style={{ padding: 20, marginBottom: 14 }}>
        <h4 style={panelTitle}>6-Month Expense Trend</h4>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160, padding: "12px 4px" }}>
          {trend.map((t) => (
            <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--ink4)" }}>{formatINR(t.total)}</div>
              <div style={{ width: "100%", background: "var(--gold3)", height: `${(t.total / max) * 110}px`, borderRadius: "4px 4px 0 0", minHeight: 2 }} />
              <div style={{ fontSize: 10, color: "var(--ink4)", fontFamily: "'DM Mono',monospace" }}>{t.month.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="panel" style={{ padding: 20 }}>
          <h4 style={panelTitle}>Top 10 Cost Items</h4>
          {top10.length === 0 ? <p style={muted}>No data.</p> : top10.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--parchment2)" }}>
              <span>{e.expense_name}</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>{formatINR(e.amount_in_inr)}</span>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <h4 style={panelTitle}>Category Breakdown</h4>
          {breakdown.length === 0 ? <p style={muted}>No data.</p> : breakdown.map((b) => (
            <div key={b.category} style={{ padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--parchment2)", display: "flex", justifyContent: "space-between" }}>
              <span>{b.category}</span><span style={{ fontFamily: "'DM Mono',monospace" }}>{formatINR(b.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {flags && (
        <div className="panel" style={{ padding: 20 }}>
          <h4 style={panelTitle}>Optimization & Risk Flags</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            <FlagBlock title="Under Review" items={flags.underReview} />
            <FlagBlock title="Wasteful" items={flags.wasteful} />
            <FlagBlock title="Pending" items={flags.pending} />
            <FlagBlock title="Missing Receipts" items={flags.missingReceipts} />
          </div>
        </div>
      )}
    </>
  );
}

function FlagBlock({ title, items }: { title: string; items: ExpenseEntry[] }) {
  return (
    <div style={{ background: "var(--parchment2)", padding: 12, borderRadius: 6 }}>
      <div style={{ fontSize: 10.5, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: ".12em", color: "var(--ink4)", marginBottom: 6 }}>{title} ({items.length})</div>
      {items.length === 0 ? <span style={{ fontSize: 11.5, color: "var(--ink4)" }}>None</span> :
        items.slice(0, 5).map((e) => <div key={e.id} style={{ fontSize: 11.5, padding: "2px 0" }}>{e.expense_name} — <span style={{ fontFamily: "'DM Mono',monospace" }}>{formatINR(e.amount_in_inr)}</span></div>)}
    </div>
  );
}

// ── Master Data ───────────────────────────────────────────────
const OPTION_TYPES = [
  ["expense_name", "Expense Names"], ["category", "Categories"], ["vendor", "Vendors / Tools"],
  ["employee", "Employees"], ["role", "Roles"], ["department", "Departments"],
  ["payment_mode", "Payment Modes"], ["payment_status", "Payment Statuses"], ["expense_scope", "Expense Scopes"],
  ["payment_handler", "Payment Handlers"], ["impact_type", "Impact Types"], ["platform", "Platforms"],
  ["freelancer", "Freelancers"], ["cost_center", "Cost Centers"], ["receipt_status", "Receipt Statuses"],
  ["purpose", "Purposes"],
] as const;

function MasterDataTab({ canEdit }: { canEdit: boolean }) {
  const [all, setAll] = useState<MasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [newVal, setNewVal] = useState("");

  const load = async () => {
    setLoading(true);
    try { setAll(await getExpenseMasterOptions()); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const add = async (optionType: string) => {
    if (!newVal.trim()) return;
    await createExpenseMasterOption(optionType, newVal.trim());
    setNewVal(""); setAdding(null); load();
  };

  if (loading) return <LoadingState rows={4} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
      {OPTION_TYPES.map(([type, label]) => {
        const items = all.filter((o) => o.option_type === type);
        return (
          <div key={type} className="panel" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ ...panelTitle, marginBottom: 0 }}>{label}</h4>
              {canEdit && <button className="btn-sm" onClick={() => { setAdding(adding === type ? null : type); setNewVal(""); }}>+ Add</button>}
            </div>
            {adding === type && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={newVal} onChange={(e) => setNewVal(e.target.value)} autoFocus
                  onKeyDown={(e) => e.key === "Enter" && add(type)} />
                <button className="btn-sm btn-primary" onClick={() => add(type)}>Save</button>
              </div>
            )}
            {items.length === 0 ? <p style={muted}>No options yet.</p> : items.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--parchment2)" }}>
                <span>{o.label}</span>
                {canEdit && <button className="btn-sm" onClick={async () => { if (confirm("Archive?")) { await softDeleteExpenseMasterOption(o.id); load(); } }}>×</button>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const panelTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 };
const muted: React.CSSProperties = { fontSize: 12.5, color: "var(--ink4)" };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 0", borderBottom: "1px solid var(--border)", fontWeight: 400 };
const td: React.CSSProperties = { padding: "11px 8px 11px 0", fontSize: 12.5, color: "var(--ink2)" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };
