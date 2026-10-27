import { createFileRoute } from "@tanstack/react-router";
import VideoEditorHistoryPage from "@/components/videoEditor/VideoEditorHistoryPage";

export const Route = createFileRoute(
  "/brands/ipc/team-performance/video-editor-performance/reports-history",
)({
  component: VideoEditorHistoryPage,
});
