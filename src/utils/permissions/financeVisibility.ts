// Finance-visibility helper. Single source of truth for deciding whether
// the signed-in user should see currency / revenue / profit / cost fields.
//
// Product rule: do NOT mask or show locked placeholders. If a user is not
// allowed to see a finance value, the UI must not render it at all.
//
// This wraps the existing `canViewMarketizersFinance` matrix
// (admin / finance_manager / brand_manager) so all call-sites stay in sync.

import type { UserProfile } from "@/types/auth";
import {
  canViewMarketizersFinance,
  canEditMarketizersFinance,
  isAdmin,
} from "./rolePermissions";

export type FinanceScope = "marketizers" | "global";

export function canViewFinanceFields(
  user: UserProfile | null | undefined,
  _scope: FinanceScope = "marketizers",
): boolean {
  if (!user) return false;
  return canViewMarketizersFinance(user);
}

export const canViewSensitiveFinancials = canViewFinanceFields;

export function canEditFinanceFields(
  user: UserProfile | null | undefined,
  _scope: FinanceScope = "marketizers",
): boolean {
  if (!user) return false;
  return canEditMarketizersFinance(user) || isAdmin(user);
}
