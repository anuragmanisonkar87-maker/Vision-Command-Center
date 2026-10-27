// Add/Edit Expense — guided wizard. Supports one-time, recurring, and template-as-recurring saves.
// Preserves: shared allocations, recurring schedule + template creation, category-specific fields,
// USD→INR conversion, salary/tool/ad/freelancer fields, quick-save selects.
import { useEffect, useMemo, useState } from "react";
import { inputStyle, FieldLabel } from "@/components/marketizers/ui";
import { QuickSaveSelect } from "./QuickSaveSelect";
import {
  createExpenseEntry, updateExpenseEntry, createExpenseTemplate,
  type ExpenseEntry, type ExpenseTemplate,
} from "@/services/marketizers/expensesService";
import { supabase } from "@/integrations/supabase/client";
import { BrandAllocationEditor } from "@/components/allocations/BrandAllocationEditor";
import {
  saveAllocations, getAllocations, validateAllocationPercentages,
  type AllocationInput,
} from "@/services/allocations/sharedExpenseAllocationService";
import {
  WizardStepper, WizardStep, WizardFooter, WizardReviewRow, useWizard,
} from "@/components/ui/WizardForm";

type ClientLite = { id: string; client_name: string };

const DEFAULT_USD_RATE = 83.2;

const STEPS = [
  { key: "type", label: "Type & Scope" },
  { key: "details", label: "Expense Details" },
  { key: "allocation", label: "Allocation" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review & Save" },
];

export function ExpenseDrawer({
  initial, onClose, onSaved,
}: {
  initial?: Partial<ExpenseEntry> & { _saveAsTemplate?: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<ExpenseEntry>>({
    month: new Date().toISOString().slice(0, 7),
    expense_type: "one_time",
    expense_scope: "Company-Wide",
    currency: "INR",
    payment_status: "pending",
    conversion_rate: DEFAULT_USD_RATE,
    ...initial,
  });
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(initial?._saveAsTemplate ?? false);
  const [recurringStart, setRecurringStart] = useState<string>(f.month ?? "");
  const [recurringEnd, setRecurringEnd] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<number>(1);
  const [periodEnd, setPeriodEnd] = useState<number>(30);
  const [paymentDay, setPaymentDay] = useState<number | "">(7);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isShared, setIsShared] = useState<boolean>(Boolean((initial as any)?.is_shared_expense));
  const [allocs, setAllocs] = useState<AllocationInput[]>([]);

  const { current: step, jump, next: wizNext, prev: wizPrev, isLast } = useWizard(STEPS.map((s) => s.key));

  const set = (k: keyof ExpenseEntry, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("marketizers_clients" as any)
      .select("id, client_name").eq("is_deleted", false).order("client_name")
      .then(({ data }) => setClients((data ?? []) as any));
  }, []);

  // Load existing allocations when editing a shared entry
  useEffect(() => {
    if (f.id && isShared) {
      getAllocations("marketizers_expense_entry", f.id)
        .then((rows) => setAllocs(rows.map((r) => ({ brand_id: r.brand_id, allocation_percentage: Number(r.allocation_percentage) }))))
        .catch(() => {});
    }
  }, [f.id, isShared]);

  // Live INR conversion
  const amt = Number(f.amount || 0);
  const rate = Number(f.conversion_rate || DEFAULT_USD_RATE);
  const inr = f.currency === "USD" ? Math.round(amt * rate * 100) / 100 : amt;

  const isRecurring = f.expense_type === "recurring" || saveAsTemplate;
  const isClientSpecific = f.expense_scope === "Client-Specific";

  const showField = {
    salary: f.category === "Team Salaries",
    tool: f.category === "Software & Tools",
    ad: f.category === "Advertising / Internal Marketing",
    freelancer: f.category === "Freelancer / Contractor",
  };

  // ---------- Step validation ----------
  const stepErrors = useMemo(() => {
    const e: string[] = [];
    if (step === 0) {
      if (!f.expense_type) e.push("Expense type is required.");
      if (!f.expense_scope) e.push("Scope is required.");
      if (!f.month) e.push("Month is required.");
      if (isClientSpecific && !f.client_id) e.push("Client is required for client-specific expenses.");
    }
    if (step === 1) {
      if (!f.expense_name?.trim()) e.push("Expense name is required.");
      if (!f.category) e.push("Category is required.");
      if (!(amt > 0)) e.push("Amount must be greater than zero.");
    }
    if (step === 2 && isShared) {
      const v = validateAllocationPercentages(allocs);
      if (!v.ok) e.push(`Brand allocations must total 100% (currently ${v.total.toFixed(2)}%).`);
    }
    return e;
  }, [step, f, amt, isClientSpecific, isShared, allocs]);

  const next = () => {
    if (stepErrors.length) { setErr(stepErrors[0]); return; }
    setErr(null);
    wizNext();
  };
  const prev = () => { setErr(null); wizPrev(); };

  const save = async () => {
    setErr(null);
    // Final validation (mirror old save())
    if (!f.expense_name?.trim()) return setErr("Expense name is required.");
    if (!f.category) return setErr("Category is required.");
    if (!f.month) return setErr("Month is required.");
    if (isShared) {
      const v = validateAllocationPercentages(allocs);
      if (!v.ok) return setErr(`Brand allocations must total 100% (currently ${v.total.toFixed(2)}%).`);
    }
    setBusy(true);
    try {
      const payload: Partial<ExpenseEntry> = { ...f, amount: amt, amount_in_inr: inr, is_shared_expense: isShared } as any;
      let entryId: string | null = f.id ?? null;
      if (f.id) {
        await updateExpenseEntry(f.id, payload);
      } else {
        let templateId: string | null = null;
        if (isRecurring) {
          const tpl = await createExpenseTemplate({
            expense_name: f.expense_name,
            expense_type: "recurring",
            category: f.category,
            expense_scope: f.expense_scope ?? "Company-Wide",
            client_id: f.client_id ?? null,
            amount: amt,
            currency: f.currency ?? "INR",
            conversion_rate: f.currency === "USD" ? rate : null,
            amount_in_inr: inr,
            vendor_or_tool: f.vendor_or_tool ?? null,
            employee_name: f.employee_name ?? null,
            role: f.role ?? null,
            department: f.department ?? null,
            freelancer_name: f.freelancer_name ?? null,
            platform: f.platform ?? null,
            purpose: f.purpose ?? null,
            payment_mode: f.payment_mode ?? null,
            payment_handler: f.payment_handler ?? null,
            impact_type: f.impact_type ?? null,
            receipt_status: f.receipt_status ?? null,
            notes: f.notes ?? null,
            is_recurring: true,
            recurring_start_month: recurringStart || f.month,
            recurring_end_month: recurringEnd || null,
            recurring_period_start_day: periodStart,
            recurring_period_end_day: periodEnd,
            payment_day: paymentDay === "" ? null : Number(paymentDay),
            template_status: "active",
            review_status: "Needed",
            is_shared_expense: isShared,
          } as Partial<ExpenseTemplate>);
          templateId = tpl.id;
          if (isShared) {
            await saveAllocations("marketizers_expense_template", tpl.id, inr, allocs.map((a) => ({ ...a, month: f.month ?? null })));
          }
        }
        const created = await createExpenseEntry({
          ...payload,
          amount: amt, amount_in_inr: inr,
          template_id: templateId,
          is_generated_from_recurring: false,
          expense_type: isRecurring ? "recurring" : "one_time",
        });
        entryId = created.id;
      }
      if (isShared && entryId) {
        await saveAllocations("marketizers_expense_entry", entryId, inr, allocs.map((a) => ({ ...a, month: f.month ?? null })));
      }
      onSaved();
      onClose();
    } catch (e: any) { setErr(e?.message ?? "Save failed."); }
    finally { setBusy(false); }
  };

  const clientName = clients.find((c) => c.id === f.client_id)?.client_name;

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={drawer}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>
            {f.id ? "Edit Expense" : "Add Expense"}
          </h3>
          <button className="btn-sm" onClick={onClose}>×</button>
        </div>

        <WizardStepper steps={STEPS} current={step} onJump={jump} />

        {/* ----- Step 1: Type & Scope ----- */}
        {step === 0 && (
          <WizardStep title="Type & Scope" description="Set the kind of expense and who it belongs to.">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["one_time", "recurring"] as const).map((t) => (
                <button key={t} type="button" className="btn-sm"
                  onClick={() => set("expense_type", t)}
                  style={{ background: f.expense_type === t ? "var(--ink)" : undefined, color: f.expense_type === t ? "var(--parchment)" : undefined }}>
                  {t === "one_time" ? "One-Time" : "Recurring"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["Company-Wide", "Client-Specific", "Team-Specific", "Tool-Specific"] as const).map((s) => (
                <button key={s} type="button" className="btn-sm"
                  onClick={() => set("expense_scope", s)}
                  style={{ background: f.expense_scope === s ? "var(--gold3)" : undefined, color: f.expense_scope === s ? "var(--ink)" : undefined }}>
                  {s}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Row label="Month *"><input type="month" style={inputStyle} value={f.month ?? ""} onChange={(e) => set("month", e.target.value)} /></Row>
              <Row label="Expense Date"><input type="date" style={inputStyle} value={f.expense_date ?? ""} onChange={(e) => set("expense_date", e.target.value)} /></Row>
            </div>

            {isClientSpecific && (
              <Row label="Client *">
                <select style={inputStyle} value={f.client_id ?? ""} onChange={(e) => set("client_id", e.target.value || null)}>
                  <option value="">— Select client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </Row>
            )}

            {isRecurring && (
              <div style={{ background: "var(--parchment2)", padding: 12, borderRadius: 6, display: "grid", gap: 8 }}>
                <div style={labelEyebrow}>Recurring Schedule</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Row label="Start Month"><input type="month" style={inputStyle} value={recurringStart} onChange={(e) => setRecurringStart(e.target.value)} /></Row>
                  <Row label="End Month (optional)"><input type="month" style={inputStyle} value={recurringEnd} onChange={(e) => setRecurringEnd(e.target.value)} /></Row>
                  <Row label="Period Start Day"><input type="number" min={1} max={30} style={inputStyle} value={periodStart} onChange={(e) => setPeriodStart(Math.min(30, Math.max(1, Number(e.target.value))))} /></Row>
                  <Row label="Period End Day"><input type="number" min={1} max={30} style={inputStyle} value={periodEnd} onChange={(e) => setPeriodEnd(Math.min(30, Math.max(1, Number(e.target.value))))} /></Row>
                  <Row label="Payment Day"><input type="number" min={1} max={30} style={inputStyle} value={paymentDay} onChange={(e) => setPaymentDay(e.target.value === "" ? "" : Number(e.target.value))} /></Row>
                </div>
              </div>
            )}
          </WizardStep>
        )}

        {/* ----- Step 2: Details ----- */}
        {step === 1 && (
          <WizardStep title="Expense Details" description="Name, category, and amount.">
            <Row label="Expense Name *">
              <input style={inputStyle} value={f.expense_name ?? ""} onChange={(e) => set("expense_name", e.target.value)} />
            </Row>
            <QuickSaveSelect label="Category" optionType="category" required value={f.category} onChange={(v) => set("category", v)} />

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 8 }}>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <select style={inputStyle} value={f.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)}>
                  <option>INR</option><option>USD</option>
                </select>
              </div>
              <div>
                <FieldLabel>Amount *</FieldLabel>
                <input type="number" style={inputStyle} value={f.amount ?? ""} onChange={(e) => set("amount", Number(e.target.value))} />
              </div>
              {f.currency === "USD" ? (
                <div>
                  <FieldLabel>USD→INR Rate</FieldLabel>
                  <input type="number" step="0.01" style={inputStyle} value={f.conversion_rate ?? DEFAULT_USD_RATE} onChange={(e) => set("conversion_rate", Number(e.target.value))} />
                </div>
              ) : (
                <div>
                  <FieldLabel>INR Equivalent</FieldLabel>
                  <div style={{ ...inputStyle, fontFamily: "'DM Mono',monospace" }}>₹ {inr.toLocaleString("en-IN")}</div>
                </div>
              )}
            </div>
            {f.currency === "USD" && (
              <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: -6, fontFamily: "'DM Mono',monospace" }}>
                ≈ ₹ {inr.toLocaleString("en-IN")}
              </div>
            )}

            {showField.salary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <QuickSaveSelect label="Employee" optionType="employee" value={f.employee_name} onChange={(v) => set("employee_name", v)} />
                <QuickSaveSelect label="Role" optionType="role" value={f.role} onChange={(v) => set("role", v)} />
                <QuickSaveSelect label="Department" optionType="department" value={f.department} onChange={(v) => set("department", v)} />
              </div>
            )}
            {showField.tool && (
              <QuickSaveSelect label="Tool / Vendor" optionType="vendor" value={f.vendor_or_tool} onChange={(v) => set("vendor_or_tool", v)} />
            )}
            {showField.ad && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <QuickSaveSelect label="Platform" optionType="platform" value={f.platform} onChange={(v) => set("platform", v)} />
                <QuickSaveSelect label="Purpose" optionType="purpose" value={f.purpose} onChange={(v) => set("purpose", v)} />
              </div>
            )}
            {showField.freelancer && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <QuickSaveSelect label="Freelancer" optionType="freelancer" value={f.freelancer_name} onChange={(v) => set("freelancer_name", v)} />
                <Row label="Work Type"><input style={inputStyle} value={f.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} /></Row>
              </div>
            )}

            <Row label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Row>
          </WizardStep>
        )}

        {/* ----- Step 3: Allocation ----- */}
        {step === 2 && (
          <WizardStep title="Allocation" description="Split this expense across brands if it is shared.">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--ink2)" }}>
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
              Shared expense (allocate across brands)
            </label>

            {isShared ? (
              <div style={{ background: "var(--parchment2)", padding: 12, borderRadius: 6 }}>
                <div style={{ ...labelEyebrow, marginBottom: 8 }}>Brand Allocation</div>
                <BrandAllocationEditor
                  amountInInr={inr}
                  value={allocs}
                  onChange={setAllocs}
                  currentBrandSlug="marketizers"
                />
              </div>
            ) : (
              <div style={{ padding: 14, background: "var(--parchment2)", borderRadius: 6, fontSize: 12.5, color: "var(--ink4)" }}>
                No allocation required — this expense stays fully on Marketizers
                {isClientSpecific && clientName ? ` (client: ${clientName})` : ""}.
              </div>
            )}
          </WizardStep>
        )}

        {/* ----- Step 4: Payment ----- */}
        {step === 3 && (
          <WizardStep title="Payment Details" description="Status, mode, and receipt.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <QuickSaveSelect label="Payment Status" optionType="payment_status" value={f.payment_status} onChange={(v) => set("payment_status", v)} />
              <QuickSaveSelect label="Payment Mode" optionType="payment_mode" value={f.payment_mode} onChange={(v) => set("payment_mode", v)} />
              <QuickSaveSelect label="Handled By / Payment Handler" optionType="payment_handler" value={f.payment_handler} onChange={(v) => set("payment_handler", v)} />
              <QuickSaveSelect label="Impact Type" optionType="impact_type" value={f.impact_type} onChange={(v) => set("impact_type", v)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <QuickSaveSelect label="Receipt Status" optionType="receipt_status" value={f.receipt_status} onChange={(v) => set("receipt_status", v)} />
              <Row label="Receipt URL (optional)"><input style={inputStyle} placeholder="Paste link…" value={f.receipt_url ?? ""} onChange={(e) => set("receipt_url", e.target.value)} /></Row>
            </div>

            {!f.id && f.expense_type === "one_time" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--ink2)" }}>
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                Also save as recurring template
              </label>
            )}
          </WizardStep>
        )}

        {/* ----- Step 5: Review ----- */}
        {step === 4 && (
          <WizardStep title="Review & Save" description="Confirm before saving.">
            <div>
              <WizardReviewRow label="Type" value={f.expense_type === "recurring" ? "Recurring" : "One-Time"} onEdit={() => jump(0)} />
              <WizardReviewRow label="Scope" value={f.expense_scope} onEdit={() => jump(0)} />
              <WizardReviewRow label="Month" value={f.month} onEdit={() => jump(0)} />
              {isClientSpecific && <WizardReviewRow label="Client" value={clientName || "—"} onEdit={() => jump(0)} />}
              <WizardReviewRow label="Name" value={f.expense_name} onEdit={() => jump(1)} />
              <WizardReviewRow label="Category" value={f.category} onEdit={() => jump(1)} />
              <WizardReviewRow
                label="Amount"
                value={`${f.currency === "USD" ? `$ ${amt.toLocaleString()} (≈ ₹ ${inr.toLocaleString("en-IN")})` : `₹ ${inr.toLocaleString("en-IN")}`}`}
                onEdit={() => jump(1)}
              />
              <WizardReviewRow
                label="Allocation"
                value={isShared ? `Shared across ${allocs.length} brand(s) — ${allocs.reduce((s, a) => s + Number(a.allocation_percentage || 0), 0).toFixed(2)}%` : "Marketizers only"}
                onEdit={() => jump(2)}
              />
              <WizardReviewRow label="Payment Status" value={f.payment_status} onEdit={() => jump(3)} />
              <WizardReviewRow label="Payment Mode" value={f.payment_mode} onEdit={() => jump(3)} />
              <WizardReviewRow label="Receipt" value={f.receipt_url || f.receipt_status} onEdit={() => jump(3)} />
              {saveAsTemplate && <WizardReviewRow label="Template" value="Will also save as recurring template" onEdit={() => jump(3)} />}
            </div>
          </WizardStep>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: 10, background: "var(--red-bg)", color: "var(--red)", borderRadius: 6, fontSize: 12 }}>
            {err}
          </div>
        )}

        <WizardFooter
          onCancel={onClose}
          onPrev={step > 0 ? prev : undefined}
          onNext={!isLast ? next : undefined}
          onSave={isLast ? save : undefined}
          isLast={isLast}
          busy={busy}
          saveLabel={f.id ? "Update Expense" : "Save Expense"}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><FieldLabel>{label}</FieldLabel>{children}</div>;
}

const labelEyebrow: React.CSSProperties = {
  fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--ink4)",
};

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" };
const drawer: React.CSSProperties = { width: "min(560px, 100%)", height: "100%", background: "var(--ivory)", padding: 20, overflowY: "auto" };
