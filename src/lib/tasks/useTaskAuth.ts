// Adapter that mirrors the IPC Control Center AuthContext shape so the ported
// task-manager components compile against Vision Center's auth without rewrites.
import { useAuth as useVCAuth } from "@/hooks/auth/useAuth";
import { isAdmin as isAdminUtil } from "@/utils/permissions/rolePermissions";

export interface TaskAuthShape {
  user: { id: string } | null;
  profile: { full_name: string } | null;
  isAdmin: boolean;
}

export function useAuth(): TaskAuthShape {
  const { user } = useVCAuth();
  if (!user) return { user: null, profile: null, isAdmin: false };
  const full_name =
    user.display_name || user.email?.split("@")[0] || "Member";
  return {
    user: { id: user.id },
    profile: { full_name },
    isAdmin: isAdminUtil(user),
  };
}
