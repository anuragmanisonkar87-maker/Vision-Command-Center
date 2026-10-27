// Media Buyer Performance — Activity Hub.
// This is the parent landing for the Media Buyer position. It does NOT
// open Daily Reporting directly — Daily Reporting is one activity card.

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import { PageHeader, MetricCard } from "@/components/marketizers/ui";
import ActivityCard from "@/components/marketizers/team-performance/ActivityCard";
import {
  MEDIA_BUYER_ACTIVITIES,
  DAILY_REPORTING_ROUTE,
  SEMINAR_ROAS_ROUTE,
  REPORTS_HISTORY_ROUTE,
  type ActivityDef,
} from "@/config/marketizersTeamPerformanceModules";
import { getMonthRoasSummary, type MonthSummary } from "@/services/marketizers/roasService";
import { cached } from "@/lib/cacheTtl";

async function fetchMediaBuyerHubSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const month = today.slice(0, 7);
  const [{ data: todays }, { data: monthReports }, roasSum] = await Promise.all([
    (supabase as any).from("daily_lead_reports").select("id").eq("report_date", today),
    (supabase as any)
      .from("daily_lead_reports")
      .select("id, daily_lead_report_media_buyers(total_leads,total_ad_spend)")
      .gte("report_date", monthStart),
    getMonthRoasSummary(month).catch(() => null),
  ]);
  let monthLeads = 0;
  let monthSpend = 0;
  for (const r of (monthReports as any[]) || []) {
    for (const mb of r.daily_lead_report_media_buyers || []) {
      monthLeads += Number(mb.total_leads) || 0;
      monthSpend += Number(mb.total_ad_spend) || 0;
    }
  }
  return {
    todaysReports: (todays as any[])?.length || 0,
    monthLeads,
    monthSpend,
    monthAvgCpl: monthLeads > 0 ? monthSpend / monthLeads : 0,
    roas: roasSum as MonthSummary | null,
  };
}

export function prefetchMediaBuyerHub() {
  return cached("mb:hub:summary", fetchMediaBuyerHubSummary);
}

const inr = (n: number) =>
  isFinite(n)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)
    : "0";

type Summary = {
  todaysReports: number;
  monthLeads: number;
  monthSpend: number;
  monthAvgCpl: number;
  loaded: boolean;
};

const EMPTY_SUMMARY: Summary = {
  todaysReports: 0,
  monthLeads: 0,
  monthSpend: 0,
  monthAvgCpl: 0,
  loaded: false,
};

export default function MediaBuyerHubPage() {
  const { user } = useAuth();
  const access = useEffectiveAccess();
  const admin = isAdmin(user);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [roas, setRoas] = useState<MonthSummary | null>(null);

  useEffect(() => {
    document.title = "Media Buyer Performance | Marketizers | GWV Vision Center";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await cached("mb:hub:summary", fetchMediaBuyerHubSummary);
        if (cancelled) return;
        setSummary({
          todaysReports: r.todaysReports,
          monthLeads: r.monthLeads,
          monthSpend: r.monthSpend,
          monthAvgCpl: r.monthAvgCpl,
          loaded: true,
        });
        setRoas(r.roas);
      } catch {
        if (!cancelled) setSummary({ ...EMPTY_SUMMARY, loaded: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter cards by access; admin sees everything.
  const visibleActivities: ActivityDef[] = MEDIA_BUYER_ACTIVITIES.filter((a) => {
    if (admin) return true;
    if (access.isLoading) return true; // optimistic; guard catches denied opens
    return access.canAccessModule(a.key) || a.status !== "active";
  });

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers / Team Performance"
        title="Media Buyer Performance"
        subtitle="Track daily performance, ad spend, leads, CPL, campaign health, and reporting activities for media buying operations."
        actions={
          <>
            <Link to="/brands/marketizers/team-performance">
              <button className="btn-sm">← Back to Team Performance</button>
            </Link>
            <Link to={REPORTS_HISTORY_ROUTE}>
              <button className="btn-sm">View History</button>
            </Link>
            <Link to={DAILY_REPORTING_ROUTE} search={{ mode: "new" }}>
              <button className="btn-sm">+ New Daily Report</button>
            </Link>
            <Link to={SEMINAR_ROAS_ROUTE}>
              <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)" }}>
                + New ROAS Calculation
              </button>
            </Link>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <MetricCard
          accent="gold"
          label="Today's Reports"
          value={summary.loaded ? String(summary.todaysReports) : "—"}
          helper={summary.loaded && summary.todaysReports === 0 ? "No reports yet" : undefined}
        />
        <MetricCard
          accent="green"
          label="Leads This Month"
          value={summary.loaded ? inr(summary.monthLeads) : "—"}
        />
        <MetricCard
          accent="amber"
          label="Ad Spend This Month"
          value={summary.loaded ? `₹${inr(summary.monthSpend)}` : "—"}
        />
        <MetricCard
          accent="gold"
          label="Avg CPL This Month"
          value={summary.loaded ? `₹${inr(summary.monthAvgCpl)}` : "—"}
        />
        <MetricCard
          accent="green"
          label="ROAS Revenue (Month)"
          value={`₹${inr(roas?.totalRevenue ?? 0)}`}
          helper={roas ? `${roas.sessions} session${roas.sessions === 1 ? "" : "s"}` : undefined}
        />
        <MetricCard
          accent={(roas?.totalPnl ?? 0) >= 0 ? "green" : "amber"}
          label="ROAS PNL (Month)"
          value={`₹${inr(roas?.totalPnl ?? 0)}`}
        />
      </div>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Activities</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {visibleActivities.map((a) => (
          <ActivityCard
            key={a.key}
            title={a.title}
            description={a.description}
            status={a.status}
            route={a.route}
            secondaryLinks={a.secondaryLinks}
            primaryActionLabel={
              a.title === "Daily Reporting"
                ? "Open Daily Reporting"
                : a.title === "Seminar / Webinar ROAS Tracker"
                  ? "Open ROAS Tracker"
                  : a.title === "Reports & History"
                    ? "Open Reports & History"
                    : a.title === "Settings & Master Data"
                      ? "Open Settings"
                      : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
