import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/people/hiring")({
  component: () => (
    <Placeholder
      eyebrow="People"
      title="Hiring Intelligence"
      icon="✦"
      message="Pipeline, scorecards, and hiring loops will live here. Coming after the core finance and reporting modules ship."
      documentTitle="Hiring Intelligence | GWV Vision Center"
    />
  ),
});
