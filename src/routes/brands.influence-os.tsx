import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/brands/influence-os")({
  component: () => (
    <Placeholder
      eyebrow="Brand · Influence OS"
      title="Influence OS"
      icon="●"
      message="Creator roster, campaign P&L, and brand health for Influence OS will appear here once the drill-down module is built."
      documentTitle="Influence OS | GWV Vision Center"
    />
  ),
});
