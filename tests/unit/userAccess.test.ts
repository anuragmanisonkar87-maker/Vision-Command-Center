import { describe, it, expect } from "vitest";
import {
  actionsForStatus,
  STATUS_LABEL,
  ACTION_LABEL,
  isValidPassword,
} from "@/lib/userAccess.helpers";

describe("userAccess.helpers", () => {
  it("derives button set per status", () => {
    expect(actionsForStatus("not_invited")).toEqual(["send_invite", "set_password"]);
    expect(actionsForStatus("invite_sent")).toEqual(["set_password", "resend_invite", "confirm_and_send_setup"]);
    expect(actionsForStatus("email_not_confirmed")).toEqual(["set_password", "confirm_and_send_setup", "resend_invite"]);
    expect(actionsForStatus("active")).toEqual(["set_password", "send_reset", "disable_login"]);
    expect(actionsForStatus("reset_sent")).toEqual(["set_password", "send_reset", "disable_login"]);
    expect(actionsForStatus("disabled")).toEqual(["enable_login"]);
  });

  it("never exposes a button to read an existing password", () => {
    const labels = Object.values(ACTION_LABEL).join(" ").toLowerCase();
    expect(labels).not.toMatch(/show password|copy password|view password/);
  });

  it("has a label for every status including email_not_confirmed", () => {
    for (const s of ["not_invited", "invite_sent", "email_not_confirmed", "active", "reset_sent", "disabled"] as const) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
    expect(STATUS_LABEL.email_not_confirmed).toMatch(/not confirmed/i);
  });

  it("offers a recovery action for unconfirmed users that does not expose a password", () => {
    const actions = actionsForStatus("email_not_confirmed");
    expect(actions).toContain("confirm_and_send_setup");
    expect(ACTION_LABEL.confirm_and_send_setup.toLowerCase()).not.toMatch(/password/);
  });

  it("allows simple manual admin passwords as long as they are not empty", () => {
    expect(isValidPassword("1").ok).toBe(true);
    expect(isValidPassword("abc").ok).toBe(true);
    expect(isValidPassword("").ok).toBe(false);
  });
});
