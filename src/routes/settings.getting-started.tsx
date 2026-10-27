import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import StudioSetupJourney from "@/components/dashboard/StudioSetupJourney";

export const Route = createFileRoute("/settings/getting-started")({
  component: GettingStartedPage,
});

function GettingStartedPage() {
  useEffect(() => { document.title = "Getting Started | GWV Vision Center"; }, []);
  return (
    <div style={{ padding: "8px 0 24px" }}>
      <StudioSetupJourney />
    </div>
  );
}
