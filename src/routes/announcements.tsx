import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/announcements")({
  component: () => (
    <Placeholder
      eyebrow="Overview"
      title="Announcements"
      icon="✦"
      message="Company-wide and brand-specific announcements will appear here once the messaging module is connected."
      documentTitle="Announcements | GWV Vision Center"
    />
  ),
});
