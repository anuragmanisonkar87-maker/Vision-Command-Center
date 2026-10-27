import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/brands/mulberry")({
  component: () => (
    <Placeholder
      eyebrow="Brand · The Mulberry Weddings"
      title="The Mulberry Weddings"
      icon="●"
      message="Booking pipeline, brand P&L, and crew utilisation will appear here once the brand drill-down module is built."
      documentTitle="The Mulberry Weddings | GWV Vision Center"
    />
  ),
});
