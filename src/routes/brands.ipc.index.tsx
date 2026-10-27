import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/brands/ipc/")({
  component: () => (
    <Placeholder
      eyebrow="Brand · India Photographers Club"
      title="India Photographers Club"
      icon="●"
      message="The brand-level P&L, revenue trends, and team view will appear here once the brand drill-down module is built."
      documentTitle="India Photographers Club | GWV Vision Center"
    />
  ),
});
