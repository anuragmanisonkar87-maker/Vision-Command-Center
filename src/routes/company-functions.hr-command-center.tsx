import { createFileRoute } from "@tanstack/react-router";
import { HrCommandCenterPage } from "@/components/hr/HrCommandCenterPage";

export const Route = createFileRoute("/company-functions/hr-command-center")({
  component: HrCommandCenterPage,
});
