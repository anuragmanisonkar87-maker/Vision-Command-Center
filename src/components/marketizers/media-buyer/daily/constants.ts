import type { DailyMetricDef } from "@/lib/mediaBuyer/helpers";

export const DEFAULT_BASIC_METRICS_KEY: DailyMetricDef[] = [
  { key: "cpm", name: "CPM", type: "currency", aggregation: "average", whatsapp: true, exports: true },
  { key: "ctr", name: "CTR", type: "percentage", aggregation: "average", whatsapp: true, exports: true },
  { key: "cpc", name: "CPC", type: "currency", aggregation: "average", whatsapp: true, exports: true },
  { key: "link_clicks", name: "Link Clicks", type: "number", aggregation: "sum", whatsapp: false, exports: true },
  { key: "lp_views", name: "Landing Page Views", type: "number", aggregation: "sum", whatsapp: false, exports: true },
  { key: "lp_visit_rate", name: "Landing Page Visit Rate", type: "percentage", aggregation: "average", whatsapp: true, exports: true },
];
