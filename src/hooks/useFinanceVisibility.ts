// Returns whether the signed-in user may see finance-sensitive fields for
// a given scope. Use this to conditionally render currency values, finance
// table columns, finance KPI cards, and finance exports.
//
// Never mask; always hide. See src/utils/permissions/financeVisibility.ts.

import { useAuth } from "@/hooks/auth/useAuth";
import {
  canViewFinanceFields,
  canEditFinanceFields,
  type FinanceScope,
} from "@/utils/permissions/financeVisibility";

export function useFinanceVisibility(scope: FinanceScope = "marketizers") {
  const { user } = useAuth();
  return canViewFinanceFields(user, scope);
}

export function useCanEditFinance(scope: FinanceScope = "marketizers") {
  const { user } = useAuth();
  return canEditFinanceFields(user, scope);
}
