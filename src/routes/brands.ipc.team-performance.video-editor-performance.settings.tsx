import { createFileRoute } from "@tanstack/react-router";
import VideoEditorSettingsPage from "@/components/videoEditor/VideoEditorSettingsPage";

export const Route = createFileRoute(
  "/brands/ipc/team-performance/video-editor-performance/settings",
)({
  component: VideoEditorSettingsPage,
});
