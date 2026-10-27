// Bulk Salary Sheet — minimal table + Details drawer + recurring generation.
import { useEffect, useMemo, useState } from "react";
import { useBrands } from "@/hooks/useBrands";
import {
  PageHeader, MetricCard, EmptyState, ErrorBanner, LoadingState,
  ScrollableTable, inputStyle,
} from "@/components/marketizers/ui";
import {
  getExpenseTemplates, softDeleteExpenseTemplate, generateRecurringExpensesForMonth,
  createExpenseTemplate, type ExpenseTemplate,
} from "@/services/marketizers/expensesService";
import {
  getAllocations, saveAllocations, type SharedAllocation,
} from "@/services/allocations/sharedExpenseAllocationService";
import { formatINR } from "@/utils/formatters/format";
import { SalaryDetailsDrawer, type SalaryRow } from "./SalaryDetailsDrawer";
import { syncAllAutoAddedSalariesForMonth } from "@/services/accessControl/teamCompensationService";

const SOURCE_TYPE = "marketizers_salary_template";

export function SalarySheetTab({ month, canEdit, flash }: {
  month: string;
  canEdit: boolean;
  flash: (s: string) => void;
}) {
  const { allocationBrands } = useBrands();
  const [salaries, setSalaries] = useState<ExpenseTemplate[]>([]);
  const [allocs, setAllocs] = useState<Map<string, SharedAllocation[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<SalaryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true); setErr(null);
    try {
      const tpls = (await getExpenseTemplates({ recurringOnly: true })).filter((t) => t.category === "Team Salaries");
      setSalaries(tpls);
      // fetch allocations per template (parallel)
      const pairs = await Promise.all(tpls.map(async (t) => [t.id, await getAllocations(SOURCE_TYPE, t.id)] as const));
      setAllocs(new Map(pairs));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load salaries.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const marketizersBrand = allocationBrands.find((b) => b.slug === "marketizers");

  const totals = useMemo(() => {
    const active = salaries.filter((s) => s.template_status === "active");
    const gross = active.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
    let marketizersShare = 0;
    let sharedPayroll = 0;
    let sharedItems = 0;
    for (const t of active) {
      const list = allocs.get(t.id) ?? [];
      const isShared = !!(t as any).is_shared_expense;
      if (isShared) {
        sharedPayroll += Number(t.amount_in_inr || 0);
        sharedItems++;
      }
      if (marketizersBrand) {
        const m = list.find((a) => a.brand_id === marketizersBrand.id);
        if (m) marketizersShare += Number(m.allocated_amount_in_inr || 0);
        else if (!isShared) marketizersShare += Number(t.amount_in_inr || 0);
      }
    }
    return { gross, marketizersShare, sharedPayroll, sharedItems, activePeople: active.length };
  }, [salaries, allocs, marketizersBrand]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this salary template?")) return;
    await softDeleteExpenseTemplate(id);
    reload(); flash("Deleted");
  };

  const onCopy = async (t: ExpenseTemplate) => {
    setBusy(true);
    try {
      const created = await createExpenseTemplate({
        ...t,
        id: undefined as any,
        expense_name: `${t.expense_name} (copy)`,
        employee_name: t.employee_name ? `${t.employee_name} (copy)` : null,
      } as any);
      // copy allocations
      const list = allocs.get(t.id) ?? [];
      if (list.length) {
        await saveAllocations(SOURCE_TYPE, created.id, Number(t.amount_in_inr || 0),
          list.map((a) => ({ brand_id: a.brand_id, allocation_percentage: Number(a.allocation_percentage) })));
      }
      reload(); flash("Copied");
    } finally { setBusy(false); }
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      const res = await generateRecurringExpensesForMonth(month);
      flash(`Generated ${res.created} of ${res.total} for ${month}`);
      reload();
    } catch (e: any) {
      alert(e?.message ?? "Generation failed.");
    } finally { setBusy(false); }
  };

  const renderAlloc = (t: ExpenseTemplate) => {
    const list = allocs.get(t.id) ?? [];
    const isShared = !!(t as any).is_shared_expense;
    if (!isShared) return <span style={{ fontSize: 11, color: "var(--ink4)" }}>100% Marketizers</span>;
    if (!list.length) return <span style={{ fontSize: 11, color: "var(--red)" }}>No allocation</span>;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {list.map((a) => {
          const b = allocationBrands.find((x) => x.id === a.brand_id);
          return (
            <span key={a.id} style={{
              fontSize: 10, fontFamily: "'DM Mono',monospace",
              padding: "2px 6px", borderRadius: 4, background: "var(--parchment2)", color: "var(--ink2)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: b?.color ?? "#999" }} />
              {b?.name ?? "?"}: {Number(a.allocation_percentage).toFixed(0)}%
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {err && <ErrorBanner message={err} onRetry={reload} />}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}>
        <MetricCard accent="red" label="Gross Payroll" value={formatINR(totals.gross)} />
        <MetricCard accent="gold" label="Marketizers Share" value={formatINR(totals.marketizersShare)} />
        <MetricCard accent="amber" label="Shared Payroll" value={formatINR(totals.sharedPayroll)} />
        <MetricCard accent="green" label="Shared Items" value={String(totals.sharedItems)} />
        <MetricCard accent="green" label="Active People" value={String(totals.activePeople)} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, justifyContent: "flex-end" }}>
        {canEdit && (
          <>
            <button className="btn-sm" onClick={async () => {
              setBusy(true);
              try {
                const r = await syncAllAutoAddedSalariesForMonth(month);
                flash(`Synced ${r.synced}, skipped ${r.skipped}${r.failed ? `, failed ${r.failed}` : ""}`);
                if (r.errors?.length) alert(`Some members failed to sync:\n\n${r.errors.join("\n")}`);
                reload();
              } catch (e: any) { alert(e?.message ?? "Sync failed."); }
              finally { setBusy(false); }
            }} disabled={busy}>Sync from Team Access Control</button>
            <button className="btn-sm" onClick={onGenerate} disabled={busy}>Generate {month}</button>
            <button className="btn-sm btn-primary" onClick={() => setDrawer({})}>+ Add Employee</button>
          </>
        )}
      </div>

      {loading ? <LoadingState rows={4} /> : !salaries.length ? (
        <EmptyState
          icon="👥"
          title="No salaries yet"
          message="Add the team's recurring salaries. Each row becomes a recurring template that generates a monthly entry automatically."
          action={canEdit ? <button className="btn-sm btn-primary" onClick={() => setDrawer({})}>+ Add Employee</button> : null}
        />
      ) : (
        <div className="panel">
          <ScrollableTable minWidth={920}>
            <table style={tbl}>
              <thead>
                <tr>{["Employee", "Department", "Role", "Monthly Salary", "Payment Day", "Allocation", "Status", ""].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {salaries.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                    <td style={td}><strong style={{ color: "var(--ink)" }}>{t.employee_name ?? t.expense_name}</strong></td>
                    <td style={td}>{t.department ?? "—"}</td>
                    <td style={td}>{t.role ?? "—"}</td>
                    <td style={tdNum}>{formatINR(Number(t.amount_in_inr || 0))}</td>
                    <td style={td}>{t.payment_day ?? "—"}</td>
                    <td style={td}>{renderAlloc(t)}</td>
                    <td style={td}>
                      <span className={`status-pill ${t.template_status === "active" ? "sp-profit" : "sp-warn"}`}>{t.template_status}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {canEdit && (
                        <>
                          <button className="btn-sm" onClick={() => setDrawer(t as any)}>Details</button>{" "}
                          <button className="btn-sm" onClick={() => onCopy(t)} disabled={busy}>Copy</button>{" "}
                          <button className="btn-sm" onClick={() => onDelete(t.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {drawer && (
        <SalaryDetailsDrawer
          initial={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => { reload(); flash(drawer.id ? "Salary updated" : "Salary saved"); }}
        />
      )}
    </div>
  );
}

const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 18px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "12px 8px 12px 18px", verticalAlign: "middle", fontSize: 13, color: "var(--ink2)" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "'DM Mono',monospace" };
