// Single source of truth for role-based UI gating.
// Backend is also protected by RLS — these helpers only hide controls the
// user cannot use. Never trust the client alone.

import type { AppRole, UserProfile } from "@/types/auth";

const VIEW_FINANCE: AppRole[] = ["admin", "finance_manager", "brand_manager"];
const EDIT_FINANCE: AppRole[] = ["admin", "finance_manager"];

const has = (roles: AppRole[] | undefined, want: AppRole[]) =>
  !!roles?.some((r) => want.includes(r));

export const isAdmin = (u: UserProfile | null | undefined) =>
  !!u?.roles?.includes("admin");

// ── HR Command Center helpers ────────────────────────────────
export const isHr = (u: UserProfile | null | undefined) =>
  !!u?.roles?.includes("hr");
export const canViewHrCommandCenter = (u: UserProfile | null | undefined) =>
  isAdmin(u) || isHr(u);
export const canManageHrKpiSettings = (u: UserProfile | null | undefined) =>
  isAdmin(u);
export const canCreateHiringRequirement = (u: UserProfile | null | undefined) =>
  isAdmin(u) || isHr(u);
export const canSubmitHrDailyReport = (u: UserProfile | null | undefined) =>
  isAdmin(u) || isHr(u);
export const canViewAllHrPerformance = (u: UserProfile | null | undefined) =>
  isAdmin(u);
export const canOverrideHiringSla = (u: UserProfile | null | undefined) =>
  isAdmin(u);
export const canManageCandidatePool = (u: UserProfile | null | undefined) =>
  isAdmin(u) || isHr(u);

// Generic finance access (used by main /finance/* routes)
export const canViewFinance = (u: UserProfile | null) => has(u?.roles, VIEW_FINANCE);
export const canEditFinance = (u: UserProfile | null) => has(u?.roles, EDIT_FINANCE);
export const canDeleteFinance = (u: UserProfile | null) => isAdmin(u);
export const canLockMonth = (u: UserProfile | null) => has(u?.roles, EDIT_FINANCE);
export const canUnlockMonth = (u: UserProfile | null) => isAdmin(u);
export const canExportFinance = (u: UserProfile | null) => has(u?.roles, VIEW_FINANCE);

// Marketizers-specific (currently same matrix as generic finance)
export const canViewMarketizersFinance = canViewFinance;
export const canEditMarketizersFinance = canEditFinance;
export const canManageClients = canEditFinance;

// ── Brand-aware helpers ──────────────────────────────────────
export type BrandAccessRow = { brand_id: string; brand_slug?: string; access_level: string };

export const canManageBrands = (u: UserProfile | null) => isAdmin(u);
export const canManageUsers = (u: UserProfile | null) => isAdmin(u);
export const canAssignRoles = (u: UserProfile | null) => isAdmin(u);
export const canManageUserBrandAccess = (u: UserProfile | null) => isAdmin(u);

const userHasBrand = (access: BrandAccessRow[] | undefined, brandSlug: string) =>
  !!access?.some((a) => a.brand_slug === brandSlug);

export function canViewBrand(u: UserProfile | null, brandSlug: string, access?: BrandAccessRow[]): boolean {
  if (!u) return false;
  if (isAdmin(u) || has(u.roles, ["finance_manager"])) return true;
  if (has(u.roles, ["brand_manager"])) return userHasBrand(access, brandSlug) || (access?.length ?? 0) === 0;
  return userHasBrand(access, brandSlug);
}

export function canEditBrand(u: UserProfile | null, brandSlug: string, access?: BrandAccessRow[]): boolean {
  if (!u) return false;
  if (isAdmin(u)) return true;
  if (has(u.roles, ["finance_manager"])) return true;
  if (has(u.roles, ["brand_manager"])) {
    const row = access?.find((a) => a.brand_slug === brandSlug);
    return !!row && ["editor", "manager", "finance", "admin"].includes(row.access_level);
  }
  return false;
}

export function canViewBrandFinance(u: UserProfile | null, brandSlug: string, access?: BrandAccessRow[]): boolean {
  if (!u) return false;
  if (isAdmin(u) || has(u.roles, ["finance_manager"])) return true;
  const row = access?.find((a) => a.brand_slug === brandSlug);
  return !!row && ["finance", "manager", "admin"].includes(row.access_level);
}

export function canEditBrandFinance(u: UserProfile | null, brandSlug: string, access?: BrandAccessRow[]): boolean {
  if (!u) return false;
  if (isAdmin(u) || has(u.roles, ["finance_manager"])) return true;
  const row = access?.find((a) => a.brand_slug === brandSlug);
  return !!row && ["finance", "admin"].includes(row.access_level);
}
