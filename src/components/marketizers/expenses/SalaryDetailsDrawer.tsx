// Drawer for full salary details + brand allocation.
import { useEffect, useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { BrandAllocationEditor } from "@/components/allocations/BrandAllocationEditor";
import { useBrands } from "@/hooks/useBrands";
import {
  saveAllocations, getAllocations, validateAllocationPercentages,
  type AllocationInput,
} from "@/services/allocations/sharedExpenseAllocationService";
import {
  createExpenseTemplate, updateExpenseTemplate, type ExpenseTemplate,
} from "@/services/marketizers/expensesService";
import { supabase } from "@/integrations/supabase/client";

export type SalaryRow = Partial<ExpenseTemplate> & { is_shared_expense?: boolean };

export function SalaryDetailsDrawer({
  initial,
  onClose,
  onSaved,
}: {
  initial: SalaryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial.id;
  const { allocationBrands } = useBrands();

  const [form, setForm] = useState<SalaryRow>(() => ({
    expense_name: "",
    expense_type: "recurring",
    category: "Team Salaries",
    expense_scope: "Team-Specific",
    is_recurring: true,
    template_status: "active",
    currency: "INR",
    amount: 0,
    amount_in_inr: 0,
    payment_day: 5,
    recurring_period_start_day: 1,
    recurring_period_end_day: 30,
    employee_name: "",
    role: "",
    department: "",
    payment_mode: "Bank Transfer",
    payment_handler: "",
    notes: "",
    is_shared_expense: false,
    ...initial,
  }));
  const [allocs, setAllocs] = useState<AllocationInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isEdit && initial.id) {
        try {
          const existing = await getAllocations("marketizers_salary_template", initial.id);
          if (existing.length) {
            setAllocs(existing.map((a) => ({ brand_id: a.brand_id, allocation_percentage: Number(a.allocation_percentage) })));
          }
        } catch { /* ignore */ }
      }
    })();
  }, [isEdit, initial.id]);

  const set = (k: keyof SalaryRow, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null);
    if (!form.employee_name?.trim()) return setErr("Employee name is required.");
    const amount = Number(form.amount_in_inr || form.amount || 0);
    if (amount <= 0) return setErr("Salary must be greater than 0.");

    if (form.is_shared_expense) {
      const v = validateAllocationPercentages(allocs);
      if (!v.ok) return setErr(`Allocation must total 100% (currently ${v.total.toFixed(2)}%).`);
    }

    setBusy(true);
    try {
      const payload: Partial<ExpenseTemplate> & { is_shared_expense?: boolean } = {
        expense_name: form.expense_name?.trim() || `${form.employee_name?.trim()} Salary`,
        expense_type: "recurring",
        category: "Team Salaries",
        expense_scope: form.is_shared_expense ? "Shared" : "Team-Specific",
        is_recurring: true,
        template_status: form.template_status ?? "active",
        currency: form.currency ?? "INR",
        amount,
        amount_in_inr: amount,
        conversion_rate: form.conversion_rate ?? null,
        employee_name: form.employee_name?.trim() ?? null,
        role: form.role?.trim() || null,
        department: form.department?.trim() || null,
        payment_day: Number(form.payment_day || 0) || null,
        recurring_period_start_day: Number(form.recurring_period_start_day || 1),
        recurring_period_end_day: Number(form.recurring_period_end_day || 30),
        recurring_start_month: form.recurring_start_month || null,
        recurring_end_month: form.recurring_end_month || null,
        payment_mode: form.payment_mode || null,
        payment_handler: form.payment_handler || null,
        notes: form.notes || null,
        is_shared_expense: !!form.is_shared_expense,
      };

      let templateId = initial.id;
      if (isEdit && templateId) {
        await updateExpenseTemplate(templateId, payload);
      } else {
        const created = await createExpenseTemplate(payload);
        templateId = created.id;
      }

      // Allocations: if shared, save selected; else 100% Marketizers
      if (templateId) {
        let toSave: AllocationInput[] = allocs;
        if (!form.is_shared_expense) {
          // resolve marketizers brand id
          const marketizers = allocationBrands.find((b) => b.slug === "marketizers");
          if (marketizers) {
            toSave = [{ brand_id: marketizers.id, allocation_percentage: 100 }];
          } else {
            toSave = [];
          }
        }
        await saveAllocations("marketizers_salary_template", templateId, amount, toSave);
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={scrim} onClick={onClose}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            {isEdit ? "Salary Details" : "Add Salary"}
          </h3>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={body}>
          {err && <div style={errBox}>{err}</div>}

          <Section title="Core Salary Details">
            <Field label="Employee name"><input style={inputStyle} value={form.employee_name ?? ""} onChange={(e) => set("employee_name", e.target.value)} /></Field>
            <div style={grid2}>
              <Field label="Department"><input style={inputStyle} value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} /></Field>
              <Field label="Role / position"><input style={inputStyle} value={form.role ?? ""} onChange={(e) => set("role", e.target.value)} /></Field>
            </div>
            <div style={grid2}>
              <Field label="Monthly salary (₹)"><input type="number" style={inputStyle} value={form.amount_in_inr ?? 0} onChange={(e) => { const v = Number(e.target.value || 0); set("amount_in_inr", v); set("amount", v); }} /></Field>
              <Field label="Payment day"><input type="number" min={1} max={31} style={inputStyle} value={form.payment_day ?? 5} onChange={(e) => set("payment_day", Number(e.target.value || 0))} /></Field>
            </div>
          </Section>

          <Section title="Shared Brand Allocation">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={!!form.is_shared_expense} onChange={(e) => set("is_shared_expense", e.target.checked)} />
              This salary is shared across multiple brands
            </label>
            {form.is_shared_expense ? (
              <BrandAllocationEditor
                amountInInr={Number(form.amount_in_inr || 0)}
                value={allocs}
                onChange={setAllocs}
                currentBrandSlug="marketizers"
              />
            ) : (
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>Charged 100% to Marketizers.</div>
            )}
          </Section>

          <Section title="Payment & Recurring">
            <div style={grid2}>
              <Field label="Payment mode"><input style={inputStyle} value={form.payment_mode ?? ""} onChange={(e) => set("payment_mode", e.target.value)} /></Field>
              <Field label="Handled by"><input style={inputStyle} value={form.payment_handler ?? ""} onChange={(e) => set("payment_handler", e.target.value)} /></Field>
            </div>
            <div style={grid2}>
              <Field label="Template status">
                <select style={inputStyle} value={form.template_status ?? "active"} onChange={(e) => set("template_status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="review">Review</option>
                </select>
              </Field>
              <Field label="Start month"><input type="month" style={inputStyle} value={form.recurring_start_month ?? ""} onChange={(e) => set("recurring_start_month", e.target.value || null)} /></Field>
            </div>
            <div style={grid2}>
              <Field label="End month (optional)"><input type="month" style={inputStyle} value={form.recurring_end_month ?? ""} onChange={(e) => set("recurring_end_month", e.target.value || null)} /></Field>
              <Field label="Period start day"><input type="number" min={1} max={31} style={inputStyle} value={form.recurring_period_start_day ?? 1} onChange={(e) => set("recurring_period_start_day", Number(e.target.value || 1))} /></Field>
            </div>
            <Field label="Period end day"><input type="number" min={1} max={31} style={inputStyle} value={form.recurring_period_end_day ?? 30} onChange={(e) => set("recurring_period_end_day", Number(e.target.value || 30))} /></Field>
            <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          </Section>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-sm btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save salary"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--parchment2)" }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold3)", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 10 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const scrim: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(28,24,20,.42)", zIndex: 70, display: "flex", justifyContent: "flex-end" };
const drawer: React.CSSProperties = { width: "min(620px,100%)", height: "100%", background: "var(--ivory)", display: "flex", flexDirection: "column", overflow: "hidden" };
const head: React.CSSProperties = { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" };
const body: React.CSSProperties = { padding: 22, overflowY: "auto", flex: 1 };
const errBox: React.CSSProperties = { background: "var(--red-bg)", color: "var(--red)", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 };
