import { createFileRoute } from "@tanstack/react-router";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";
import KpiDailyReportingPage from "@/components/kpi/KpiDailyReportingPage";

export const Route = createFileRoute("/kpi/daily")({
  component: () => (
    <ModuleGuard moduleKey="kpi_daily_reporting" action="view" label="Daily KPI">
      <KpiDailyReportingPage />
    </ModuleGuard>
  ),
});
