// Marketizers Seminar/Webinar ROAS Tracker — step-by-step wizard.
// IPC-inspired guided UX, Vision Center branding (parchment / ivory / gold).
// Save payload, formulas, and history compatibility are unchanged from the
// previous one-page form — wizard state maps to the same fields.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader, MetricCard, FieldLabel, inputStyle as _baseInput, ErrorBanner } from "@/components/marketizers/ui";
import "./vc-roas.css";

// Local input override — calmer rhythm, more vertical breathing room.
// Used everywhere inside this wizard so the IPC-style "easy on the eyes"
// feel applies uniformly without touching other Marketizers screens.
const inputStyle: CSSProperties = {
  ..._baseInput,
  padding: "12px 14px",
  fontSize: 14,
  borderRadius: 8,
  lineHeight: 1.4,
};
import { QuickSaveSelect } from "@/components/marketizers/QuickSaveSelect";
import { SearchableCombobox, type ComboOption } from "@/components/marketizers/SearchableCombobox";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import { getTeamMembers as getDirectoryTeamMembers } from "@/services/teamDirectoryService";
import {
  computeRoas,
  classifyHealth,
  HEALTH_PILL_CLASS,
  inr,
  dec,
  pct,
  num,
} from "@/lib/marketizers/roasFormulas";
import {
  saveRoasSession,
  getRoasSession,
  type RoasSessionInput,
  type AudienceSegment,
} from "@/services/marketizers/roasService";
import {
  exportRoasSessionPdf,
  exportRoasSessionCsv,
  buildWhatsAppSummary,
  copyToClipboard,
} from "@/lib/marketizers/roasExport";
import { RoasImportWizard } from "./RoasImportWizard";
import { useFinanceVisibility } from "@/hooks/useFinanceVisibility";

const EVENT_TYPE_DEFAULTS = [
  "1-Day Webinar",
  "2-Day Webinar",
  "3-Day Bootcamp",
  "Seminar",
  "Challenge",
  "Workshop",
  "Custom",
];
const DAY_PATTERN_DEFAULTS = [
  "Friday, Saturday, Sunday",
  "Wednesday, Thursday, Friday",
  "Saturday, Sunday",
  "Single Day",
  "Custom",
];
const SALES_DAY_OPTIONS = ["Day 1", "Day 2", "Day 3", "Last Day", "Custom"];
const REVENUE_BASIS_OPTIONS = [
  { key: "full", label: "Full Deal Value" },
  { key: "token", label: "Token / Collected" },
  { key: "manual", label: "Manual Revenue" },
] as const;
const PAYMENT_TYPE_DEFAULTS = [
  "Full Payment Sale",
  "Part Payment Sale",
  "Token Payment",
  "Down Payment",
  "Final Payment",
  "EMI Sale",
  "Custom",
];
const AUDIENCE_DEFAULTS = ["Business Owner", "Coach", "Working Professional", "Homemaker", "Others"];
const WATCH_POINT_OPTIONS = ["50", "60", "70", "75", "80"];

type SegmentDraft = { segment_name: string; segment_percentage: string; segment_count: string };
type DayDraft = {
  date: string;
  start_time: string;
  end_time: string;
  watch_point: string;
  leads: string;
  showup: string;
  watch_point_present: string;
};
type PaymentRow = {
  payment_type: string;
  units: string;
  deal_price: string;
  token: string;
};

const emptyForm = {
  client_name: "",
  media_buyer_name: "",
  event_type: "",
  event_name: "",
  offer_name: "",
  product_final_value: "",
  token_amount: "",
  campaign_date_from: "",
  campaign_date_to: "",
  event_dates_text: "",
  event_day_pattern: "",
  ad_spend: "",
  leads: "",
  cpm: "",
  cpc: "",
  ctr: "",
  landing_page_views: "",
  meta_ad_account: "",
  campaign_name: "",
  google_sheet_url: "",
  token_purchases: "",
  final_purchases: "",
  manual_revenue_override: "",
  showup_count: "",
  heard_count: "",
  sales_count: "",
  offer_showup_count: "",
  lead_drop_rate: "",
  cpl_drop_percent: "",
  notes: "",
};
type FormState = typeof emptyForm;

const STEPS = [
  { n: 1, label: "Event Setup" },
  { n: 2, label: "Attendance / Leads" },
  { n: 3, label: "Ad Cost & Spend" },
  { n: 4, label: "Sales & Payment" },
  { n: 5, label: "ROAS & Profit" },
] as const;

const HUB_ROUTE = "/brands/marketizers/team-performance/media-buyer-performance";

export default function SeminarRoasCalculatorPage() {
  const search = (useSearch({ strict: false }) as any) ?? {};
  const editId: string | undefined = search.editId;
  const navigate = useNavigate();
  const canSeeFinance = useFinanceVisibility("marketizers");

  useEffect(() => {
    document.title = "Seminar / Webinar ROAS | Media Buyer Performance | GWV";
  }, []);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [segments, setSegments] = useState<SegmentDraft[]>(
    AUDIENCE_DEFAULTS.map((n) => ({ segment_name: n, segment_percentage: "", segment_count: "" })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Wizard-only client state (not persisted in DB; used to organize input)
  const [totalDays, setTotalDays] = useState<number>(1);
  const [salesDay, setSalesDay] = useState<string>("Last Day");
  const [revenueBasis, setRevenueBasis] = useState<"full" | "token" | "manual">("full");
  const [timingNote, setTimingNote] = useState<string>("");
  const [days, setDays] = useState<DayDraft[]>([emptyDay()]);
  const [gstPercent, setGstPercent] = useState<string>("18");
  const [adCostExclGst, setAdCostExclGst] = useState<string>("");
  const [inputGstCredit, setInputGstCredit] = useState<string>("");
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { payment_type: "", units: "", deal_price: "", token: "" },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Client + Media Buyer directory state.
  const [clients, setClients] = useState<ComboOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<ComboOption[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(true);
  const [buyersError, setBuyersError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setClientsLoading(true);
    getMarketizersClients()
      .then((rows) => {
        if (cancel) return;
        setClients(rows.map((c: any) => ({
          id: c.id,
          label: c.client_name,
          sublabel: [c.founder_name, c.niche].filter(Boolean).join(" · ") || null,
          meta: [c.founder_name, c.niche, c.status].filter(Boolean).join(" "),
        })));
        setClientsError(null);
      })
      .catch((e) => !cancel && setClientsError(e?.message ?? "Could not load clients."))
      .finally(() => !cancel && setClientsLoading(false));
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    setBuyersLoading(true);
    (async () => {
      try {
        // Primary: members whose position contains "media buyer".
        let rows = await getDirectoryTeamMembers({ positionContains: "media buyer" });
        // Fallback: all active members (lets user pick when positions aren't tagged exactly).
        if (rows.length === 0) rows = await getDirectoryTeamMembers();
        if (cancel) return;
        setBuyers(rows.map((m) => ({
          id: m.id,
          label: m.name,
          sublabel: [m.position_name, m.email].filter(Boolean).join(" · ") || null,
          meta: [m.position_name, m.email].filter(Boolean).join(" "),
        })));
        setBuyersError(null);
      } catch (e: any) {
        if (!cancel) setBuyersError(e?.message ?? "Could not load team directory.");
      } finally {
        if (!cancel) setBuyersLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);


  // Load existing for edit
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const { session, segments: segs } = await getRoasSession(editId);
        setForm({
          client_name: session.client_name ?? "",
          media_buyer_name: session.media_buyer_name ?? "",
          event_type: session.event_type ?? "",
          event_name: session.event_name ?? "",
          offer_name: session.offer_name ?? "",
          product_final_value: String(session.product_final_value ?? ""),
          token_amount: String(session.token_amount ?? ""),
          campaign_date_from: session.campaign_date_from ?? "",
          campaign_date_to: session.campaign_date_to ?? "",
          event_dates_text: (session.event_dates ?? []).join(", "),
          event_day_pattern: session.event_day_pattern ?? "",
          ad_spend: String(session.ad_spend ?? ""),
          leads: String(session.leads ?? ""),
          cpm: String(session.cpm ?? ""),
          cpc: String(session.cpc ?? ""),
          ctr: String(session.ctr ?? ""),
          landing_page_views: String(session.landing_page_views ?? ""),
          meta_ad_account: session.meta_ad_account ?? "",
          campaign_name: session.campaign_name ?? "",
          google_sheet_url: session.google_sheet_url ?? "",
          token_purchases: String(session.token_purchases ?? ""),
          final_purchases: String(session.final_purchases ?? ""),
          manual_revenue_override: String(session.manual_revenue_override ?? ""),
          showup_count: String(session.showup_count ?? ""),
          heard_count: String(session.heard_count ?? ""),
          sales_count: String(session.sales_count ?? ""),
          offer_showup_count: String(session.offer_showup_count ?? ""),
          lead_drop_rate: String(session.lead_drop_rate ?? ""),
          cpl_drop_percent: String(session.cpl_drop_percent ?? ""),
          notes: session.notes ?? "",
        });
        if (session.manual_revenue_override) setRevenueBasis("manual");
        const dates = session.event_dates ?? [];
        if (dates.length > 1) setTotalDays(Math.min(dates.length, 3));
        if (segs.length) {
          setSegments(
            segs.map((s) => ({
              segment_name: s.segment_name,
              segment_percentage: String(s.segment_percentage ?? ""),
              segment_count: String(s.segment_count ?? ""),
            })),
          );
          setShowAdvanced(true);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load session.");
      }
    })();
  }, [editId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Adjust day cards when totalDays changes
  useEffect(() => {
    setDays((prev) => {
      const out = prev.slice(0, totalDays);
      while (out.length < totalDays) out.push(emptyDay());
      return out;
    });
  }, [totalDays]);

  // Live calculations
  const results = useMemo(
    () =>
      computeRoas({
        ad_spend: num(form.ad_spend),
        leads: num(form.leads),
        token_purchases: num(form.token_purchases),
        final_purchases: num(form.final_purchases),
        token_amount: num(form.token_amount),
        product_final_value: num(form.product_final_value),
        manual_revenue_override:
          revenueBasis === "manual" && form.manual_revenue_override
            ? num(form.manual_revenue_override)
            : null,
        showup_count: num(form.showup_count),
        offer_showup_count: num(form.offer_showup_count),
      }),
    [form, revenueBasis],
  );
  const health = classifyHealth(results.roas);
  const segmentTotal = segments.reduce((s, x) => s + num(x.segment_percentage), 0);
  const hasInputs = num(form.ad_spend) > 0 || num(form.leads) > 0;

  // GST helpers (display-only on Step 3)
  const gstAmount = num(adCostExclGst) * (num(gstPercent) / 100);
  const adInclGst = num(adCostExclGst) + gstAmount;

  // Payment row roll-up
  const paymentTotals = useMemo(() => {
    let units = 0;
    let revenue = 0;
    let tokenRevenue = 0;
    paymentRows.forEach((r) => {
      const u = num(r.units);
      const dp = num(r.deal_price);
      const tk = num(r.token);
      units += u;
      revenue += u * (revenueBasis === "token" && tk > 0 ? tk : dp);
      if (tk > 0) tokenRevenue += u * tk;
    });
    return { units, revenue, tokenRevenue };
  }, [paymentRows, revenueBasis]);

  function applyDayAttendanceToForm() {
    const totalLeads = days.reduce((s, d) => s + num(d.leads), 0);
    const totalShowup = days.reduce((s, d) => s + num(d.showup), 0);
    if (totalLeads > 0) set("leads", String(Math.round(totalLeads)));
    if (totalShowup > 0) set("showup_count", String(Math.round(totalShowup)));
    setFlash("Attendance totals applied.");
    setTimeout(() => setFlash(null), 1800);
  }

  function applyAdSpendToForm() {
    if (num(adCostExclGst) > 0) {
      set("ad_spend", String(Math.round(adInclGst)));
      setFlash("Total ad spend (incl. GST) applied.");
      setTimeout(() => setFlash(null), 1800);
    }
  }

  function applyPaymentToForm() {
    if (paymentTotals.units > 0) {
      set("final_purchases", String(Math.round(paymentTotals.units)));
    }
    if (revenueBasis === "manual") {
      if (paymentTotals.revenue > 0) set("manual_revenue_override", String(Math.round(paymentTotals.revenue)));
    } else if (revenueBasis === "token") {
      if (paymentTotals.tokenRevenue > 0) {
        set("manual_revenue_override", String(Math.round(paymentTotals.tokenRevenue)));
      }
    }
    setFlash("Sales & payment applied to summary.");
    setTimeout(() => setFlash(null), 1800);
  }

  const handleSave = async (andAddAnother = false) => {
    setError(null);
    if (!form.client_name.trim() && !form.event_name.trim()) {
      setError("Please enter at least a client or event name.");
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const payload: RoasSessionInput = {
        client_name: form.client_name.trim() || null,
        media_buyer_name: form.media_buyer_name.trim() || null,
        event_type: form.event_type || null,
        event_name: form.event_name.trim() || null,
        offer_name: form.offer_name.trim() || null,
        product_final_value: form.product_final_value ? num(form.product_final_value) : null,
        token_amount: form.token_amount ? num(form.token_amount) : null,
        campaign_date_from: form.campaign_date_from || null,
        campaign_date_to: form.campaign_date_to || null,
        event_dates: form.event_dates_text
          ? form.event_dates_text.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        event_day_pattern: form.event_day_pattern || null,
        ad_spend: num(form.ad_spend),
        leads: Math.round(num(form.leads)),
        cpm: form.cpm ? num(form.cpm) : null,
        cpc: form.cpc ? num(form.cpc) : null,
        cpl: results.cpl,
        cpp: results.cpp,
        ctr: form.ctr ? num(form.ctr) : null,
        landing_page_views: form.landing_page_views ? Math.round(num(form.landing_page_views)) : null,
        token_purchases: Math.round(num(form.token_purchases)),
        final_purchases: Math.round(num(form.final_purchases)),
        token_revenue: results.token_revenue,
        final_revenue: results.final_revenue,
        total_revenue: results.total_revenue,
        manual_revenue_override:
          revenueBasis === "manual" && form.manual_revenue_override
            ? num(form.manual_revenue_override)
            : null,
        roas: results.roas,
        pnl: results.pnl,
        showup_count: form.showup_count ? Math.round(num(form.showup_count)) : null,
        showup_percent: results.showup_percent,
        heard_count: form.heard_count ? Math.round(num(form.heard_count)) : null,
        sales_count: form.sales_count ? Math.round(num(form.sales_count)) : null,
        offer_showup_count: form.offer_showup_count ? Math.round(num(form.offer_showup_count)) : null,
        offer_showup_percent: results.offer_showup_percent,
        lead_drop_rate: form.lead_drop_rate ? num(form.lead_drop_rate) : null,
        cpl_drop_percent: form.cpl_drop_percent ? num(form.cpl_drop_percent) : null,
        final_purchase_conversion: results.final_purchase_conversion,
        revenue_per_lead: results.revenue_per_lead,
        profit_per_lead: results.profit_per_lead,
        performance_health: health,
        source_type: "manual",
        google_sheet_url: form.google_sheet_url.trim() || null,
        meta_ad_account: form.meta_ad_account.trim() || null,
        campaign_name: form.campaign_name.trim() || null,
        notes: form.notes.trim() || null,
        currency: "INR",
      };
      const segPayload = segments
        .filter((s) => s.segment_name.trim() && (s.segment_percentage || s.segment_count))
        .map((s, i) => ({
          segment_name: s.segment_name.trim(),
          segment_percentage: s.segment_percentage ? num(s.segment_percentage) : null,
          segment_count: s.segment_count ? Math.round(num(s.segment_count)) : null,
          sort_order: i,
        }));
      const id = await saveRoasSession(payload, segPayload, editId);
      setFlash("Saved.");
      if (andAddAnother) {
        setForm(emptyForm);
        setSegments(AUDIENCE_DEFAULTS.map((n) => ({ segment_name: n, segment_percentage: "", segment_count: "" })));
        setDays([emptyDay()]);
        setTotalDays(1);
        setPaymentRows([{ payment_type: "", units: "", deal_price: "", token: "" }]);
        setRevenueBasis("full");
        setAdCostExclGst("");
        setInputGstCredit("");
        setStep(1);
        navigate({ to: "/brands/marketizers/team-performance/media-buyer-performance/seminar-roas" });
      } else {
        navigate({
          to: "/brands/marketizers/team-performance/media-buyer-performance/seminar-roas",
          search: { editId: id },
        });
      }
      setTimeout(() => setFlash(null), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Preview shape for export
  const previewSession = useMemo(
    () => ({
      id: editId ?? "draft",
      client_id: null,
      client_name: form.client_name || null,
      media_buyer_id: null,
      media_buyer_name: form.media_buyer_name || null,
      event_type: form.event_type || null,
      event_name: form.event_name || null,
      offer_name: form.offer_name || null,
      product_final_value: num(form.product_final_value) || null,
      token_amount: num(form.token_amount) || null,
      campaign_date_from: form.campaign_date_from || null,
      campaign_date_to: form.campaign_date_to || null,
      event_dates: null,
      event_day_pattern: form.event_day_pattern || null,
      ad_spend: num(form.ad_spend),
      leads: Math.round(num(form.leads)),
      cpm: num(form.cpm) || null,
      cpc: num(form.cpc) || null,
      cpl: results.cpl,
      cpp: results.cpp,
      ctr: num(form.ctr) || null,
      landing_page_views: num(form.landing_page_views) || null,
      token_purchases: Math.round(num(form.token_purchases)),
      final_purchases: Math.round(num(form.final_purchases)),
      token_revenue: results.token_revenue,
      final_revenue: results.final_revenue,
      total_revenue: results.total_revenue,
      manual_revenue_override: form.manual_revenue_override ? num(form.manual_revenue_override) : null,
      roas: results.roas,
      pnl: results.pnl,
      showup_count: num(form.showup_count) || null,
      showup_percent: results.showup_percent,
      heard_count: num(form.heard_count) || null,
      sales_count: num(form.sales_count) || null,
      offer_showup_count: num(form.offer_showup_count) || null,
      offer_showup_percent: results.offer_showup_percent,
      lead_drop_rate: num(form.lead_drop_rate) || null,
      cpl_drop_percent: num(form.cpl_drop_percent) || null,
      final_purchase_conversion: results.final_purchase_conversion,
      revenue_per_lead: results.revenue_per_lead,
      profit_per_lead: results.profit_per_lead,
      performance_health: health,
      source_type: "manual",
      google_sheet_url: form.google_sheet_url || null,
      meta_ad_account: form.meta_ad_account || null,
      campaign_name: form.campaign_name || null,
      notes: form.notes || null,
      currency: "INR",
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by: null,
    }),
    [form, results, health, editId],
  );
  const previewSegments: AudienceSegment[] = segments
    .filter((s) => s.segment_name.trim())
    .map((s, i) => ({
      id: `draft-${i}`,
      session_id: editId ?? "draft",
      segment_name: s.segment_name,
      segment_percentage: s.segment_percentage ? num(s.segment_percentage) : null,
      segment_count: s.segment_count ? Math.round(num(s.segment_count)) : null,
      sort_order: i,
    }));

  // ---------- Render ----------
  return (
    <div className="vc-roas">
      <PageHeader
        eyebrow="Marketizers / Team Performance / Media Buyer Performance"
        title={editId ? "Edit ROAS Calculation" : "New ROAS Calculation"}
        subtitle="A guided 5-step calculator for ROAS, revenue, CPL, CPP, and PNL across webinars, bootcamps, seminars, and workshops."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {canSeeFinance && (
              <button className="btn-sm" onClick={() => setShowImport(true)} title="Upload CSV or paste sheet data to create ROAS records faster.">
                Import ROAS Data
              </button>
            )}
            <Link to={HUB_ROUTE}>
              <button className="btn-sm">← Back</button>
            </Link>
          </div>
        }
      />
      {showImport && canSeeFinance && <RoasImportWizard onClose={() => setShowImport(false)} />}

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {flash && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 8, color: "var(--green)", fontSize: 13 }}>
          {flash}
        </div>
      )}

      {/* Compact summary strip */}
      <div className="summary-strip-wrap">
        <SummaryStrip results={results} health={health} hasInputs={hasInputs} canSeeFinance={canSeeFinance} />

        {/* Stepper */}
        <Stepper step={step} onJump={setStep} />
      </div>

      {/* Step content — centered, calmer card */}
      <div
        className="panel"
        style={{ marginBottom: 18, maxWidth: 960, marginLeft: "auto", marginRight: "auto", padding: "32px 36px" }}
      >
        {step === 1 && (
          <StepShell title="Event Setup" helper="Define the client, event type, duration, and revenue basis.">
            <Section title="Client & Event">
              <Grid>
                <Field label="Client *">
                  <SearchableCombobox
                    value={form.client_name}
                    options={clients}
                    loading={clientsLoading}
                    error={clientsError}
                    placeholder="Search by name, founder, or niche…"
                    emptyText="No clients found. Add a client in Marketizers → Client Accounts first."
                    onChange={(opt) => set("client_name", opt?.label ?? "")}
                  />
                </Field>
                <Field label="Media Buyer">
                  <SearchableCombobox
                    value={form.media_buyer_name}
                    options={buyers}
                    loading={buyersLoading}
                    error={buyersError}
                    placeholder="Search media buyers by name or initials…"
                    emptyText="No media buyers found in Team Directory."
                    onChange={(opt) => set("media_buyer_name", opt?.label ?? "")}
                  />
                </Field>
                <QuickSaveSelect label="Event Type" group="roas_event_type" value={form.event_type} onChange={(v) => set("event_type", v)} defaults={EVENT_TYPE_DEFAULTS} />
                <Field label="Total Event Days">
                  <PillGroup
                    options={[{ k: "1", label: "1 Day" }, { k: "2", label: "2 Days" }, { k: "3", label: "3 Days" }]}
                    value={String(totalDays)}
                    onChange={(v) => setTotalDays(Math.max(1, Math.min(3, parseInt(v, 10) || 1)))}
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Schedule">
              <Grid>
                <Field label="Campaign Date From">
                  <input type="date" style={inputStyle} value={form.campaign_date_from} onChange={(e) => set("campaign_date_from", e.target.value)} />
                </Field>
                <Field label="Campaign Date To">
                  <input type="date" style={inputStyle} value={form.campaign_date_to} onChange={(e) => set("campaign_date_to", e.target.value)} />
                </Field>
              </Grid>
            </Section>

            <Section title="Revenue Basis" helper="Choose how ROAS is calculated. Only the matching value field is shown below.">
              <div style={{ marginBottom: 16 }}>
                <PillGroup
                  options={REVENUE_BASIS_OPTIONS.map((o) => ({ k: o.key, label: o.label }))}
                  value={revenueBasis}
                  onChange={(v) => setRevenueBasis(v as "full" | "token" | "manual")}
                />
              </div>
              <Grid>
                {revenueBasis === "full" && (
                  <Field label="Product Final Value (₹)">
                    <input type="number" style={inputStyle} value={form.product_final_value} onChange={(e) => set("product_final_value", e.target.value)} />
                  </Field>
                )}
                {revenueBasis === "token" && (
                  <>
                    <Field label="Token Amount (₹)">
                      <input type="number" style={inputStyle} value={form.token_amount} onChange={(e) => set("token_amount", e.target.value)} />
                    </Field>
                    <Field label="Product Final Value (₹) — optional">
                      <input type="number" style={inputStyle} value={form.product_final_value} onChange={(e) => set("product_final_value", e.target.value)} />
                    </Field>
                  </>
                )}
                {revenueBasis === "manual" && (
                  <Field label="Manual Revenue Override (₹)">
                    <input type="number" style={inputStyle} value={form.manual_revenue_override} onChange={(e) => set("manual_revenue_override", e.target.value)} placeholder="Required for Manual basis" />
                  </Field>
                )}
              </Grid>
            </Section>

            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink3)", padding: "8px 0" }}>
                + Optional details (event name, day pattern, sales day, offer name)
              </summary>
              <div style={{ marginTop: 14 }}>
                <Grid>
                  <Field label="Event / Campaign Name">
                    <input style={inputStyle} value={form.event_name} onChange={(e) => set("event_name", e.target.value)} placeholder="e.g. May Bootcamp Cohort 4" />
                  </Field>
                  <Field label="Product / Offer Name">
                    <input style={inputStyle} value={form.offer_name} onChange={(e) => set("offer_name", e.target.value)} />
                  </Field>
                  <QuickSaveSelect label="Event Day Pattern" group="roas_event_day_pattern" value={form.event_day_pattern} onChange={(v) => set("event_day_pattern", v)} defaults={DAY_PATTERN_DEFAULTS} />
                  <Field label="Sales / Offer Day">
                    <select style={inputStyle} value={salesDay} onChange={(e) => setSalesDay(e.target.value)}>
                      {SALES_DAY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Timing Note">
                    <input style={inputStyle} value={timingNote} onChange={(e) => setTimingNote(e.target.value)} placeholder="e.g. Same timing every day, 7–10pm" />
                  </Field>
                </Grid>
              </div>
            </details>
          </StepShell>
        )}


        {step === 2 && (
          <StepShell title="Attendance / Lead Details" helper="Enter leads and attendance for each event day.">
            <div style={{ display: "grid", gap: 14 }}>
              {days.map((d, i) => (
                <DayCard
                  key={i}
                  index={i}
                  day={d}
                  onChange={(next) => setDays((p) => p.map((x, j) => (j === i ? next : x)))}
                />
              ))}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sm" type="button" disabled={totalDays >= 3} onClick={() => setTotalDays((n) => Math.min(3, n + 1))}>+ Add One More Day</button>
                  <button className="btn-sm" type="button" disabled={totalDays <= 1} onClick={() => setTotalDays((n) => Math.max(1, n - 1))}>− Remove Last Day</button>
                </div>
                <button className="btn-sm" type="button" onClick={applyDayAttendanceToForm}>Apply Day Totals → Leads & Show-up</button>
              </div>
              <Grid>
                <Field label="Total Leads (used for ROAS) *">
                  <input type="number" style={inputStyle} value={form.leads} onChange={(e) => set("leads", e.target.value)} />
                </Field>
                <Field label="Total Show-up Count">
                  <input type="number" style={inputStyle} value={form.showup_count} onChange={(e) => set("showup_count", e.target.value)} />
                </Field>
                <Field label="Show-up % (auto)">
                  <ReadOnly>{pct(results.showup_percent)}</ReadOnly>
                </Field>
              </Grid>
              <Helper>Day cards adapt to Total Event Days from Step 1. Use "Apply Day Totals" to fill the totals automatically — or override them directly.</Helper>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Ad Cost & Spend" helper="Enter ad spend and ad performance metrics.">
            <Grid>
              <Field label="Ad Cost Excluding GST (₹)">
                <input type="number" style={inputStyle} value={adCostExclGst} onChange={(e) => setAdCostExclGst(e.target.value)} />
              </Field>
              <Field label="GST %">
                <input type="number" style={inputStyle} value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
              </Field>
              <Field label="GST Amount (auto)">
                <ReadOnly>₹{inr(gstAmount)}</ReadOnly>
              </Field>
              <Field label="Total Ad Spend Incl. GST (auto)">
                <ReadOnly emphasis>₹{inr(adInclGst)}</ReadOnly>
              </Field>
              <Field label="Input GST Credit (₹)">
                <input type="number" style={inputStyle} value={inputGstCredit} onChange={(e) => setInputGstCredit(e.target.value)} />
              </Field>
              <Field label="Total Ad Spend (used for ROAS) *">
                <input type="number" style={inputStyle} value={form.ad_spend} onChange={(e) => set("ad_spend", e.target.value)} />
              </Field>
              <Field label="Leads (auto from Step 2)">
                <input type="number" style={inputStyle} value={form.leads} onChange={(e) => set("leads", e.target.value)} />
              </Field>
              <Field label="CPM"><input type="number" style={inputStyle} value={form.cpm} onChange={(e) => set("cpm", e.target.value)} /></Field>
              <Field label="CPC"><input type="number" style={inputStyle} value={form.cpc} onChange={(e) => set("cpc", e.target.value)} /></Field>
              <Field label="CTR (%)"><input type="number" style={inputStyle} value={form.ctr} onChange={(e) => set("ctr", e.target.value)} /></Field>
              <Field label="Landing Page Views"><input type="number" style={inputStyle} value={form.landing_page_views} onChange={(e) => set("landing_page_views", e.target.value)} /></Field>
              <QuickSaveSelect label="Meta Ad Account" group="roas_meta_ad_account" value={form.meta_ad_account} onChange={(v) => set("meta_ad_account", v)} />
              <Field label="Campaign Name"><input style={inputStyle} value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} /></Field>
              <Field label="Lead Source Sheet URL"><input style={inputStyle} value={form.google_sheet_url} onChange={(e) => set("google_sheet_url", e.target.value)} /></Field>
            </Grid>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn-sm" type="button" onClick={applyAdSpendToForm}>Apply Incl. GST → Total Ad Spend</button>
            </div>
            <MiniGrid>
              <MiniMetric label="CPL" value={`₹${dec(results.cpl)}`} />
              <MiniMetric label="Cost / Show-up" value={`₹${dec(results.cpp || (num(form.showup_count) > 0 ? num(form.ad_spend) / num(form.showup_count) : 0))}`} />
              <MiniMetric label="Ad Spend" value={`₹${inr(num(form.ad_spend))}`} />
              <MiniMetric label="Input GST Credit" value={`₹${inr(num(inputGstCredit))}`} />
            </MiniGrid>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Sales & Payment Types" helper="Enter sales, product values, and payment types.">
            <Field label="Revenue Basis">
              <PillGroup
                options={REVENUE_BASIS_OPTIONS.map((o) => ({ k: o.key, label: o.label }))}
                value={revenueBasis}
                onChange={(v) => setRevenueBasis(v as "full" | "token" | "manual")}
              />
            </Field>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {paymentRows.map((r, i) => (
                <PaymentRowEditor
                  key={i}
                  row={r}
                  revenueBasis={revenueBasis}
                  onChange={(next) => setPaymentRows((p) => p.map((x, j) => (j === i ? next : x)))}
                  onRemove={() => setPaymentRows((p) => p.filter((_, j) => j !== i))}
                  canRemove={paymentRows.length > 1}
                />
              ))}
              <div>
                <button className="btn-sm" type="button" onClick={() => setPaymentRows((p) => [...p, { payment_type: "", units: "", deal_price: "", token: "" }])}>
                  + Add Product / Payment Row
                </button>
              </div>
            </div>

            <Grid>
              <Field label="Token Purchases"><input type="number" style={inputStyle} value={form.token_purchases} onChange={(e) => set("token_purchases", e.target.value)} /></Field>
              <Field label="Final Purchases (used for ROAS)"><input type="number" style={inputStyle} value={form.final_purchases} onChange={(e) => set("final_purchases", e.target.value)} /></Field>
              <Field label="Token Revenue (auto)"><ReadOnly>₹{inr(results.token_revenue)}</ReadOnly></Field>
              <Field label="Final Revenue (auto)"><ReadOnly>₹{inr(results.final_revenue)}</ReadOnly></Field>
              <Field label="Manual Revenue Override (₹)">
                <input
                  type="number"
                  placeholder={revenueBasis === "manual" ? "Required for Manual basis" : "Leave blank to auto-calc"}
                  style={inputStyle}
                  value={form.manual_revenue_override}
                  onChange={(e) => set("manual_revenue_override", e.target.value)}
                />
              </Field>
              <Field label="Total Revenue (auto)">
                <ReadOnly emphasis>₹{inr(results.total_revenue)}</ReadOnly>
              </Field>
            </Grid>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>
                Rows: {paymentRows.length} · Units: {paymentTotals.units} · Row Revenue: ₹{inr(paymentTotals.revenue)}
              </div>
              <button className="btn-sm" type="button" onClick={applyPaymentToForm}>Apply Rows → Final Purchases & Revenue</button>
            </div>

            <Field label="Sales Notes">
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical", marginTop: 12 }}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Key observations, anomalies, follow-ups…"
              />
            </Field>

            <Helper>
              {revenueBasis === "full" && "Full Deal Value: full product price drives ROAS."}
              {revenueBasis === "token" && "Token / Collected: collected/token amount drives ROAS."}
              {revenueBasis === "manual" && "Manual Revenue: your manual override drives ROAS."}
            </Helper>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title={canSeeFinance ? "ROAS, GST & Profit Summary" : "Performance Summary"} helper="Review the final calculation and save.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 12 }}>
              {canSeeFinance && <MetricCard accent="gold" label="ROAS" value={`${dec(results.roas)}x`} helper={health} emphasis />}
              {canSeeFinance && <MetricCard accent={results.pnl >= 0 ? "green" : "red"} label="PNL" value={`₹${inr(results.pnl)}`} />}
              {canSeeFinance && <MetricCard accent="amber" label="CPL" value={`₹${dec(results.cpl)}`} />}
              {canSeeFinance && <MetricCard accent="amber" label="CPP / CPA" value={`₹${dec(results.cpp)}`} />}
              <MetricCard accent="gold" label="Conv. Rate" value={pct(results.final_purchase_conversion)} />
              {canSeeFinance && <MetricCard accent="green" label="Revenue / Lead" value={`₹${dec(results.revenue_per_lead)}`} />}
              {canSeeFinance && <MetricCard accent={results.profit_per_lead >= 0 ? "green" : "red"} label="Profit / Lead" value={`₹${dec(results.profit_per_lead)}`} />}
              {canSeeFinance && <MetricCard accent="green" label="Total Revenue" value={`₹${inr(results.total_revenue)}`} />}
            </div>

            {canSeeFinance && (
              <>
                <h3 style={subheading}>GST Summary</h3>
                <MiniGrid>
                  <MiniMetric label="Ad Spend (Excl GST)" value={`₹${inr(num(adCostExclGst))}`} />
                  <MiniMetric label="GST on Ads" value={`₹${inr(gstAmount)}`} />
                  <MiniMetric label="Ad Spend (Incl GST)" value={`₹${inr(adInclGst)}`} />
                  <MiniMetric label="Input GST Credit" value={`₹${inr(num(inputGstCredit))}`} />
                </MiniGrid>
              </>
            )}

            <h3 style={subheading}>Summary</h3>
            <SummaryTable
              rows={[
                ["Client", form.client_name || "—"],
                ["Media Buyer", form.media_buyer_name || "—"],
                ["Event Type", form.event_type || "—"],
                ["Event Name", form.event_name || "—"],
                ["Event Days", String(totalDays)],
                ...(canSeeFinance ? [["Revenue Basis", REVENUE_BASIS_OPTIONS.find((o) => o.key === revenueBasis)?.label ?? "—"] as [string, string]] : []),
                ["Campaign", `${form.campaign_date_from || "—"} → ${form.campaign_date_to || "—"}`],
                ["Leads", String(num(form.leads))],
                ["Show-up", String(num(form.showup_count))],
                ...(canSeeFinance ? [["Ad Spend", `₹${inr(num(form.ad_spend))}`] as [string, string]] : []),
                ["Final Purchases", String(num(form.final_purchases))],
                ...(canSeeFinance ? [
                  ["Total Revenue", `₹${inr(results.total_revenue)}`] as [string, string],
                  ["ROAS", `${dec(results.roas)}x`] as [string, string],
                  ["PNL", `₹${inr(results.pnl)}`] as [string, string],
                ] : []),
              ]}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              <span className={`status-pill ${HEALTH_PILL_CLASS[health]}`}>{health}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canSeeFinance && <button className="btn-sm" onClick={() => exportRoasSessionCsv(previewSession as any, previewSegments)}>Export CSV</button>}
                {canSeeFinance && <button className="btn-sm" onClick={() => exportRoasSessionPdf(previewSession as any, previewSegments)}>Export PDF</button>}
                {canSeeFinance && (
                  <button
                    className="btn-sm"
                    onClick={async () => {
                      const ok = await copyToClipboard(buildWhatsAppSummary(previewSession as any));
                      setFlash(ok ? "WhatsApp summary copied." : "Could not copy.");
                      setTimeout(() => setFlash(null), 2000);
                    }}
                  >
                    Copy WhatsApp
                  </button>
                )}
                <button className="btn-sm" onClick={() => handleSave(true)} disabled={saving}>{saving ? "Saving…" : "Save & Add Another"}</button>
                <button
                  className="btn-sm btn-primary"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  style={{ background: "var(--ink)", color: "var(--parchment)" }}
                >
                  {saving ? "Saving…" : editId ? "Update Calculation" : "Save Calculation"}
                </button>
              </div>
            </div>
          </StepShell>
        )}
      </div>

      {/* Advanced */}
      <div className="panel" style={{ marginBottom: 18, maxWidth: 960, marginLeft: "auto", marginRight: "auto", padding: "20px 36px" }}>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}
        >
          <span>{showAdvanced ? "▾" : "▸"}</span> Advanced Funnel & Audience Breakdown
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 14, display: "grid", gap: 18 }}>
            <div>
              <FieldLabel>Audience Breakdown</FieldLabel>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {segments.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
                    <input style={inputStyle} placeholder="Segment name" value={s.segment_name} onChange={(e) => setSegments((prev) => prev.map((x, j) => j === i ? { ...x, segment_name: e.target.value } : x))} />
                    <input type="number" style={inputStyle} placeholder="%" value={s.segment_percentage} onChange={(e) => setSegments((prev) => prev.map((x, j) => j === i ? { ...x, segment_percentage: e.target.value } : x))} />
                    <input type="number" style={inputStyle} placeholder="Count" value={s.segment_count} onChange={(e) => setSegments((prev) => prev.map((x, j) => j === i ? { ...x, segment_count: e.target.value } : x))} />
                    <button className="btn-sm" type="button" onClick={() => setSegments((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button className="btn-sm" type="button" onClick={() => setSegments((p) => [...p, { segment_name: "", segment_percentage: "", segment_count: "" }])}>+ Add Audience Segment</button>
                  <div style={{ fontSize: 12, color: segmentTotal > 0 && Math.abs(segmentTotal - 100) > 1 ? "var(--amber)" : "var(--ink4)" }}>
                    Total: {dec(segmentTotal, 1)}% {segmentTotal > 0 && Math.abs(segmentTotal - 100) > 1 ? "⚠" : ""}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>Funnel Metrics</FieldLabel>
              <Grid>
                <Field label="Heard Count"><input type="number" style={inputStyle} value={form.heard_count} onChange={(e) => set("heard_count", e.target.value)} /></Field>
                <Field label="Sales Count"><input type="number" style={inputStyle} value={form.sales_count} onChange={(e) => set("sales_count", e.target.value)} /></Field>
                <Field label="Offer Show-up Count"><input type="number" style={inputStyle} value={form.offer_showup_count} onChange={(e) => set("offer_showup_count", e.target.value)} /></Field>
                <Field label="Offer Show-up % (auto)"><ReadOnly>{pct(results.offer_showup_percent)}</ReadOnly></Field>
                <Field label="Lead Drop Rate (%)"><input type="number" style={inputStyle} value={form.lead_drop_rate} onChange={(e) => set("lead_drop_rate", e.target.value)} /></Field>
                <Field label="CPL Drop %"><input type="number" style={inputStyle} value={form.cpl_drop_percent} onChange={(e) => set("cpl_drop_percent", e.target.value)} /></Field>
              </Grid>
            </div>
          </div>
        )}
      </div>

      {/* Wizard nav */}
      <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", maxWidth: 960, marginLeft: "auto", marginRight: "auto", padding: "16px 36px" }}>
        <button className="btn-sm" type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>← Previous</button>
        <div style={{ fontSize: 12, color: "var(--ink4)" }}>Step {step} of {STEPS.length}</div>
        {step < STEPS.length ? (
          <button
            className="btn-sm btn-primary"
            type="button"
            style={{ background: "var(--ink)", color: "var(--parchment)" }}
            onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
          >
            Next →
          </button>
        ) : (
          <button
            className="btn-sm btn-primary"
            type="button"
            disabled={saving}
            style={{ background: "var(--ink)", color: "var(--parchment)" }}
            onClick={() => handleSave(false)}
          >
            {saving ? "Saving…" : editId ? "Update Calculation" : "Save Calculation"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Helpers / sub-components ----------

function emptyDay(): DayDraft {
  return { date: "", start_time: "", end_time: "", watch_point: "70", leads: "", showup: "", watch_point_present: "" };
}

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="vc-stepper">
      {STEPS.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        const cls = `step${active ? " active" : ""}${done ? " done" : ""}`;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "flex-start" }}>
            <button type="button" onClick={() => onJump(s.n)} className={cls}>
              <span className="num">{done ? "✓" : s.n}</span>
              <span className="lbl">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`conn${done ? " done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

function SummaryStrip({ results, health, hasInputs, canSeeFinance }: { results: ReturnType<typeof computeRoas>; health: ReturnType<typeof classifyHealth>; hasInputs: boolean; canSeeFinance: boolean }) {
  if (!hasInputs) {
    return (
      <div className="panel" style={{ marginBottom: 18, fontSize: 13, color: "var(--ink4)", fontStyle: "italic", textAlign: "center" }}>
        {canSeeFinance
          ? "Complete steps to see live ROAS, revenue, and PNL here."
          : "Complete steps to see live performance metrics here."}
      </div>
    );
  }
  return (
    <div
      className="panel"
      style={{
        marginBottom: 18,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
      }}
    >
      {canSeeFinance && <Tiny label="ROAS" value={`${dec(results.roas)}x`} />}
      {canSeeFinance && <Tiny label="Revenue" value={`₹${inr(results.total_revenue)}`} />}
      {canSeeFinance && <Tiny label="PNL" value={`₹${inr(results.pnl)}`} tone={results.pnl >= 0 ? "good" : "bad"} />}
      {canSeeFinance && <Tiny label="CPL" value={`₹${dec(results.cpl)}`} />}
      {canSeeFinance && <Tiny label="CPP" value={`₹${dec(results.cpp)}`} />}
      <Tiny label="Health" value={health} tone={health === "Excellent" || health === "Good" ? "good" : health === "Watch" ? "warn" : "bad"} />
    </div>
  );
}

function Tiny({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "var(--green)" : tone === "warn" ? "var(--amber)" : tone === "bad" ? "var(--red)" : "var(--ink)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</span>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function StepShell({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 16 }}>{helper}</p>
      {children}
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 14, fontSize: 12, color: "var(--ink4)", fontStyle: "italic" }}>{children}</p>
  );
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  // 2-column on desktop, single column under ~720px. Generous gaps for calm rhythm.
  const tpl =
    cols === 1
      ? "minmax(0, 1fr)"
      : cols === 3
      ? "repeat(auto-fit, minmax(220px, 1fr))"
      : "repeat(auto-fit, minmax(280px, 1fr))";
  return (
    <div style={{ display: "grid", gridTemplateColumns: tpl, gap: "20px 24px" }}>
      {children}
    </div>
  );
}

function Section({ title, children, helper }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink3)" }}>{title}</div>
        {helper && <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 4 }}>{helper}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10, marginTop: 14 }}>
      {children}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--parchment2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ minWidth: 0 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

function ReadOnly({ children, emphasis = false }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <div style={{ ...inputStyle, background: "var(--parchment2)", fontWeight: emphasis ? 600 : 400 }}>{children}</div>
  );
}

function PillGroup({ options, value, onChange }: { options: { k: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const active = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
              background: active ? "var(--ink)" : "var(--parchment)",
              color: active ? "var(--parchment)" : "var(--ink)",
              fontSize: 12.5,
              fontFamily: "'Figtree',sans-serif",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DayCard({ index, day, onChange }: { index: number; day: DayDraft; onChange: (d: DayDraft) => void }) {
  const minutes = (() => {
    if (!day.start_time || !day.end_time) return 0;
    const [sh, sm] = day.start_time.split(":").map(Number);
    const [eh, em] = day.end_time.split(":").map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    return total > 0 ? total : 0;
  })();
  const watchPointMin = Math.round(minutes * (num(day.watch_point) / 100));
  const set = (k: keyof DayDraft, v: string) => onChange({ ...day, [k]: v });
  const dropRate = num(day.leads) > 0 ? 1 - num(day.showup) / num(day.leads) : 0;
  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--parchment)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>Day {index + 1}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>
          {minutes > 0 ? `${minutes} min total · WP at ${watchPointMin} min` : "Set start & end time"}
        </div>
      </div>
      <Grid>
        <Field label="Date"><input type="date" style={inputStyle} value={day.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Start Time"><input type="time" style={inputStyle} value={day.start_time} onChange={(e) => set("start_time", e.target.value)} /></Field>
        <Field label="End Time"><input type="time" style={inputStyle} value={day.end_time} onChange={(e) => set("end_time", e.target.value)} /></Field>
        <Field label="Watch Point %">
          <select style={inputStyle} value={day.watch_point} onChange={(e) => set("watch_point", e.target.value)}>
            {WATCH_POINT_OPTIONS.map((o) => <option key={o} value={o}>{o}%</option>)}
          </select>
        </Field>
        <Field label="Registrations / Leads"><input type="number" style={inputStyle} value={day.leads} onChange={(e) => set("leads", e.target.value)} /></Field>
        <Field label="Show-up Count"><input type="number" style={inputStyle} value={day.showup} onChange={(e) => set("showup", e.target.value)} /></Field>
        <Field label="At Watch Point"><input type="number" style={inputStyle} value={day.watch_point_present} onChange={(e) => set("watch_point_present", e.target.value)} /></Field>
        <Field label="Drop Rate (auto)"><ReadOnly>{pct(dropRate)}</ReadOnly></Field>
      </Grid>
    </div>
  );
}

function PaymentRowEditor({
  row, revenueBasis, onChange, onRemove, canRemove,
}: {
  row: PaymentRow;
  revenueBasis: "full" | "token" | "manual";
  onChange: (r: PaymentRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const set = (k: keyof PaymentRow, v: string) => onChange({ ...row, [k]: v });
  const rowRevenue = num(row.units) * (revenueBasis === "token" && num(row.token) > 0 ? num(row.token) : num(row.deal_price));
  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--parchment)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <QuickSaveSelect label="Payment / Product Type" group="roas_payment_type" value={row.payment_type} onChange={(v) => set("payment_type", v)} defaults={PAYMENT_TYPE_DEFAULTS} />
        <Field label="Units"><input type="number" style={inputStyle} value={row.units} onChange={(e) => set("units", e.target.value)} /></Field>
        <Field label="Deal Price (₹)"><input type="number" style={inputStyle} value={row.deal_price} onChange={(e) => set("deal_price", e.target.value)} /></Field>
        <Field label="Token (₹)"><input type="number" style={inputStyle} value={row.token} onChange={(e) => set("token", e.target.value)} /></Field>
        <Field label="Row Revenue"><ReadOnly>₹{inr(rowRevenue)}</ReadOnly></Field>
        <button className="btn-sm" type="button" disabled={!canRemove} onClick={onRemove} style={{ height: 38 }}>×</button>
      </div>
    </div>
  );
}

function SummaryTable({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--ivory)", marginTop: 8 }}>
      {rows.map(([k, v], i) => (
        <div
          key={k}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            padding: "10px 14px",
            fontSize: 13,
            background: i % 2 ? "var(--parchment)" : "transparent",
            borderTop: i ? "1px solid var(--border)" : "none",
          }}
        >
          <span style={{ color: "var(--ink3)", fontFamily: "'DM Mono',monospace", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase" }}>{k}</span>
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const subheading: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--ink)",
  marginTop: 22,
  marginBottom: 10,
};
