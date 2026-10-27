import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import {
  getMarketizersMonthlyEntryById,
  getMarketizersMonthlyEntryByClientMonth,
  createMarketizersMonthlyEntry,
  updateMarketizersMonthlyEntry,
} from "@/services/marketizers/monthlyEntriesService";
import {
  getClientMonthlyPerformanceSummary,
  type PerformanceSummary,
} from "@/services/marketizers/performanceSummaryService";
import { MarketizersAccessGuard, canEditMarketizersFinance, isAdmin } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, FieldLabel, inputStyle, ErrorBanner } from "@/components/marketizers/ui";
import { WizardStepper, WizardStep, WizardFooter, WizardReviewRow, useWizard } from "@/components/ui/WizardForm";
import {
  type Client, type MonthlyEntry,
  calculateNetProfit, calculateProfitMargin, calculateCollectionPercent,
  calculateClientROAS, calculateCPL, calculateCostPerSale, calculateLeadToSalePercent,
  formatINR, formatPercent, getClientHealthStatus,
} from "@/lib/marketizersFinanceUtils";

export const Route = createFileRoute("/brands/marketizers/revenue/entry")({
  validateSearch: (s: Record<string, unknown>): { entry?: string; clientId?: string } => {
    const out: { entry?: string; clientId?: string } = {};
    if (typeof s.entry === "string" && s.entry) out.entry = s.entry;
    if (typeof s.clientId === "string" && s.clientId) out.clientId = s.clientId;
    return out;
  },
  component: () => (
    <MarketizersAccessGuard>
      <MonthlyEntryFlow />
    </MarketizersAccessGuard>
  ),
});

const REVENUE_MODELS = ["Fixed Retainer", "Revenue Share", "Hybrid", "One-Time Setup", "Performance Bonus", "Other"];
const STATUSES = ["active", "paused", "closed", "trial"];
const STEPS: { key: string; label: string }[] = [
  { key: "client", label: "Client & Month" },
  { key: "revenue", label: "Revenue & Collection" },
  { key: "expenses", label: "Expenses / Adjustments" },
  { key: "performance", label: "Performance Summary" },
  { key: "review", label: "Review & Save" },
];
const DRAFT_KEY = "marketizers_entry_draft_v1";

type FormState = {
  client_id: string;
  month: string;
  revenue_model: string;
  account_status: string;
  marketizers_revenue: string;
  amount_collected: string;
  amount_pending: string;
  client_gross_revenue: string;
  ad_spend: string;
  leads_generated: string;
  qualified_leads: string;
  sales_closed: string;
  total_direct_expense: string;
  notes: string;
};

const empty: FormState = {
  client_id: "", month: new Date().toISOString().slice(0, 7), revenue_model: "", account_status: "active",
  marketizers_revenue: "", amount_collected: "", amount_pending: "", client_gross_revenue: "",
  ad_spend: "", leads_generated: "", qualified_leads: "", sales_closed: "",
  total_direct_expense: "", notes: "",
};

function n(v: string) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }

function MonthlyEntryFlow() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const editingId = search.entry;
  const preselectClientId = search.clientId;
  const { current: step, jump, next: wizardNext, prev: wizardPrev, isLast } = useWizard(STEPS.map((s) => s.key));
  const [form, setForm] = useState<FormState>(empty);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [duplicateExisting, setDuplicateExisting] = useState<MonthlyEntry | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [lockedReadonly, setLockedReadonly] = useState(false);
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  useEffect(() => { document.title = "Monthly Entry | Marketizers | GWV Vision Center"; }, []);

  // Load clients + entry being edited
  useEffect(() => {
    (async () => {
      const cs = await getMarketizersClients();
      setClients(cs);

      if (editingId) {
        const e = await getMarketizersMonthlyEntryById(editingId);
        if (e) {
          if ((e as any).is_locked && !isAdmin()) setLockedReadonly(true);
          setForm({
            client_id: (e as any).client_id, month: (e as any).month,
            revenue_model: (e as any).revenue_model ?? "",
            account_status: (e as any).account_status ?? "active",
            marketizers_revenue: String((e as any).marketizers_revenue ?? ""),
            amount_collected: String((e as any).amount_collected ?? ""),
            amount_pending: String((e as any).amount_pending ?? ""),
            client_gross_revenue: String((e as any).client_gross_revenue ?? ""),
            ad_spend: String((e as any).ad_spend ?? ""),
            leads_generated: String((e as any).leads_generated ?? ""),
            qualified_leads: String((e as any).qualified_leads ?? ""),
            sales_closed: String((e as any).sales_closed ?? ""),
            total_direct_expense: String((e as any).total_direct_expense ?? ""),
            notes: (e as any).notes ?? "",
          });
        }
      } else {
        // Pre-select client if provided via ?clientId=
        if (preselectClientId) {
          setForm((f) => (f.client_id ? f : { ...f, client_id: preselectClientId }));
        }
        // Restore draft
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) { setDraftRestored(true); }
        } catch {}
      }
    })();
  }, [editingId, preselectClientId]);

  // Autosave
  useEffect(() => {
    if (editingId) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [form, editingId]);

  // Duplicate detection
  useEffect(() => {
    if (!form.client_id || !form.month || editingId) { setDuplicateExisting(null); return; }
    (async () => {
      const dup = await getMarketizersMonthlyEntryByClientMonth(form.client_id, form.month);
      setDuplicateExisting(dup);
    })();
  }, [form.client_id, form.month, editingId]);

  // Fetch read-only performance summary (placeholder until Team Performance ships)
  useEffect(() => {
    if (!form.client_id || !form.month) { setPerf(null); return; }
    let cancelled = false;
    setPerfLoading(true);
    getClientMonthlyPerformanceSummary(form.client_id, form.month)
      .then((p) => { if (!cancelled) setPerf(p); })
      .catch(() => { if (!cancelled) setPerf(null); })
      .finally(() => { if (!cancelled) setPerfLoading(false); });
    return () => { cancelled = true; };
  }, [form.client_id, form.month]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setForm(JSON.parse(raw));
    } catch {}
    setDraftRestored(false);
  };
  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftRestored(false);
  };

  // Effective performance values: prefer fetched performance, fall back to
  // any legacy value already on the entry. Finance no longer fills these.
  const effLeads = perf?.leadsGenerated ?? (form.leads_generated ? n(form.leads_generated) : null);
  const effSales = perf?.salesClosed ?? (form.sales_closed ? n(form.sales_closed) : null);

  // Calculations
  const calc = useMemo(() => {
    const rev = n(form.marketizers_revenue), exp = n(form.total_direct_expense);
    const np = calculateNetProfit(rev, exp);
    return {
      netProfit: np,
      margin: calculateProfitMargin(np, rev),
      collectionPct: calculateCollectionPercent(n(form.amount_collected), rev),
      cpl: effLeads ? calculateCPL(n(form.ad_spend), effLeads) : null,
      costPerSale: effSales ? calculateCostPerSale(n(form.ad_spend), effSales) : null,
      roas: calculateClientROAS(n(form.client_gross_revenue), n(form.ad_spend)),
      leadToSale: effLeads && effSales ? calculateLeadToSalePercent(effSales, effLeads) : null,
    };
  }, [form, effLeads, effSales]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (s: number): boolean => {
    const e: typeof errors = {};
    if (s === 0) {
      if (!form.client_id) e.client_id = "Select a client.";
      if (!form.month) e.month = "Month required.";
      else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.month)) e.month = "Format: YYYY-MM";
      if (!form.revenue_model) e.revenue_model = "Required.";
    }
    if (s === 1) {
      const rev = n(form.marketizers_revenue);
      const sum = n(form.amount_collected) + n(form.amount_pending);
      if (rev > 0 && sum > rev + 10) {
        e.amount_pending = "Collected + Pending exceeds revenue (₹10 tolerance).";
      }
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => { if (validateStep(step)) wizardNext(); };
  const back = () => wizardPrev();

  const save = async (lock: boolean) => {
    setSaving(true); setError(null);
    const payload: any = {
      client_id: form.client_id,
      month: form.month,
      revenue_model: form.revenue_model || null,
      account_status: form.account_status || "active",
      marketizers_revenue: n(form.marketizers_revenue),
      amount_collected: n(form.amount_collected),
      amount_pending: n(form.amount_pending),
      client_gross_revenue: n(form.client_gross_revenue),
      ad_spend: n(form.ad_spend),
      // Snapshot fetched performance values when connected; otherwise keep
      // any existing legacy form value (backward compatible).
      leads_generated: effLeads ?? n(form.leads_generated),
      qualified_leads: perf?.qualifiedLeads ?? n(form.qualified_leads),
      sales_closed: effSales ?? n(form.sales_closed),
      total_direct_expense: n(form.total_direct_expense),
      notes: form.notes || null,
    };
    if (lock) {
      payload.is_locked = true;
      payload.locked_at = new Date().toISOString();
    }
    try {
      if (editingId) {
        await updateMarketizersMonthlyEntry(editingId, payload);
      } else if (duplicateExisting) {
        await updateMarketizersMonthlyEntry(duplicateExisting.id, payload);
      } else {
        await createMarketizersMonthlyEntry(payload);
      }
    } catch (err: any) {
      setSaving(false);
      setError(err?.message ?? "Save failed.");
      return;
    }
    setSaving(false);
    clearDraft();
    setSuccess("Entry saved successfully.");
  };

  const selectedClient = clients.find((c) => c.id === form.client_id);

  if (!canEditMarketizersFinance()) {
    // Should be blocked by guard, but defensive
    return null;
  }

  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
        <div className="panel" style={{ padding: "44px 36px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, marginBottom: 10 }}>{success}</h2>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <button className="btn-sm" onClick={() => { setSuccess(null); setForm(empty); jump(0); navigate({ to: "/brands/marketizers/revenue/entry" }); }}>+ Add Another Entry</button>
            <Link to="/brands/marketizers/revenue"><button className="btn-sm btn-primary">Go to Marketizers Dashboard</button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers · Monthly Entry"
        title={editingId ? "Edit Monthly Entry" : "New Monthly Entry"}
        subtitle="Capture one client's revenue, marketing performance, and expenses for a single month."
        actions={<Link to="/brands/marketizers/revenue"><button className="btn-sm">← Back to Dashboard</button></Link>}
      />

      {draftRestored && !editingId && (
        <div style={{ marginBottom: 18, padding: "11px 16px", background: "var(--gold-bg)", border: "1px solid var(--gold-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "var(--gold)" }}>
          <span>Your previous draft has been restored.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-sm" onClick={restoreDraft}>Continue Draft</button>
            <button className="btn-sm" onClick={clearDraft}>Start Fresh</button>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {lockedReadonly && (
        <div style={{ marginBottom: 18, padding: "11px 16px", background: "var(--amber-bg)", border: "1px solid rgba(122,78,16,.2)", borderRadius: 8, fontSize: 12.5, color: "var(--amber)" }}>
          This entry is locked. Only an admin can edit or unlock it.
        </div>
      )}

      <div className="panel" style={{ padding: 20 }}>
        <WizardStepper steps={STEPS} current={step} onJump={jump} />

        <WizardStep
          title={STEPS[step].label}
          description={`Step ${step + 1} of ${STEPS.length}`}
        >
          {step === 0 && (
            <Step1
              form={form} set={set} clients={clients} errors={errors}
              duplicate={duplicateExisting}
            />
          )}
          {step === 1 && <Step2 form={form} set={set} errors={errors} calc={calc} />}
          {step === 2 && <Step4 form={form} set={set} calc={calc} />}
          {step === 3 && <Step3 form={form} set={set} calc={calc} perf={perf} perfLoading={perfLoading} effLeads={effLeads} effSales={effSales} />}
          {step === 4 && (
            <Step5
              form={form} client={selectedClient} calc={calc}
              effLeads={effLeads} effSales={effSales} onEdit={jump}
            />
          )}
        </WizardStep>

        <WizardFooter
          onCancel={() => navigate({ to: "/brands/marketizers/revenue" })}
          onPrev={step > 0 ? back : undefined}
          onNext={!isLast ? next : undefined}
          onSave={isLast ? () => save(false) : undefined}
          saveLabel="Save Monthly Entry"
          isLast={isLast}
          busy={saving}
          saveDisabled={lockedReadonly}
          extraActions={
            isLast ? (
              <button
                type="button" className="btn-sm" onClick={() => save(true)}
                disabled={saving || lockedReadonly}
              >
                Save & Lock Month
              </button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

// ── STEP 1 ────────────────────────────────────────────────────────────────
function Step1({ form, set, clients, errors, duplicate }: any) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <FieldLabel>Client / Partner *</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...inputStyle, flex: 1 }} value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
          <Link to="/brands/marketizers/revenue/clients"><button className="btn-sm">+ Add Client</button></Link>
        </div>
        {errors.client_id && <FieldErr msg={errors.client_id} />}
        {duplicate && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--amber-bg)", border: "1px solid rgba(122,78,16,.2)", borderRadius: 6, fontSize: 12.5, color: "var(--amber)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>This client already has an entry for this month.</span>
            <Link to="/brands/marketizers/revenue/entry" search={{ entry: duplicate.id } as any}>
              <button className="btn-sm">Edit Existing Entry</button>
            </Link>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <FieldLabel>Month (YYYY-MM) *</FieldLabel>
          <input type="month" style={inputStyle} value={form.month} onChange={(e) => set("month", e.target.value)} />
          {errors.month && <FieldErr msg={errors.month} />}
        </div>
        <div>
          <FieldLabel>Account Status</FieldLabel>
          <select style={inputStyle} value={form.account_status} onChange={(e) => set("account_status", e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>Revenue Model *</FieldLabel>
        <select style={inputStyle} value={form.revenue_model} onChange={(e) => set("revenue_model", e.target.value)}>
          <option value="">Select…</option>
          {REVENUE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {errors.revenue_model && <FieldErr msg={errors.revenue_model} />}
      </div>
    </div>
  );
}

// ── STEP 2 ────────────────────────────────────────────────────────────────
function Step2({ form, set, errors, calc }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <NumField label="Marketizers Revenue Earned (₹)" value={form.marketizers_revenue} onChange={(v: string) => set("marketizers_revenue", v)} hint="Actual revenue earned by Marketizers from this client." />
      <NumField label="Amount Collected (₹)" value={form.amount_collected} onChange={(v: string) => set("amount_collected", v)} />
      <NumField label="Amount Pending (₹)" value={form.amount_pending} onChange={(v: string) => set("amount_pending", v)} error={errors.amount_pending} />
      <NumField label="Client Gross Revenue (₹)" value={form.client_gross_revenue} onChange={(v: string) => set("client_gross_revenue", v)} hint="Revenue generated for the client through campaigns/funnel." />
      <div style={{ gridColumn: "1 / -1", padding: "12px 14px", background: "var(--parchment)", borderRadius: 6, fontSize: 12, color: "var(--ink3)", fontFamily: "'DM Mono',monospace" }}>
        Collection: {formatPercent(calc.collectionPct)}
      </div>
    </div>
  );
}

// ── STEP 3 ────────────────────────────────────────────────────────────────
// Finance only enters Ad Spend. Performance metrics (leads, qualified, sales)
// are read-only — they will flow from the Team Performance / Media Buyer
// Daily Reporting module when it ships.
function Step3({ form, set, calc, perf, perfLoading, effLeads, effSales }: any) {
  const fmt = (v: number | null) => (v === null || v === undefined ? "—" : String(v));
  const connected = perf?.isConnected;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <NumField
        label="Ad Spend (₹)"
        value={form.ad_spend}
        onChange={(v: string) => set("ad_spend", v)}
        hint="Finance can verify this from Ads Manager."
      />

      <div style={{ padding: "12px 14px", background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Performance Data</div>
            <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>
              Auto-fetched from Team Performance module. Finance does not edit these.
            </div>
          </div>
          <span className={`status-pill ${connected ? "sp-profit" : "sp-warn"}`}>
            {perfLoading ? "Loading…" : connected ? "Connected" : "Not connected yet"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <PreviewMini label="Leads Generated" value={fmt(effLeads)} />
          <PreviewMini label="Qualified / Calls" value={fmt(perf?.qualifiedLeads ?? perf?.callsBooked ?? null)} />
          <PreviewMini label="Sales Closed" value={fmt(effSales)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <PreviewMini label="CPL" value={calc.cpl !== null ? formatINR(calc.cpl) : "Not enough data"} />
        <PreviewMini label="Cost Per Sale" value={calc.costPerSale !== null ? formatINR(calc.costPerSale) : "Not enough data"} />
        <PreviewMini label="Client ROAS" value={calc.roas !== null ? `${calc.roas.toFixed(2)}x` : "Not enough data"} />
        <PreviewMini label="Lead → Sale" value={calc.leadToSale !== null ? formatPercent(calc.leadToSale) : "Not enough data"} />
      </div>
    </div>
  );
}

// ── STEP 4 ────────────────────────────────────────────────────────────────
function Step4({ form, set, calc }: any) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <NumField
        label="Total Direct Client Expense (₹)"
        value={form.total_direct_expense}
        onChange={(v: string) => set("total_direct_expense", v)}
        hint="Use this only for direct client-level costs. Company salaries, shared rent, tools, and operating expenses should be managed in Expenses Center."
      />
      <div>
        <FieldLabel>Expense Notes / Breakdown</FieldLabel>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <PreviewMini label="Net Profit (est.)" value={formatINR(calc.netProfit)} />
        <PreviewMini label="Profit Margin" value={formatPercent(calc.margin)} />
      </div>
    </div>
  );
}

// ── STEP 5 ────────────────────────────────────────────────────────────────
function Step5({ form, client, calc, effLeads, effSales, onEdit }: any) {
  const fakeEntry: MonthlyEntry = {
    id: "", client_id: form.client_id, month: form.month,
    revenue_model: form.revenue_model, account_status: form.account_status,
    marketizers_revenue: n(form.marketizers_revenue),
    amount_collected: n(form.amount_collected),
    amount_pending: n(form.amount_pending),
    client_gross_revenue: n(form.client_gross_revenue),
    ad_spend: n(form.ad_spend),
    leads_generated: effLeads ?? 0,
    qualified_leads: n(form.qualified_leads),
    sales_closed: effSales ?? 0,
    total_direct_expense: n(form.total_direct_expense),
    notes: form.notes, is_locked: false, is_deleted: false,
  };
  const health = getClientHealthStatus(fakeEntry, null);
  const rev = n(form.marketizers_revenue);
  const pending = n(form.amount_pending);

  const warnings: string[] = [];
  if (!form.client_id) warnings.push("Client is missing.");
  if (!form.month) warnings.push("Month is missing.");
  if (rev === 0) warnings.push("Revenue earned is zero.");
  if (pending > 0) warnings.push(`Amount pending: ${formatINR(pending)} — will create a follow-up.`);

  const editStep = (i: number) => () => onEdit && onEdit(i);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <WizardReviewRow label="Client" value={client?.client_name ?? "—"} onEdit={editStep(0)} />
        <WizardReviewRow label="Month" value={form.month} onEdit={editStep(0)} />
        <WizardReviewRow label="Revenue Model" value={form.revenue_model || "—"} onEdit={editStep(0)} />
        <WizardReviewRow label="Marketizers Revenue" value={formatINR(rev)} onEdit={editStep(1)} />
        <WizardReviewRow label="Collected" value={formatINR(n(form.amount_collected))} onEdit={editStep(1)} />
        <WizardReviewRow label="Pending" value={formatINR(pending)} onEdit={editStep(1)} />
        <WizardReviewRow label="Client Gross Revenue" value={formatINR(n(form.client_gross_revenue))} onEdit={editStep(1)} />
        <WizardReviewRow label="Direct Client Expense" value={formatINR(n(form.total_direct_expense))} onEdit={editStep(2)} />
        <WizardReviewRow label="Net Profit (est.)" value={formatINR(calc.netProfit)} />
        <WizardReviewRow label="Profit Margin" value={formatPercent(calc.margin)} />
        <WizardReviewRow label="Collection %" value={formatPercent(calc.collectionPct)} />
        <WizardReviewRow label="Ad Spend" value={formatINR(n(form.ad_spend))} onEdit={editStep(3)} />
        <WizardReviewRow label="Leads (fetched)" value={effLeads === null ? "Not connected" : String(effLeads)} />
        <WizardReviewRow label="Sales Closed (fetched)" value={effSales === null ? "Not connected" : String(effSales)} />
        <WizardReviewRow label="Client ROAS" value={calc.roas !== null ? `${calc.roas.toFixed(2)}x` : "—"} />
        <WizardReviewRow label="Health Status" value={health} />
      </div>
      {warnings.length > 0 && (
        <div style={{ padding: "11px 14px", background: "var(--amber-bg)", border: "1px solid rgba(122,78,16,.2)", borderRadius: 6, fontSize: 12.5, color: "var(--amber)" }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 6 }}>Warnings</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── small helpers ────────────────────────────────────────────────────────
function NumField({ label, value, onChange, hint, error, integer }: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string; integer?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number" min={0} step={integer ? 1 : "any"}
        style={inputStyle} value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 4 }}>{hint}</div>}
      {error && <FieldErr msg={error} />}
    </div>
  );
}
function FieldErr({ msg }: { msg: string }) {
  return <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>{msg}</div>;
}
function PreviewMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 6 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
