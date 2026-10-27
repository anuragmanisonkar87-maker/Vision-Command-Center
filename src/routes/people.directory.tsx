import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/people/directory")({
  component: () => (
    <Placeholder
      eyebrow="People"
      title="Team Directory"
      icon="◇"
      message="Every person across all four brands — with role, brand, and contact — will appear here once the directory is wired."
      documentTitle="Team Directory | GWV Vision Center"
    />
  ),
});
