import { createFileRoute } from "@tanstack/react-router";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";
import KpiSettingsPage from "@/components/kpi/KpiSettingsPage";

export const Route = createFileRoute("/kpi/settings")({
  component: () => (
    <ModuleGuard moduleKey="kpi_settings" action="manage" label="KPI Settings">
      <KpiSettingsPage />
    </ModuleGuard>
  ),
});
