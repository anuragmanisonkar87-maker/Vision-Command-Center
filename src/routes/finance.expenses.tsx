import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute("/finance/expenses")({
  component: () => (
    <ModuleGuard moduleKey="finance_expenses" label="Expense Log">
      <Placeholder
        eyebrow="Finance"
        title="Expense Log"
        icon="◉"
        message="The expense log will track every category, brand, and receipt once the entry forms and approvals are wired up."
        documentTitle="Expense Log | GWV Vision Center"
      />
    </ModuleGuard>
  ),
});
