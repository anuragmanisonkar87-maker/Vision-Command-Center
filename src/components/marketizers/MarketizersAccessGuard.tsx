import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { canViewMarketizersFinance, canEditMarketizersFinance, isAdmin as isAdminFn } from "@/utils/permissions/rolePermissions";

export type GwvRole =
  | "admin"
  | "finance_manager"
  | "brand_manager"
  | "operator"
  | "team_member"
  | "media_buyer";

// These helpers used to read from localStorage. They now read the live
// signed-in user from the auth hook context where called.
// Pages should prefer useAuth() + permission helpers directly. These
// no-arg wrappers are kept for backward compatibility.
let _cachedUser: ReturnType<typeof useAuth>["user"] = null;

export function getCurrentRole(): GwvRole {
  return (_cachedUser?.roles?.[0] as GwvRole) ?? "operator";
}
export function canViewMarketizersFinance_compat() {
  return canViewMarketizersFinance(_cachedUser ?? null);
}
export function canEditMarketizersFinance_compat() {
  return canEditMarketizersFinance(_cachedUser ?? null);
}
export { canViewMarketizersFinance_compat as canViewMarketizersFinance };
export { canEditMarketizersFinance_compat as canEditMarketizersFinance };
export function isAdmin() { return isAdminFn(_cachedUser ?? null); }

export function MarketizersAccessGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const refreshedRef = useRef(false);

  // Keep legacy no-arg permission helpers in sync before children render.
  _cachedUser = user;

  useEffect(() => { _cachedUser = user; }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Background role refresh — does NOT block render.
  useEffect(() => {
    if (loading || !user || user.roles.length > 0 || refreshedRef.current) return;
    refreshedRef.current = true;
    refresh();
  }, [loading, user, refresh]);

  // Only block paint while we have no auth state at all.
  if (loading && !user) {
    return (
      <div style={{ padding: 40, fontSize: 13, color: "var(--ink4)" }}>Loading…</div>
    );
  }

  if (!user || !canViewMarketizersFinance(user)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="panel" style={{ maxWidth: 460, textAlign: "center", padding: "44px 36px" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Permission required</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--ink3)", marginBottom: 22, lineHeight: 1.6 }}>
            You do not have permission to view this financial data.
          </p>
          <Link
            to="/dashboard"
            style={{
              display: "inline-block", padding: "10px 20px", borderRadius: 7,
              background: "var(--ink)", color: "var(--parchment)",
              fontSize: 13, fontWeight: 600,
            }}
          >
            ← Go Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
