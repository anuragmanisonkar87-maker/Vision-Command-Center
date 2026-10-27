// Pure helpers (browser-safe) for the Users & Roles access table.
export type InviteStatus =
  | "not_invited"
  | "invite_sent"
  | "email_not_confirmed"
  | "active"
  | "reset_sent"
  | "disabled";

export type UserAccessAction =
  | "send_invite"
  | "resend_invite"
  | "send_reset"
  | "confirm_and_send_setup"
  | "set_password"
  | "disable_login"
  | "enable_login";

export const STATUS_LABEL: Record<InviteStatus, string> = {
  not_invited: "Not Invited",
  invite_sent: "Invite Sent",
  email_not_confirmed: "Email Not Confirmed",
  active: "Active",
  reset_sent: "Reset Sent",
  disabled: "Disabled",
};

export const STATUS_PILL: Record<InviteStatus, string> = {
  not_invited: "sp-muted",
  invite_sent: "sp-warn",
  email_not_confirmed: "sp-loss",
  active: "sp-profit",
  reset_sent: "sp-warn",
  disabled: "sp-loss",
};

export function actionsForStatus(s: InviteStatus): UserAccessAction[] {
  switch (s) {
    case "not_invited": return ["send_invite", "set_password"];
    case "invite_sent": return ["set_password", "resend_invite", "confirm_and_send_setup"];
    case "email_not_confirmed": return ["set_password", "confirm_and_send_setup", "resend_invite"];
    case "active":      return ["set_password", "send_reset", "disable_login"];
    case "reset_sent":  return ["set_password", "send_reset", "disable_login"];
    case "disabled":    return ["enable_login"];
  }
}

export const ACTION_LABEL: Record<UserAccessAction, string> = {
  send_invite: "Send Invite",
  resend_invite: "Resend Invite",
  send_reset: "Send Password Reset",
  confirm_and_send_setup: "Confirm + Send Setup Link",
  set_password: "Set Password",
  disable_login: "Disable Login",
  enable_login: "Enable Login",
};

export function isValidPassword(pw: string): { ok: boolean; reason?: string } {
  if (!pw) return { ok: false, reason: "Password cannot be empty." };
  if (pw.length > 72) return { ok: false, reason: "Password must be 72 characters or fewer." };
  return { ok: true };
}
