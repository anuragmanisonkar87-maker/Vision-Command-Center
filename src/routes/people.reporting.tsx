import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute("/people/reporting")({
  component: () => (
    <ModuleGuard moduleKey="people_reporting" label="Daily Reporting">
      <Placeholder
        eyebrow="People"
        title="Daily Reporting"
        icon="◐"
        message="Daily team reports, blockers, and shipped work will appear here once the reporting form is connected to the database."
        documentTitle="Daily Reporting | GWV Vision Center"
      />
    </ModuleGuard>
  ),
});
