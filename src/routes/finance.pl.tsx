import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute("/finance/pl")({
  component: () => (
    <ModuleGuard moduleKey="finance_pl" label="P&L Reports">
      <Placeholder
        eyebrow="Finance"
        title="P&L Reports"
        icon="❖"
        message="Profit and loss reports will compile from revenue and expense entries once those modules are live."
        documentTitle="P&L Reports | GWV Vision Center"
      />
    </ModuleGuard>
  ),
});
