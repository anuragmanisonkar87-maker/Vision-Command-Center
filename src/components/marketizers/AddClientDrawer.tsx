import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createMarketizersClient,
  updateMarketizersClient,
  getMarketizersClientById,
  type ClientInput,
} from "@/services/marketizers/clientsService";
import {
  listQuickSaveOptions,
  addQuickSaveOption,
} from "@/services/marketizers/quickSaveOptionsService";
import { FieldLabel, ErrorBanner, inputStyle } from "@/components/marketizers/ui";
import { QuickSaveSelect } from "@/components/marketizers/QuickSaveSelect";
import { canEditMarketizersFinance } from "@/components/marketizers/MarketizersAccessGuard";
import type { Client } from "@/types/marketizers";
import { formatINR } from "@/utils/formatters/format";

// -------------------- option defaults --------------------
const NICHE_DEFAULTS = [
  "Sound Healing Certification",
  "Wedding Photographer Coaching",
  "High-Achieving Women Life Coaching",
  "Parenting Workshop",
  "Dance",
  "E-commerce / Retail Expansion",
];
const BUSINESS_CATEGORY_DEFAULTS = [
  "Coaching", "Consulting", "Education", "Wellness",
  "E-commerce", "Service Business", "Creator / Influencer",
];
const STATUS_DEFAULTS = ["Active", "Paused", "Trial", "On Hold", "Completed", "Inactive"];
const STAGE_DEFAULTS = ["Trial", "Onboarding", "Active Delivery", "Scaling", "At Risk", "Paused", "Closed"];
const REVENUE_MODEL_DEFAULTS = [
  "Fixed Retainer", "Revenue Share", "Hybrid",
  "Performance Bonus", "One-Time Setup", "Trial", "Custom",
];
const BILLING_CYCLE_DEFAULTS = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"];
const BILLING_DATE_DEFAULTS = ["1st of every month", "5th of every month", "10th of every month", "15th of every month", "Custom"];
const COLLECTION_DUE_DEFAULTS = ["Same day", "Within 7 days", "Within 15 days", "Within 30 days", "Custom"];
const REVENUE_BASE_DEFAULTS = ["Gross Revenue", "Net Revenue", "Collected Revenue", "Profit", "Custom"];
const SETTLEMENT_FREQ_DEFAULTS = ["Monthly", "Twice a Month", "Weekly", "Quarterly"];
const REVENUE_SOURCE_DEFAULTS = ["Client Sheet", "Payment Gateway", "Razorpay", "Shopify", "Manual Entry", "Bank Statement", "CRM", "WhatsApp Confirmation", "Custom"];
const BONUS_TRIGGER_DEFAULTS = ["Revenue crosses target", "ROAS crosses target", "Sales cross target", "Lead volume crosses target", "Profit crosses target", "Custom"];
const BONUS_TYPE_DEFAULTS = ["Fixed Amount", "Percentage", "Tiered Bonus"];
const METRIC_USED_DEFAULTS = ["Revenue", "Collected Revenue", "Sales", "Profit", "ROAS", "Qualified Leads"];
const PAYMENT_STATUS_DEFAULTS = ["Pending", "Partially Paid", "Paid", "Waived"];
const TRIAL_DURATION_DEFAULTS = ["7 Days", "14 Days", "30 Days", "Custom"];
const RISK_DEFAULTS = ["Low", "Medium", "High", "Critical"];
const MANAGER_DEFAULTS = ["Rohan Sharma", "Aisha Khan", "Swati", "Abdullah Ansari"];

// -------------------- types --------------------
type Draft = {
  id?: string;
  // identity
  client_name: string;
  founder_name: string;
  phone: string;
  email: string;
  website_url: string;
  social_url: string;
  // business
  niche: string;
  business_category: string;
  start_date: string;
  status: string;
  client_stage: string;
  // revenue model
  revenue_model: string;
  monthly_retainer_amount: string;
  billing_cycle: string;
  billing_date: string;
  collection_due_date: string;
  gst_applicable: boolean;
  revenue_share_percentage: string;
  revenue_base: string;
  settlement_frequency: string;
  minimum_guarantee: string;
  revenue_tracking_source: string;
  revenue_tracking_sources: string[];
  base_retainer_amount: string;
  bonus_trigger: string;
  trigger_target_value: string;
  bonus_type: string;
  bonus_amount: string;
  metric_used: string;
  setup_fee: string;
  setup_payment_status: string;
  setup_delivery_deadline: string;
  setup_scope: string;
  trial_duration: string;
  trial_fee: string;
  trial_end_date: string;
  trial_conversion_plan: string;
  custom_revenue_terms: string;
  expected_monthly_revenue: string;
  billing_notes: string;
  // ownership
  assigned_manager: string;
  account_owner: string;
  media_buyer: string;
  sales_owner: string;
  // notes & status
  notes: string;
  client_risk: string;
  payment_risk: string;
  important_reminder: string;
};

const empty: Draft = {
  client_name: "", founder_name: "", phone: "", email: "", website_url: "", social_url: "",
  niche: "", business_category: "", start_date: "", status: "Active", client_stage: "",
  revenue_model: "", monthly_retainer_amount: "", billing_cycle: "", billing_date: "",
  collection_due_date: "", gst_applicable: false, revenue_share_percentage: "",
  revenue_base: "", settlement_frequency: "", minimum_guarantee: "",
  revenue_tracking_source: "", revenue_tracking_sources: [], base_retainer_amount: "", bonus_trigger: "",
  trigger_target_value: "", bonus_type: "", bonus_amount: "", metric_used: "",
  setup_fee: "", setup_payment_status: "", setup_delivery_deadline: "", setup_scope: "",
  trial_duration: "", trial_fee: "", trial_end_date: "", trial_conversion_plan: "",
  custom_revenue_terms: "", expected_monthly_revenue: "", billing_notes: "",
  assigned_manager: "", account_owner: "", media_buyer: "", sales_owner: "",
  notes: "", client_risk: "", payment_risk: "", important_reminder: "",
};

function toClientInput(d: Draft): ClientInput {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const txt = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    client_name: d.client_name.trim(),
    founder_name: txt(d.founder_name),
    niche: txt(d.niche),
    revenue_model: d.revenue_model,
    start_date: txt(d.start_date),
    status: d.status || "Active",
    assigned_manager: txt(d.assigned_manager),
    notes: txt(d.notes),
    phone: txt(d.phone),
    email: txt(d.email),
    website_url: txt(d.website_url),
    social_url: txt(d.social_url),
    business_category: txt(d.business_category),
    client_stage: txt(d.client_stage),
    monthly_retainer_amount: num(d.monthly_retainer_amount),
    billing_cycle: txt(d.billing_cycle),
    billing_date: txt(d.billing_date),
    collection_due_date: txt(d.collection_due_date),
    gst_applicable: d.gst_applicable,
    revenue_share_percentage: num(d.revenue_share_percentage),
    revenue_base: txt(d.revenue_base),
    settlement_frequency: txt(d.settlement_frequency),
    minimum_guarantee: num(d.minimum_guarantee),
    revenue_tracking_source: d.revenue_tracking_sources[0] ?? txt(d.revenue_tracking_source),
    revenue_tracking_sources: d.revenue_tracking_sources.length ? d.revenue_tracking_sources : null,
    base_retainer_amount: num(d.base_retainer_amount),
    bonus_trigger: txt(d.bonus_trigger),
    trigger_target_value: num(d.trigger_target_value),
    bonus_type: txt(d.bonus_type),
    bonus_amount: num(d.bonus_amount),
    metric_used: txt(d.metric_used),
    setup_fee: num(d.setup_fee),
    setup_payment_status: txt(d.setup_payment_status),
    setup_delivery_deadline: txt(d.setup_delivery_deadline),
    setup_scope: txt(d.setup_scope),
    trial_duration: txt(d.trial_duration),
    trial_fee: num(d.trial_fee),
    trial_end_date: txt(d.trial_end_date),
    trial_conversion_plan: txt(d.trial_conversion_plan),
    custom_revenue_terms: txt(d.custom_revenue_terms),
    expected_monthly_revenue: num(d.expected_monthly_revenue),
    billing_notes: txt(d.billing_notes),
    account_owner: txt(d.account_owner),
    media_buyer: txt(d.media_buyer),
    sales_owner: txt(d.sales_owner),
    client_risk: txt(d.client_risk),
    payment_risk: txt(d.payment_risk),
    important_reminder: txt(d.important_reminder),
  };
}

function fromClient(c: Client | null | undefined): Draft {
  if (!c) return { ...empty };
  const a = c as any;
  const s = (v: any) => (v === null || v === undefined ? "" : String(v));
  return {
    id: c.id,
    client_name: c.client_name,
    founder_name: s(c.founder_name),
    phone: s(a.phone), email: s(a.email),
    website_url: s(a.website_url), social_url: s(a.social_url),
    niche: s(c.niche), business_category: s(a.business_category),
    start_date: s(c.start_date), status: c.status || "Active",
    client_stage: s(a.client_stage),
    revenue_model: c.revenue_model || "",
    monthly_retainer_amount: s(a.monthly_retainer_amount),
    billing_cycle: s(a.billing_cycle), billing_date: s(a.billing_date),
    collection_due_date: s(a.collection_due_date),
    gst_applicable: !!a.gst_applicable,
    revenue_share_percentage: s(a.revenue_share_percentage),
    revenue_base: s(a.revenue_base),
    settlement_frequency: s(a.settlement_frequency),
    minimum_guarantee: s(a.minimum_guarantee),
    revenue_tracking_source: s(a.revenue_tracking_source),
    revenue_tracking_sources: Array.isArray(a.revenue_tracking_sources) && a.revenue_tracking_sources.length
      ? a.revenue_tracking_sources.filter((x: any) => typeof x === "string" && x)
      : (a.revenue_tracking_source ? [String(a.revenue_tracking_source)] : []),
    base_retainer_amount: s(a.base_retainer_amount),
    bonus_trigger: s(a.bonus_trigger),
    trigger_target_value: s(a.trigger_target_value),
    bonus_type: s(a.bonus_type),
    bonus_amount: s(a.bonus_amount),
    metric_used: s(a.metric_used),
    setup_fee: s(a.setup_fee),
    setup_payment_status: s(a.setup_payment_status),
    setup_delivery_deadline: s(a.setup_delivery_deadline),
    setup_scope: s(a.setup_scope),
    trial_duration: s(a.trial_duration),
    trial_fee: s(a.trial_fee),
    trial_end_date: s(a.trial_end_date),
    trial_conversion_plan: s(a.trial_conversion_plan),
    custom_revenue_terms: s(a.custom_revenue_terms),
    expected_monthly_revenue: s(a.expected_monthly_revenue),
    billing_notes: s(a.billing_notes),
    assigned_manager: s(c.assigned_manager),
    account_owner: s(a.account_owner),
    media_buyer: s(a.media_buyer),
    sales_owner: s(a.sales_owner),
    notes: s(c.notes),
    client_risk: s(a.client_risk),
    payment_risk: s(a.payment_risk),
    important_reminder: s(a.important_reminder),
  };
}

// -------------------- props --------------------
export type AddClientDrawerProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (clientId: string) => void;
  onSavedAndAddEntry?: (clientId: string) => void;
  initial?: Client | null;
};

// -------------------- component --------------------
export function AddClientDrawer({
  open, onClose, onSaved, onSavedAndAddEntry, initial,
}: AddClientDrawerProps) {
  const editing = !!initial?.id;
  const [draft, setDraft] = useState<Draft>(() => fromClient(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = canEditMarketizersFinance();

  useEffect(() => {
    if (!open) return;
    setDraft(fromClient(initial));
    setError(null);
    // Safety fallback: list views fetch a slim column set, so when editing an
    // existing client the extended revenue/ownership fields can be missing.
    // Re-hydrate from the full row if we detect a likely-truncated record.
    const id = initial?.id;
    if (!id) return;
    const anyInitial = initial as any;
    const looksTruncated =
      anyInitial?.revenue_share_percentage === undefined &&
      anyInitial?.revenue_tracking_sources === undefined &&
      anyInitial?.revenue_tracking_source === undefined &&
      anyInitial?.monthly_retainer_amount === undefined &&
      anyInitial?.settlement_frequency === undefined;
    if (!looksTruncated) return;
    let cancelled = false;
    getMarketizersClientById(id)
      .then((full) => {
        if (cancelled || !full) return;
        setDraft(fromClient(full as any));
      })
      .catch(() => { /* keep current draft; surfaced on save if needed */ });
    return () => { cancelled = true; };
  }, [open, initial]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const validate = (): string | null => {
    if (!draft.client_name.trim()) return "Client name is required.";
    if (!draft.revenue_model) return "Revenue model is required.";
    if (!draft.status) return "Status is required.";
    if (!draft.niche.trim()) return "Niche is required.";
    if (!draft.assigned_manager.trim()) return "Assigned manager is required.";
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) return "Email looks invalid.";
    const url = (v: string) => !v || /^https?:\/\//i.test(v);
    if (!url(draft.website_url)) return "Website URL must start with http(s)://";
    if (!url(draft.social_url)) return "Social URL must start with http(s)://";

    switch (draft.revenue_model) {
      case "Fixed Retainer":
        if (!draft.monthly_retainer_amount) return "Monthly retainer amount is required.";
        break;
      case "Revenue Share":
        if (!draft.revenue_share_percentage) return "Revenue share % is required.";
        if (!draft.revenue_base) return "Revenue base is required.";
        break;
      case "Hybrid":
        if (!draft.base_retainer_amount) return "Base retainer is required.";
        if (!draft.revenue_share_percentage) return "Revenue share % is required.";
        if (!draft.revenue_base) return "Revenue base is required.";
        break;
      case "Performance Bonus":
        if (!draft.bonus_trigger) return "Bonus trigger is required.";
        break;
      case "One-Time Setup":
        if (!draft.setup_fee) return "Setup fee is required.";
        break;
      case "Custom":
        if (!draft.custom_revenue_terms.trim()) return "Custom revenue terms are required.";
        break;
    }
    return null;
  };

  const persist = async (): Promise<string | null> => {
    const v = validate();
    if (v) { setError(v); return null; }
    setSaving(true); setError(null);
    try {
      const payload = toClientInput(draft);
      let id = draft.id ?? "";
      if (draft.id) {
        await updateMarketizersClient(draft.id, payload);
      } else {
        id = await createMarketizersClient(payload);
      }
      return id;
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const id = await persist();
    if (!id) return;
    toast.success(editing ? "Client updated." : "Client added successfully.");
    onSaved?.(id);
    onClose();
  };
  const handleSaveAndEntry = async () => {
    const id = await persist();
    if (!id) return;
    toast.success("Client saved. Add monthly entry now.");
    onSavedAndAddEntry?.(id);
    onClose();
  };

  // ---------- step state + per-step validation (5-step wizard) ----------
  const totalSteps = 5;
  const [step, setStep] = useState(1);
  useEffect(() => { if (open) setStep(1); }, [open]);

  // Validates that everything required to *leave* step `s` is satisfied.
  const validateStep = (s: number): string | null => {
    const url = (v: string) => !v || /^https?:\/\//i.test(v);
    if (s >= 1) {
      // Identity
      if (!draft.client_name.trim()) return "Client name is required.";
      if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) return "Email looks invalid.";
      if (!url(draft.website_url)) return "Website URL must start with http(s)://";
      if (!url(draft.social_url)) return "Social URL must start with http(s)://";
    }
    if (s >= 2) {
      // Business Profile
      if (!draft.niche.trim()) return "Niche is required.";
      if (!draft.status) return "Client status is required.";
    }
    if (s >= 3) {
      // Revenue Setup
      if (!draft.revenue_model) return "Revenue model is required.";
      switch (draft.revenue_model) {
        case "Fixed Retainer":
          if (!draft.monthly_retainer_amount) return "Monthly retainer amount is required.";
          break;
        case "Revenue Share":
          if (!draft.revenue_share_percentage) return "Revenue share % is required.";
          if (!draft.revenue_base) return "Revenue base is required.";
          break;
        case "Hybrid":
          if (!draft.base_retainer_amount) return "Base retainer is required.";
          if (!draft.revenue_share_percentage) return "Revenue share % is required.";
          if (!draft.revenue_base) return "Revenue base is required.";
          break;
        case "Performance Bonus":
          if (!draft.bonus_trigger) return "Bonus trigger is required.";
          break;
        case "One-Time Setup":
          if (!draft.setup_fee) return "Setup fee is required.";
          break;
        case "Custom":
          if (!draft.custom_revenue_terms.trim()) return "Custom revenue terms are required.";
          break;
      }
    }
    if (s >= 4) {
      // Ownership, Ads & Risk
      if (!draft.assigned_manager.trim()) return "Assigned manager is required.";
    }
    return null;
  };

  const goNext = () => {
    const v = validateStep(step);
    if (v) { setError(v); return; }
    setError(null);
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const goPrev = () => { setError(null); setStep((s) => Math.max(1, s - 1)); };
  const jumpTo = (n: number) => {
    if (n <= step) { setError(null); setStep(n); return; }
    for (let i = step; i < n; i++) {
      const v = validateStep(i);
      if (v) { setError(v); return; }
    }
    setError(null);
    setStep(n);
  };

  if (!open) return null;
  if (!canEdit) {
    return (
      <DrawerShell title="Add Client" onClose={onClose}>
        <ErrorBanner message="You do not have permission to add or edit clients." />
      </DrawerShell>
    );
  }

  const isLast = step === totalSteps;
  return (
    <DrawerShell
      title={editing ? "Edit Client" : "Add Client"}
      subtitle="Create a Marketizers client account and define the revenue model, ownership, and billing setup."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <span style={{ flex: 1 }} />
          {step > 1 && (
            <button type="button" className="btn-sm" onClick={goPrev} disabled={saving}>← Previous</button>
          )}
          {!isLast && (
            <button type="button" className="btn-sm btn-primary" onClick={goNext} disabled={saving}>Next →</button>
          )}
          {isLast && (
            <>
              <button type="button" className="btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Client"}
              </button>
              {!editing && (
                <button
                  type="button"
                  className="btn-sm"
                  style={{ background: "var(--gold, #c9a14a)", color: "var(--ink)", borderColor: "var(--gold, #c9a14a)" }}
                  onClick={handleSaveAndEntry}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save & Add Monthly Entry"}
                </button>
              )}
            </>
          )}
        </>
      }
    >
      <Stepper step={step} onJump={jumpTo} />
      {error && <ErrorBanner message={error} />}

      {step === 1 && (
        <Section title="Client Identity">
          <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "0 0 14px" }}>
            Who is this client and how do we reach them?
          </p>
          <SubHead>Client Details</SubHead>
          <Grid>
            <Input label="Client Name *" value={draft.client_name} onChange={(v) => set("client_name", v)} />
            <Input label="Founder Name" value={draft.founder_name} onChange={(v) => set("founder_name", v)} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Contact</SubHead>
          <Grid>
            <Input label="Phone" value={draft.phone} onChange={(v) => set("phone", v)} />
            <Input label="Email" type="email" value={draft.email} onChange={(v) => set("email", v)} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Links</SubHead>
          <Grid>
            <Input label="Website / Funnel URL" value={draft.website_url} onChange={(v) => set("website_url", v)} placeholder="https://…" />
            <Input label="Instagram / Social Link" value={draft.social_url} onChange={(v) => set("social_url", v)} placeholder="https://…" />
          </Grid>
        </Section>
      )}

      {step === 2 && (
        <Section title="Business Profile">
          <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "0 0 14px" }}>
            What kind of business is this and where are they in the lifecycle?
          </p>
          <SubHead>Niche</SubHead>
          <Grid>
            <QuickSaveSelect required label="Niche" group="niche" value={draft.niche} onChange={(v) => set("niche", v)} defaults={NICHE_DEFAULTS} />
            <QuickSaveSelect label="Business Category" group="business_category" value={draft.business_category} onChange={(v) => set("business_category", v)} defaults={BUSINESS_CATEGORY_DEFAULTS} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Status</SubHead>
          <Grid>
            <Input label="Start Date" type="date" value={draft.start_date} onChange={(v) => set("start_date", v)} />
            <QuickSaveSelect required label="Client Status" group="client_status" value={draft.status} onChange={(v) => set("status", v)} defaults={STATUS_DEFAULTS} />
            <QuickSaveSelect label="Client Stage" group="client_stage" value={draft.client_stage} onChange={(v) => set("client_stage", v)} defaults={STAGE_DEFAULTS} />
          </Grid>
        </Section>
      )}

      {step === 3 && (
        <Section title="Revenue Setup">
          <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "0 0 14px" }}>
            How does Marketizers earn from this client?
          </p>
          <SubHead>Revenue Model</SubHead>
          <QuickSaveSelect required label="Revenue Model" group="revenue_model" value={draft.revenue_model} onChange={(v) => set("revenue_model", v)} defaults={REVENUE_MODEL_DEFAULTS} />
          {draft.revenue_model && (
            <>
              <div style={{ height: 14 }} />
              <SubHead>{draft.revenue_model} Details</SubHead>
              <RevenueModelFields draft={draft} set={set} />
              <div style={{ height: 18 }} />
              <div style={{
                padding: 14, borderRadius: 8,
                background: "var(--parchment)", border: "1px solid var(--border)",
                borderLeft: "3px solid var(--gold, #c9a14a)",
              }}>
                <SubHead>Revenue Preview</SubHead>
                <RevenuePreview draft={draft} />
              </div>
            </>
          )}
        </Section>
      )}

      {step === 4 && (
        <Section title="Ownership, Ads & Risk">
          <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "0 0 14px" }}>
            Assign internal owners, ad responsibility, and risk flags.
          </p>
          <SubHead>Management</SubHead>
          <Grid>
            <QuickSaveSelect required label="Assigned Manager" group="assigned_manager" value={draft.assigned_manager} onChange={(v) => set("assigned_manager", v)} defaults={MANAGER_DEFAULTS} />
            <QuickSaveSelect label="Account Owner" group="account_owner" value={draft.account_owner} onChange={(v) => set("account_owner", v)} defaults={MANAGER_DEFAULTS} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Ad Client Box</SubHead>
          <Grid>
            <QuickSaveSelect label="Media Buyer" group="media_buyer" value={draft.media_buyer} onChange={(v) => set("media_buyer", v)} defaults={MANAGER_DEFAULTS} />
            <QuickSaveSelect label="Sales Owner" group="sales_owner" value={draft.sales_owner} onChange={(v) => set("sales_owner", v)} defaults={MANAGER_DEFAULTS} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Risk</SubHead>
          <Grid>
            <QuickSaveSelect label="Client Risk" group="client_risk" value={draft.client_risk} onChange={(v) => set("client_risk", v)} defaults={RISK_DEFAULTS} />
            <QuickSaveSelect label="Payment Risk" group="payment_risk" value={draft.payment_risk} onChange={(v) => set("payment_risk", v)} defaults={RISK_DEFAULTS} />
          </Grid>
          <div style={{ height: 14 }} />
          <SubHead>Notes</SubHead>
          <Textarea label="Internal Notes" value={draft.notes} onChange={(v) => set("notes", v)} />
          <div style={{ height: 12 }} />
          <Textarea label="Important Reminder" value={draft.important_reminder} onChange={(v) => set("important_reminder", v)} />
        </Section>
      )}

      {step === 5 && <ReviewStep draft={draft} onJump={jumpTo} />}
    </DrawerShell>
  );
}

// -------------------- stepper + review --------------------
function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  const items: Array<{ n: number; label: string }> = [
    { n: 1, label: "Identity" },
    { n: 2, label: "Business" },
    { n: 3, label: "Revenue" },
    { n: 4, label: "Ownership" },
    { n: 5, label: "Review" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
      {items.map((it) => {
        const active = it.n === step;
        const done = it.n < step;
        return (
          <button
            key={it.n}
            type="button"
            onClick={() => onJump(it.n)}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12,
              fontFamily: "'DM Mono',monospace", letterSpacing: ".06em",
              textTransform: "uppercase",
              border: "1px solid " + (active ? "var(--ink)" : "var(--border)"),
              background: active ? "var(--ink)" : done ? "var(--parchment)" : "var(--ivory)",
              color: active ? "var(--ivory)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {it.n}. {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: ".14em",
      textTransform: "uppercase", color: "var(--ink2)", margin: "0 0 10px",
    }}>{children}</div>
  );
}

function ReviewStep({ draft, onJump }: { draft: Draft; onJump: (n: number) => void }) {
  const Row = ({ k, v }: { k: string; v?: string | null }) =>
    v ? (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "4px 0" }}>
        <span style={{ color: "var(--ink4)", fontFamily: "'DM Mono',monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
        <span style={{ color: "var(--ink)", fontWeight: 600, textAlign: "right" }}>{v}</span>
      </div>
    ) : null;
  const EditBtn = ({ to }: { to: number }) => (
    <button type="button" className="btn-sm" style={{ float: "right" }} onClick={() => onJump(to)}>Edit</button>
  );
  return (
    <>
      <Section title="Client Identity">
        <EditBtn to={1} />
        <Row k="Client" v={draft.client_name} />
        <Row k="Founder" v={draft.founder_name} />
        <Row k="Phone" v={draft.phone} />
        <Row k="Email" v={draft.email} />
        <Row k="Website" v={draft.website_url} />
        <Row k="Social" v={draft.social_url} />
      </Section>
      <Section title="Business Profile">
        <EditBtn to={2} />
        <Row k="Niche" v={draft.niche} />
        <Row k="Category" v={draft.business_category} />
        <Row k="Status" v={draft.status} />
        <Row k="Stage" v={draft.client_stage} />
        <Row k="Start Date" v={draft.start_date} />
      </Section>
      <Section title="Revenue Setup" accent>
        <EditBtn to={3} />
        <RevenuePreview draft={draft} />
      </Section>
      <Section title="Ownership, Ads & Risk">
        <EditBtn to={4} />
        <Row k="Assigned Manager" v={draft.assigned_manager} />
        <Row k="Account Owner" v={draft.account_owner} />
        <Row k="Media Buyer" v={draft.media_buyer} />
        <Row k="Sales Owner" v={draft.sales_owner} />
        <Row k="Client Risk" v={draft.client_risk} />
        <Row k="Payment Risk" v={draft.payment_risk} />
        <Row k="Reminder" v={draft.important_reminder} />
        <Row k="Notes" v={draft.notes} />
      </Section>
    </>
  );
}

// -------------------- inner pieces --------------------

function RevenueModelFields({
  draft, set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  switch (draft.revenue_model) {
    case "Fixed Retainer":
      return (
        <Grid>
          <Input label="Monthly Retainer Amount *" type="number" value={draft.monthly_retainer_amount} onChange={(v) => set("monthly_retainer_amount", v)} />
          <QuickSaveSelect label="Billing Cycle" group="billing_cycle" value={draft.billing_cycle} onChange={(v) => set("billing_cycle", v)} defaults={BILLING_CYCLE_DEFAULTS} />
          <QuickSaveSelect label="Billing Date" group="billing_date" value={draft.billing_date} onChange={(v) => set("billing_date", v)} defaults={BILLING_DATE_DEFAULTS} />
          <QuickSaveSelect label="Collection Due Date" group="collection_due_date" value={draft.collection_due_date} onChange={(v) => set("collection_due_date", v)} defaults={COLLECTION_DUE_DEFAULTS} />
          <Toggle label="GST Applicable?" value={draft.gst_applicable} onChange={(v) => set("gst_applicable", v)} />
        </Grid>
      );
    case "Revenue Share":
      return (
        <>
          <Grid>
            <Input label="Revenue Share % *" type="number" value={draft.revenue_share_percentage} onChange={(v) => set("revenue_share_percentage", v)} />
            <QuickSaveSelect required label="Revenue Base" group="revenue_base" value={draft.revenue_base} onChange={(v) => set("revenue_base", v)} defaults={REVENUE_BASE_DEFAULTS} />
            <QuickSaveSelect label="Settlement Frequency" group="settlement_frequency" value={draft.settlement_frequency} onChange={(v) => set("settlement_frequency", v)} defaults={SETTLEMENT_FREQ_DEFAULTS} />
            <Input label="Minimum Guarantee (₹)" type="number" value={draft.minimum_guarantee} onChange={(v) => set("minimum_guarantee", v)} />
          </Grid>
          <div style={{ height: 12 }} />
          <MultiSelectChips label="Revenue Tracking Sources" group="revenue_tracking_source" value={draft.revenue_tracking_sources} onChange={(v) => set("revenue_tracking_sources", v)} defaults={REVENUE_SOURCE_DEFAULTS} />
        </>
      );
    case "Hybrid":
      return (
        <>
          <Grid>
            <Input label="Base Retainer Amount *" type="number" value={draft.base_retainer_amount} onChange={(v) => set("base_retainer_amount", v)} />
            <Input label="Revenue Share % *" type="number" value={draft.revenue_share_percentage} onChange={(v) => set("revenue_share_percentage", v)} />
            <QuickSaveSelect required label="Revenue Base" group="revenue_base" value={draft.revenue_base} onChange={(v) => set("revenue_base", v)} defaults={REVENUE_BASE_DEFAULTS} />
            <QuickSaveSelect label="Settlement Frequency" group="settlement_frequency" value={draft.settlement_frequency} onChange={(v) => set("settlement_frequency", v)} defaults={SETTLEMENT_FREQ_DEFAULTS} />
            <Input label="Minimum Guarantee (₹)" type="number" value={draft.minimum_guarantee} onChange={(v) => set("minimum_guarantee", v)} />
          </Grid>
          <div style={{ height: 12 }} />
          <MultiSelectChips label="Revenue Tracking Sources" group="revenue_tracking_source" value={draft.revenue_tracking_sources} onChange={(v) => set("revenue_tracking_sources", v)} defaults={REVENUE_SOURCE_DEFAULTS} />
          <div style={{ height: 12 }} />
          <Textarea label="Bonus / Upside Notes" value={draft.billing_notes} onChange={(v) => set("billing_notes", v)} />
        </>
      );
    case "Performance Bonus":
      return (
        <Grid>
          <Input label="Base Fee" type="number" value={draft.base_retainer_amount} onChange={(v) => set("base_retainer_amount", v)} />
          <QuickSaveSelect required label="Bonus Trigger" group="bonus_trigger" value={draft.bonus_trigger} onChange={(v) => set("bonus_trigger", v)} defaults={BONUS_TRIGGER_DEFAULTS} />
          <Input label="Trigger Target Value" type="number" value={draft.trigger_target_value} onChange={(v) => set("trigger_target_value", v)} />
          <QuickSaveSelect label="Bonus Type" group="bonus_type" value={draft.bonus_type} onChange={(v) => set("bonus_type", v)} defaults={BONUS_TYPE_DEFAULTS} />
          <Input label="Bonus Amount / %" type="number" value={draft.bonus_amount} onChange={(v) => set("bonus_amount", v)} />
          <QuickSaveSelect label="Metric Used" group="metric_used" value={draft.metric_used} onChange={(v) => set("metric_used", v)} defaults={METRIC_USED_DEFAULTS} />
        </Grid>
      );
    case "One-Time Setup":
      return (
        <>
          <Grid>
            <Input label="Setup Fee *" type="number" value={draft.setup_fee} onChange={(v) => set("setup_fee", v)} />
            <QuickSaveSelect label="Payment Status" group="payment_status" value={draft.setup_payment_status} onChange={(v) => set("setup_payment_status", v)} defaults={PAYMENT_STATUS_DEFAULTS} />
            <Input label="Delivery Deadline" type="date" value={draft.setup_delivery_deadline} onChange={(v) => set("setup_delivery_deadline", v)} />
          </Grid>
          <div style={{ height: 12 }} />
          <Textarea label="Setup Scope" value={draft.setup_scope} onChange={(v) => set("setup_scope", v)} />
        </>
      );
    case "Trial":
      return (
        <>
          <Grid>
            <QuickSaveSelect label="Trial Duration" group="trial_duration" value={draft.trial_duration} onChange={(v) => set("trial_duration", v)} defaults={TRIAL_DURATION_DEFAULTS} />
            <Input label="Trial Fee (₹)" type="number" value={draft.trial_fee} onChange={(v) => set("trial_fee", v)} />
            <Input label="Trial End Date" type="date" value={draft.trial_end_date} onChange={(v) => set("trial_end_date", v)} />
          </Grid>
          <div style={{ height: 12 }} />
          <Textarea label="Trial Conversion Plan" value={draft.trial_conversion_plan} onChange={(v) => set("trial_conversion_plan", v)} />
        </>
      );
    case "Custom":
      return (
        <>
          <Textarea label="Custom Revenue Terms *" value={draft.custom_revenue_terms} onChange={(v) => set("custom_revenue_terms", v)} />
          <div style={{ height: 12 }} />
          <Grid>
            <Input label="Expected Monthly Revenue (₹)" type="number" value={draft.expected_monthly_revenue} onChange={(v) => set("expected_monthly_revenue", v)} />
          </Grid>
          <div style={{ height: 12 }} />
          <Textarea label="Billing Notes" value={draft.billing_notes} onChange={(v) => set("billing_notes", v)} />
        </>
      );
    default:
      return (
        <p style={{ fontSize: 12.5, color: "var(--ink4)" }}>
          Select a revenue model to configure its specific fields.
        </p>
      );
  }
}

function RevenuePreview({ draft }: { draft: Draft }) {
  const lines = useMemo(() => {
    const out: Array<[string, string]> = [];
    if (!draft.revenue_model) return out;
    out.push(["Model", draft.revenue_model]);
    const num = (v: string) => Number(v || 0);
    switch (draft.revenue_model) {
      case "Fixed Retainer":
        out.push(["Monthly Expected Revenue", formatINR(num(draft.monthly_retainer_amount))]);
        if (draft.billing_cycle) out.push(["Billing Cycle", draft.billing_cycle]);
        if (draft.collection_due_date) out.push(["Collection Due", draft.collection_due_date]);
        out.push(["GST Applicable", draft.gst_applicable ? "Yes" : "No"]);
        break;
      case "Revenue Share":
        out.push(["Share", `${draft.revenue_share_percentage || "—"}%`]);
        if (draft.revenue_base) out.push(["Revenue Base", draft.revenue_base]);
        if (draft.settlement_frequency) out.push(["Settlement", draft.settlement_frequency]);
        if (draft.minimum_guarantee) out.push(["Minimum Guarantee", formatINR(num(draft.minimum_guarantee))]);
        break;
      case "Hybrid":
        if (draft.base_retainer_amount) out.push(["Base Retainer", formatINR(num(draft.base_retainer_amount))]);
        out.push(["Revenue Share", `${draft.revenue_share_percentage || "—"}%`]);
        if (draft.revenue_base) out.push(["Revenue Base", draft.revenue_base]);
        if (draft.settlement_frequency) out.push(["Settlement", draft.settlement_frequency]);
        break;
      case "Performance Bonus":
        if (draft.base_retainer_amount) out.push(["Base Fee", formatINR(num(draft.base_retainer_amount))]);
        if (draft.bonus_trigger) out.push(["Trigger", draft.bonus_trigger]);
        if (draft.bonus_amount) out.push(["Bonus", `${draft.bonus_type || ""} ${draft.bonus_amount}`.trim()]);
        if (draft.metric_used) out.push(["Metric", draft.metric_used]);
        break;
      case "One-Time Setup":
        out.push(["Setup Fee", formatINR(num(draft.setup_fee))]);
        if (draft.setup_payment_status) out.push(["Payment Status", draft.setup_payment_status]);
        if (draft.setup_delivery_deadline) out.push(["Deadline", draft.setup_delivery_deadline]);
        break;
      case "Trial":
        if (draft.trial_duration) out.push(["Trial Duration", draft.trial_duration]);
        if (draft.trial_fee) out.push(["Trial Fee", formatINR(num(draft.trial_fee))]);
        if (draft.trial_end_date) out.push(["End Date", draft.trial_end_date]);
        break;
      case "Custom":
        if (draft.expected_monthly_revenue) out.push(["Expected Monthly Revenue", formatINR(num(draft.expected_monthly_revenue))]);
        if (draft.custom_revenue_terms) out.push(["Terms", draft.custom_revenue_terms.slice(0, 80) + (draft.custom_revenue_terms.length > 80 ? "…" : "")]);
        break;
    }
    if (draft.revenue_tracking_sources.length) {
      out.push(["Tracking Sources", draft.revenue_tracking_sources.join(", ")]);
    }
    if (draft.assigned_manager) out.push(["Assigned Manager", draft.assigned_manager]);
    return out;
  }, [draft]);

  if (!lines.length) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: 0 }}>
        Complete revenue model fields to generate preview.
      </p>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {lines.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
          <span style={{ color: "var(--ink4)", fontFamily: "'DM Mono',monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
          <span style={{ color: "var(--ink)", fontWeight: 600, textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// -------------------- generic UI shell --------------------

function DrawerShell({
  title, subtitle, onClose, children, footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(28,24,20,.42)", zIndex: 60,
      }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 780, maxWidth: "96vw",
        background: "var(--ivory)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 70,
        boxShadow: "-8px 0 28px rgba(28,24,20,.18)",
      }}>
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--ink4)" }}>Marketizers</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 12.5, color: "var(--ink4)", marginTop: 4, maxWidth: 600 }}>{subtitle}</div>
              )}
            </div>
            <button className="btn-sm" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "14px 26px", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "flex-end", gap: 8,
            background: "var(--parchment)",
          }}>{footer}</div>
        )}
      </aside>
    </>
  );
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section style={{
      marginBottom: 22, padding: 18, borderRadius: 10,
      background: accent ? "var(--parchment)" : "transparent",
      border: accent ? "1px solid var(--border)" : "none",
      borderLeft: accent ? "3px solid var(--gold, #c9a14a)" : "none",
    }}>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 17, fontWeight: 700, color: "var(--ink)",
        marginBottom: 14, paddingBottom: 8,
        borderBottom: accent ? "none" : "1px solid var(--border)",
      }}>{title}</div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gap: 12,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    }}>{children}</div>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{value ? "Yes" : "No"}</span>
      </label>
    </div>
  );
}

function MultiSelectChips({
  label, group, value, onChange, defaults,
}: {
  label: string; group: string; value: string[];
  onChange: (v: string[]) => void; defaults: string[];
}) {
  const [extras, setExtras] = useState<string[]>([]);
  const [draftOpt, setDraftOpt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    listQuickSaveOptions(group)
      .then((rows) => { if (!cancel) setExtras(rows.map((r) => r.value)); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [group]);

  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of [...defaults, ...extras, ...value]) {
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); out.push(v);
    }
    return out;
  }, [defaults, extras, value]);

  const isSelected = (v: string) => value.some((x) => x.toLowerCase() === v.toLowerCase());
  const toggle = (v: string) => {
    if (isSelected(v)) onChange(value.filter((x) => x.toLowerCase() !== v.toLowerCase()));
    else onChange([...value, v]);
  };
  const addCustom = async () => {
    const v = draftOpt.trim();
    if (!v) return;
    setBusy(true);
    try {
      const opt = await addQuickSaveOption(group, v);
      setExtras((p) => p.includes(opt.value) ? p : [...p, opt.value]);
      if (!isSelected(opt.value)) onChange([...value, opt.value]);
      setDraftOpt("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add option.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((v) => (
            <span key={v} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 999, background: "var(--ink)", color: "var(--parchment)",
              fontSize: 11.5, fontFamily: "'Figtree',sans-serif",
            }}>
              {v}
              <button type="button" onClick={() => toggle(v)} aria-label={`Remove ${v}`} style={{
                background: "transparent", border: "none", color: "var(--parchment)",
                cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {allOptions.filter((o) => !isSelected(o)).map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)} style={{
            padding: "4px 10px", borderRadius: 999,
            background: "var(--parchment)", border: "1px solid var(--border)",
            color: "var(--ink2)", fontSize: 11.5, cursor: "pointer",
            fontFamily: "'Figtree',sans-serif",
          }}>+ {o}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={draftOpt}
          placeholder="Add new source…"
          onChange={(e) => setDraftOpt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        />
        <button type="button" className="btn-sm" onClick={addCustom} disabled={busy || !draftOpt.trim()}>
          {busy ? "…" : "+ Add"}
        </button>
      </div>
    </div>
  );
}
