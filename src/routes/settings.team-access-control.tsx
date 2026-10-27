import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/team-access-control")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/users" });
  },
});
