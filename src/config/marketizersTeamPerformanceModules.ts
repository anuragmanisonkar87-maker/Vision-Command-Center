// Marketizers Team Performance — module + activity registry.
// Local config for now. Structured so it can later be migrated to the
// gwv_modules / access-control registry without changes to consumers.

export type ActivityStatus =
  | "active"
  | "connected"
  | "foundation_ready"
  | "coming_soon"
  | "locked";

export type ActivityDef = {
  key: string;
  parentKey: string;
  type: "position_module" | "activity";
  title: string;
  description: string;
  status: ActivityStatus;
  route?: string;
  secondaryLinks?: { label: string; route: string }[];
};

export const MARKETIZERS_MEDIA_BUYER_HUB_KEY =
  "marketizers_media_buyer_performance";

export const MEDIA_BUYER_HUB_ROUTE =
  "/brands/marketizers/team-performance/media-buyer-performance";

export const DAILY_REPORTING_ROUTE = `${MEDIA_BUYER_HUB_ROUTE}/daily-reporting`;
export const SEMINAR_ROAS_ROUTE = `${MEDIA_BUYER_HUB_ROUTE}/seminar-roas`;
export const REPORTS_HISTORY_ROUTE = `${MEDIA_BUYER_HUB_ROUTE}/reports-history`;
export const SETTINGS_ROUTE = `${MEDIA_BUYER_HUB_ROUTE}/settings`;

export const MEDIA_BUYER_ACTIVITIES: ActivityDef[] = [
  {
    key: "marketizers_media_buyer_daily_reporting",
    parentKey: MARKETIZERS_MEDIA_BUYER_HUB_KEY,
    type: "activity",
    title: "Daily Reporting",
    description:
      "Add daily media buyer reports with ad spend, leads, CPL, CPM, CPC, CTR, lead source sheets, and campaign metrics.",
    status: "active",
    route: DAILY_REPORTING_ROUTE,
    secondaryLinks: [
      { label: "New Report", route: `${DAILY_REPORTING_ROUTE}?mode=new` },
      { label: "History", route: `${DAILY_REPORTING_ROUTE}?tab=history` },
    ],
  },
  {
    key: "marketizers_media_buyer_seminar_roas",
    parentKey: MARKETIZERS_MEDIA_BUYER_HUB_KEY,
    type: "activity",
    title: "Seminar / Webinar ROAS Tracker",
    description:
      "Calculate ROAS, PNL, CPL, CPP, funnel conversion, and audience-segment performance for seminars, webinars, and bootcamps.",
    status: "active",
    route: SEMINAR_ROAS_ROUTE,
    secondaryLinks: [
      { label: "New ROAS Calculation", route: SEMINAR_ROAS_ROUTE },
      { label: "ROAS History", route: `${REPORTS_HISTORY_ROUTE}?tab=roas` },
    ],
  },
  {
    key: "marketizers_media_buyer_reports_history",
    parentKey: MARKETIZERS_MEDIA_BUYER_HUB_KEY,
    type: "activity",
    title: "Reports & History",
    description:
      "ROAS history, daily reports, client-wise & media-buyer-wise performance, trends, and trash/restore.",
    status: "active",
    route: REPORTS_HISTORY_ROUTE,
  },
  {
    key: "marketizers_media_buyer_settings_master_data",
    parentKey: MARKETIZERS_MEDIA_BUYER_HUB_KEY,
    type: "activity",
    title: "Settings & Master Data",
    description:
      "Manage event types, audience segments, ROAS thresholds, revenue formula defaults, lead-source mapping, and metric templates.",
    status: "active",
    route: SETTINGS_ROUTE,
  },
];

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  active: "Active",
  connected: "Connected",
  foundation_ready: "Foundation Ready",
  coming_soon: "Coming Soon",
  locked: "Locked",
};

export const STATUS_PILL_CLASS: Record<ActivityStatus, string> = {
  active: "sp-profit",
  connected: "sp-profit",
  foundation_ready: "sp-warn",
  coming_soon: "sp-warn",
  locked: "sp-loss",
};
