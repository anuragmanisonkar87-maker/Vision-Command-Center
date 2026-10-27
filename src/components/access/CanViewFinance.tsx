// Render children only when the signed-in user is permitted to see
// finance-sensitive fields. Never renders a placeholder, lock icon, or
// "restricted" message — the value simply isn't part of that role's UI.
//
// Usage:
//   <CanViewFinance><RevenueCard /></CanViewFinance>
//   <CanViewFinance scope="marketizers" fallback={<HealthBadge />}>
//     <ProfitCard />
//   </CanViewFinance>

import type { ReactNode } from "react";
import { useFinanceVisibility } from "@/hooks/useFinanceVisibility";
import type { FinanceScope } from "@/utils/permissions/financeVisibility";

export function CanViewFinance({
  children,
  scope = "marketizers",
  fallback = null,
}: {
  children: ReactNode;
  scope?: FinanceScope;
  fallback?: ReactNode;
}) {
  const allowed = useFinanceVisibility(scope);
  return <>{allowed ? children : fallback}</>;
}
