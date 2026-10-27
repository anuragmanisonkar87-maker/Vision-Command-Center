import { createFileRoute } from "@tanstack/react-router";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";
import KpiHistoryPage from "@/components/kpi/KpiHistoryPage";

export const Route = createFileRoute("/kpi/history")({
  component: () => (
    <ModuleGuard moduleKey="kpi_history" action="view" label="KPI History">
      <KpiHistoryPage />
    </ModuleGuard>
  ),
});
