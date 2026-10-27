import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute("/finance/revenue")({
  component: () => (
    <ModuleGuard moduleKey="finance_revenue" label="Revenue Tracking">
      <Placeholder
        eyebrow="Finance"
        title="Revenue Tracking"
        icon="₹"
        message="Revenue Tracking will be available once the finance data architecture is complete."
        documentTitle="Revenue Tracking | GWV Vision Center"
      />
    </ModuleGuard>
  ),
});
