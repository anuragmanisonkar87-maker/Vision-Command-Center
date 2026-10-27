import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/marketizers/ui";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import {
  MARKETIZERS_MEDIA_BUYER_HUB_KEY,
  DAILY_REPORTING_ROUTE,
  SEMINAR_ROAS_ROUTE,
  REPORTS_HISTORY_ROUTE,
  MEDIA_BUYER_HUB_ROUTE,
} from "@/config/marketizersTeamPerformanceModules";


export const Route = createFileRoute("/brands/marketizers")({
  component: MarketizersRoute,
});

function MarketizersRoute() {
  const location = useLocation();
  if (location.pathname === "/brands/marketizers") return <MarketizersHub />;
  return <Outlet />;
}

type ModuleCard = {
  title: string;
  description: string;
  status: "Active" | "Foundation Ready" | "Coming Soon";
  primary: { label: string; to: string };
  links?: { label: string; to: string }[];
};

const MODULES: ModuleCard[] = [
  {
    title: "Revenue & Finance",
    description: "Revenue tracking, monthly entries, collections, expenses, P&L.",
    status: "Active",
    primary: { label: "Open Revenue Dashboard", to: "/brands/marketizers/revenue" },
    links: [
      { label: "Monthly Entry", to: "/brands/marketizers/revenue/entry" },
      { label: "Pending Collections", to: "/brands/marketizers/revenue/collections" },
      { label: "Expenses Center", to: "/brands/marketizers/revenue/expenses" },
      { label: "Reports", to: "/brands/marketizers/revenue/reports" },
    ],
  },
  {
    title: "Team Performance",
    description: "Daily reporting and performance tracking for media buyers, creatives, sales, and operations.",
    status: "Foundation Ready",
    primary: { label: "Open Module", to: "/brands/marketizers/team-performance" },
  },
  {
    title: "Client Management",
    description: "Client accounts, client history, active and paused clients.",
    status: "Active",
    primary: { label: "Open Clients", to: "/brands/marketizers/revenue/clients" },
  },
  {
    title: "Reports & Intelligence",
    description: "Revenue reports, P&L, growth, client performance insights.",
    status: "Active",
    primary: { label: "Open Reports", to: "/brands/marketizers/revenue/reports" },
    links: [
      { label: "P&L Report", to: "/brands/marketizers/revenue/reports/pl" },
      { label: "Growth", to: "/brands/marketizers/revenue/reports/growth" },
      { label: "Leaderboard", to: "/brands/marketizers/revenue/reports/leaderboard" },
    ],
  },
  {
    title: "Settings & Master Data",
    description: "Reusable dropdowns, brands, roles, categories, and internal settings.",
    status: "Active",
    primary: { label: "Open Settings", to: "/settings/brands" },
  },
];

function MarketizersHub() {
  useEffect(() => { document.title = "Marketizers Hub | GWV Vision Center"; }, []);
  return (
    <div>
      <PageHeader
        eyebrow="Marketizers"
        title="Marketizers Module Hub"
        subtitle="One landing page for all Marketizers modules — finance, team performance, clients, reports, and settings."
      />
      <QuickActions />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {MODULES.map((m) => (
          <ModuleCardView key={m.title} mod={m} />
        ))}
      </div>
    </div>
  );
}

type QuickAction = {
  label: string;
  helper: string;
  to: string;
  moduleKey: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Open Daily Reporting",
    helper: "Log today's media buyer performance.",
    to: DAILY_REPORTING_ROUTE,
    moduleKey: "marketizers_media_buyer_daily_reporting",
  },
  {
    label: "Media Buyer Performance",
    helper: "ROAS, reports, history, daily reporting.",
    to: MEDIA_BUYER_HUB_ROUTE,
    moduleKey: MARKETIZERS_MEDIA_BUYER_HUB_KEY,
  },
  {
    label: "Seminar ROAS Tracker",
    helper: "Track event revenue, spend, ROAS.",
    to: SEMINAR_ROAS_ROUTE,
    moduleKey: "marketizers_media_buyer_seminar_roas",
  },
  {
    label: "Reports & History",
    helper: "Review previous performance records.",
    to: REPORTS_HISTORY_ROUTE,
    moduleKey: "marketizers_media_buyer_reports_history",
  },
];

function QuickActions() {
  const { canAccessModule, isLoading } = useEffectiveAccess();
  if (isLoading) return null;
  const visible = QUICK_ACTIONS.filter((a) => canAccessModule(a.moduleKey));
  if (visible.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: ".14em",
        textTransform: "uppercase", color: "var(--gold)", marginBottom: 10,
      }}>
        Quick Actions
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {visible.map((a) => (
          <Link key={a.to} to={a.to} style={{ textDecoration: "none" }}>
            <div className="panel" style={{
              padding: 14, display: "flex", flexDirection: "column", gap: 6,
              borderLeft: "3px solid var(--gold)", cursor: "pointer",
            }}>
              <div style={{
                fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700,
                color: "var(--ink)",
              }}>{a.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.45 }}>{a.helper}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


function ModuleCardView({ mod }: { mod: ModuleCard }) {
  const tone =
    mod.status === "Active" ? "sp-profit" :
    mod.status === "Foundation Ready" ? "sp-warn" : "sp-loss";
  return (
    <div className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
          {mod.title}
        </div>
        <span className={`status-pill ${tone}`}>{mod.status}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.5 }}>{mod.description}</div>
      <Link to={mod.primary.to} style={{ alignSelf: "flex-start" }}>
        <button className="btn-sm btn-primary">{mod.primary.label}</button>
      </Link>
      {mod.links && mod.links.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8, borderTop: "1px solid var(--parchment2)" }}>
          {mod.links.map((l) => (
            <Link key={l.to} to={l.to} style={{
              fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: ".06em",
              padding: "3px 8px", borderRadius: 4, background: "var(--parchment)",
              color: "var(--ink3)", border: "1px solid var(--border)",
            }}>{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
