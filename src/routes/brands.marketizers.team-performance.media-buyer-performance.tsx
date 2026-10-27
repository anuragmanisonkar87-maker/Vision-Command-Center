import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance",
)({
  component: () => (
    <ModuleGuard moduleKey="marketizers_media_buyer_performance" label="Media Buyer Performance">
      <Outlet />
    </ModuleGuard>
  ),
});
