import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/marketizers/ui";
import MediaBuyerPerformanceModule from "@/components/marketizers/media-buyer/MediaBuyerPerformanceModule";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance/daily-reporting",
)({
  component: DailyReportingPage,
  validateSearch: (s: Record<string, unknown>): { mode?: string; editReportId?: string } => {
    const out: { mode?: string; editReportId?: string } = {};
    if (typeof s.mode === "string" && s.mode) out.mode = s.mode;
    if (typeof s.editReportId === "string" && s.editReportId) out.editReportId = s.editReportId;
    return out;
  },
});

function DailyReportingPage() {
  useEffect(() => {
    document.title = "Daily Reporting | Media Buyer Performance | GWV Vision Center";
  }, []);
  const editReportId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("editReportId")
      : null;
  return (
    <ModuleGuard moduleKey="marketizers_media_buyer_daily_reporting" label="Daily Reporting">
      <div>
        <PageHeader
          eyebrow="Marketizers / Team Performance / Media Buyer Performance"
          title="Daily Reporting"
          subtitle="Daily ad spend, leads, CPL, and campaign performance reporting."
          actions={
            <Link to="/brands/marketizers/team-performance/media-buyer-performance">
              <button className="btn-sm">← Back to Media Buyer Performance</button>
            </Link>
          }
        />
        <MediaBuyerPerformanceModule initialEditReportId={editReportId} />
      </div>
    </ModuleGuard>
  );
}
