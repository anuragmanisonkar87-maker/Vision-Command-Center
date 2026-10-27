import { createFileRoute } from "@tanstack/react-router";
import RoasSettingsPage from "@/components/marketizers/roas/RoasSettingsPage";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance/settings",
)({
  component: () => (
    <ModuleGuard
      moduleKey="marketizers_media_buyer_settings_master_data"
      action="manage"
      label="Settings / Master Data"
    >
      <RoasSettingsPage />
    </ModuleGuard>
  ),
});
