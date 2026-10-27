import { createFileRoute } from "@tanstack/react-router";
import SeminarRoasCalculatorPage from "@/components/marketizers/roas/SeminarRoasCalculatorPage";
import { ModuleGuard } from "@/components/access-control/ModuleGuard";

export const Route = createFileRoute(
  "/brands/marketizers/team-performance/media-buyer-performance/seminar-roas",
)({
  component: () => (
    <ModuleGuard moduleKey="marketizers_media_buyer_seminar_roas" label="Seminar / Webinar ROAS Tracker">
      <SeminarRoasCalculatorPage />
    </ModuleGuard>
  ),
  validateSearch: (s: Record<string, unknown>): { editId?: string } => {
    const out: { editId?: string } = {};
    if (typeof s.editId === "string" && s.editId) out.editId = s.editId;
    return out;
  },
});
