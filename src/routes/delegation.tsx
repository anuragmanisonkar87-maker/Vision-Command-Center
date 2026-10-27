import { createFileRoute } from "@tanstack/react-router";
import DelegationPage from "@/components/delegation/DelegationPage";

export const VALID_TABS = ["daily", "mytasks", "team", "leaderboard", "reports", "discipline", "settings"] as const;
export type DelegationTab = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/delegation")({
  validateSearch: (s: Record<string, unknown>): { tab?: DelegationTab } => {
    const t = typeof s.tab === "string" ? (s.tab as string) : undefined;
    return VALID_TABS.includes(t as DelegationTab) ? { tab: t as DelegationTab } : {};
  },
  component: DelegationPage,
});
