import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy route — Media Buyer Performance is now an Activity Hub. Redirect
// straight to the new hub so existing bookmarks keep working.
export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer",
)({
  component: () => (
    <Navigate to="/brands/marketizers/team-performance/media-buyer-performance" replace />
  ),
});
