import { createFileRoute } from "@tanstack/react-router";
import RoasReportsHistoryPage from "@/components/marketizers/roas/RoasReportsHistoryPage";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance/reports-history",
)({
  component: () => (
    <ModuleGuard moduleKey="marketizers_media_buyer_reports_history" label="Reports & History">
      <RoasReportsHistoryPage />
    </ModuleGuard>
  ),
});
