import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/auth/useAuth";

// Team Performance routes are operational (media buyer, ROAS tracker, reports).
// They do NOT require finance permission — finance values inside are gated
// individually via useFinanceVisibility. We only require the user to be
// authenticated here so non-finance roles (e.g. media_buyer) can use the
// operational tooling they're assigned to.
function TeamPerformanceGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  if (loading && !user) {
    return <div style={{ padding: 40, fontSize: 13, color: "var(--ink4)" }}>Loading…</div>;
  }
  if (!user) return null;
  return <>{children}</>;
}

export const Route = createFileRoute("/brands/marketizers/team-performance")({
  component: () => (
    <TeamPerformanceGuard>
      <Outlet />
    </TeamPerformanceGuard>
  ),
});
