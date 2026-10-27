// Helpers for the Onboarding Tracker view.
import type { InviteStatus } from "./userAccess.helpers";

export type OnboardingStatus =
  | "not_started"
  | "invite_sent"
  | "password_pending"
  | "active"
  | "access_review_needed"
  | "completed";

export type ActionNeeded =
  | "send_invite"
  | "wait_for_user"
  | "send_reminder"
  | "review_access"
  | "no_action";

export const ONBOARDING_LABEL: Record<OnboardingStatus, string> = {
  not_started: "Not Started",
  invite_sent: "Invite Sent",
  password_pending: "Password Pending",
  active: "Active",
  access_review_needed: "Access Review Needed",
  completed: "Completed",
};

export const ONBOARDING_PILL: Record<OnboardingStatus, string> = {
  not_started: "sp-muted",
  invite_sent: "sp-warn",
  password_pending: "sp-warn",
  active: "sp-profit",
  access_review_needed: "sp-warn",
  completed: "sp-profit",
};

export const ACTION_NEEDED_LABEL: Record<ActionNeeded, string> = {
  send_invite: "Send Invite",
  wait_for_user: "Wait for User",
  send_reminder: "Send Reminder",
  review_access: "Review Access",
  no_action: "No Action Needed",
};

const REMINDER_AFTER_DAYS = 3;

export function deriveOnboarding(
  invite: InviteStatus,
  opts: {
    inviteSentAt: string | null;
    lastLoginAt: string | null;
    brandCount: number;
    moduleCount: number;
  },
): { status: OnboardingStatus; action: ActionNeeded } {
  const { inviteSentAt, lastLoginAt, brandCount, moduleCount } = opts;
  const hasAccess = brandCount > 0 || moduleCount > 0;

  if (invite === "disabled") {
    return { status: "not_started", action: "no_action" };
  }
  if (invite === "not_invited") {
    return { status: "not_started", action: "send_invite" };
  }
  if (invite === "invite_sent") {
    const daysSince = inviteSentAt
      ? (Date.now() - new Date(inviteSentAt).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    return {
      status: "invite_sent",
      action: daysSince >= REMINDER_AFTER_DAYS ? "send_reminder" : "wait_for_user",
    };
  }
  if (invite === "reset_sent") {
    return { status: "password_pending", action: "wait_for_user" };
  }
  // active
  if (!lastLoginAt) {
    return { status: "password_pending", action: "wait_for_user" };
  }
  if (!hasAccess) {
    return { status: "access_review_needed", action: "review_access" };
  }
  if (brandCount === 0 || moduleCount === 0) {
    return { status: "access_review_needed", action: "review_access" };
  }
  return { status: "completed", action: "no_action" };
}

export type OnboardingFilter =
  | "all"
  | "pending_setup"
  | "active"
  | "not_invited"
  | "disabled"
  | "access_review";

export function matchesFilter(
  filter: OnboardingFilter,
  invite: InviteStatus,
  onboarding: OnboardingStatus,
): boolean {
  switch (filter) {
    case "all": return true;
    case "not_invited": return invite === "not_invited";
    case "disabled": return invite === "disabled";
    case "active": return invite === "active" && onboarding === "completed";
    case "pending_setup":
      return onboarding === "invite_sent" || onboarding === "password_pending" || onboarding === "not_started" && invite !== "disabled";
    case "access_review": return onboarding === "access_review_needed";
  }
}
