// Marketizers Seminar/Webinar ROAS — pure formula helpers.
// All formulas guard against divide-by-zero. Never returns NaN/Infinity.

export type RoasInputs = {
  ad_spend: number;
  leads: number;
  token_purchases: number;
  final_purchases: number;
  token_amount: number;
  product_final_value: number;
  manual_revenue_override?: number | null;
  showup_count?: number | null;
  offer_showup_count?: number | null;
  heard_count?: number | null;
  sales_count?: number | null;
};

export type RoasOutputs = {
  cpl: number;
  cpp: number;
  token_revenue: number;
  final_revenue: number;
  total_revenue: number;
  roas: number;
  pnl: number;
  final_purchase_conversion: number;
  revenue_per_lead: number;
  profit_per_lead: number;
  showup_percent: number;
  offer_showup_percent: number;
};

export type HealthBand = "Excellent" | "Good" | "Watch" | "Critical";

export const safeDiv = (n: number, d: number): number =>
  d > 0 && Number.isFinite(n) && Number.isFinite(d) ? n / d : 0;

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export function computeRoas(input: RoasInputs): RoasOutputs {
  const ad_spend = num(input.ad_spend);
  const leads = num(input.leads);
  const token_purchases = num(input.token_purchases);
  const final_purchases = num(input.final_purchases);
  const token_amount = num(input.token_amount);
  const product_final_value = num(input.product_final_value);

  const token_revenue = token_purchases * token_amount;
  const final_revenue = final_purchases * product_final_value;
  const computed_total = token_revenue + final_revenue;
  const total_revenue =
    input.manual_revenue_override != null && input.manual_revenue_override > 0
      ? num(input.manual_revenue_override)
      : computed_total;

  const roas = safeDiv(total_revenue, ad_spend);
  const pnl = total_revenue - ad_spend;
  const cpl = safeDiv(ad_spend, leads);
  const cpp = safeDiv(ad_spend, final_purchases);
  const final_purchase_conversion = safeDiv(final_purchases, leads);
  const revenue_per_lead = safeDiv(total_revenue, leads);
  const profit_per_lead = safeDiv(pnl, leads);

  const showup_count = num(input.showup_count);
  const offer_showup_count = num(input.offer_showup_count);
  const showup_percent = safeDiv(showup_count, leads);
  const offer_showup_percent = safeDiv(offer_showup_count, showup_count || leads);

  return {
    cpl,
    cpp,
    token_revenue,
    final_revenue,
    total_revenue,
    roas,
    pnl,
    final_purchase_conversion,
    revenue_per_lead,
    profit_per_lead,
    showup_percent,
    offer_showup_percent,
  };
}

export const DEFAULT_HEALTH_THRESHOLDS = {
  excellent: 5,
  good: 3,
  watch: 2,
};

export function classifyHealth(
  roas: number,
  t = DEFAULT_HEALTH_THRESHOLDS,
): HealthBand {
  if (!Number.isFinite(roas) || roas <= 0) return "Critical";
  if (roas >= t.excellent) return "Excellent";
  if (roas >= t.good) return "Good";
  if (roas >= t.watch) return "Watch";
  return "Critical";
}

export const HEALTH_PILL_CLASS: Record<HealthBand, string> = {
  Excellent: "sp-profit",
  Good: "sp-profit",
  Watch: "sp-warn",
  Critical: "sp-loss",
};

// INR formatter
export const inr = (n: number): string =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)
    : "0";

export const pct = (n: number, digits = 1): string =>
  Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "0%";

export const dec = (n: number, digits = 2): string =>
  Number.isFinite(n) ? n.toFixed(digits) : "0";
