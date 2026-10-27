import { createFileRoute } from "@tanstack/react-router";
import VideoEditorDailyReportingPage from "@/components/videoEditor/VideoEditorDailyReportingPage";

export const Route = createFileRoute(
  "/brands/ipc/team-performance/video-editor-performance/daily-reporting",
)({
  component: VideoEditorDailyReportingPage,
});
