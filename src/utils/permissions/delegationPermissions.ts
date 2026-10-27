// Delegation permission helpers.
import type { UserProfile } from "@/types/auth";
import { isAdmin } from "@/utils/permissions/rolePermissions";

export const canManageDelegation = (u: UserProfile | null) => isAdmin(u);
export const canChangeDueDate = (u: UserProfile | null) => isAdmin(u);
export const canDeleteTask = (u: UserProfile | null) => isAdmin(u);
export const canViewTeamBoard = (u: UserProfile | null) => isAdmin(u);
export const canManageSettings = (u: UserProfile | null) => isAdmin(u);
