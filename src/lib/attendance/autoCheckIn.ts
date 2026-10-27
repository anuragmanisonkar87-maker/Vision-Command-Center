// Pure helper deciding whether the auto check-in prompt should be shown
// to an employee on login / dashboard. Browser-safe and easy to test.

import type { UserProfile } from "@/types/auth";
import { isAdmin } from "@/utils/permissions/rolePermissions";

export type AutoCheckInAttendance = {
  check_in_at: string | null;
  check_out_at: string | null;
} | null;

export type AutoCheckInSettings = {
  enable_auto_checkin_prompt: boolean;
} | null;

/**
 * Returns true when the employee should be prompted to auto check-in:
 * - admin is never prompted
 * - setting must be enabled (defaults to true if missing)
 * - today's record must not exist OR must have no check_in_at yet
 * - if employee already checked out, do NOT prompt again
 */
export function shouldPromptAutoCheckIn(
  user: UserProfile | null | undefined,
  attendance: AutoCheckInAttendance,
  settings: AutoCheckInSettings,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return false;
  const enabled = settings?.enable_auto_checkin_prompt ?? true;
  if (!enabled) return false;
  if (!attendance) return true;
  if (attendance.check_out_at) return false; // already done for the day
  if (attendance.check_in_at) return false; // already checked in
  return true;
}
