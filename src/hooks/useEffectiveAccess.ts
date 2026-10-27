// useEffectiveAccess: resolves the signed-in user's permission matrix
// (position presets + explicit overrides) and exposes helpers for the UI.
// Admin (legacy app_role) short-circuits to allow-all.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import {
  getEffectiveAccess,
  type ActionKey,
  type EffectiveAccess,
} from "@/services/accessControl/effectiveAccessService";

const EMPTY: EffectiveAccess = {
  teamMemberId: null,
  positionId: null,
  brandIds: [],
  modulesByKey: {},
  modulesById: {},
};

export function useEffectiveAccess() {
  const { user, loading: authLoading } = useAuth();
  const admin = isAdmin(user);
  const userId = (user as any)?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["effective-access", userId],
    queryFn: () => getEffectiveAccess(userId),
    enabled: !!userId && !admin,
    staleTime: 60_000,
  });

  const access: EffectiveAccess = admin ? EMPTY : data ?? EMPTY;

  const canAccessModule = (moduleKey: string): boolean => {
    if (admin) return true;
    return !!access.modulesByKey[moduleKey]?.can_view;
  };

  const canPerform = (moduleKey: string, action: ActionKey): boolean => {
    if (admin) return true;
    const p = access.modulesByKey[moduleKey];
    if (!p) return false;
    switch (action) {
      case "view": return p.can_view;
      case "create": return p.can_create;
      case "edit": return p.can_edit;
      case "delete": return p.can_delete;
      case "export": return p.can_export;
      case "manage": return p.can_manage;
      case "view_finance": return p.can_view_finance;
    }
  };

  const canAccessBrand = (brandId: string | null | undefined): boolean => {
    if (admin) return true;
    if (!brandId) return true;
    return access.brandIds.includes(brandId);
  };

  return {
    isAdmin: admin,
    isLoading: authLoading || (!admin && isLoading),
    teamMemberId: access.teamMemberId,
    accessibleBrandIds: access.brandIds,
    canAccessModule,
    canPerform,
    canAccessBrand,
    access,
  };
}
