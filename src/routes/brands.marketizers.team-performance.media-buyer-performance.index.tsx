import { createFileRoute } from "@tanstack/react-router";
import MediaBuyerHubPage, { prefetchMediaBuyerHub } from "@/components/marketizers/team-performance/MediaBuyerHubPage";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance/",
)({
  loader: () => { void prefetchMediaBuyerHub(); },
  component: MediaBuyerHubPage,
});
