import { describe, it, expect } from "vitest";
import {
  deriveOnboarding,
  matchesFilter,
} from "@/lib/onboardingTracker.helpers";

describe("deriveOnboarding", () => {
  const base = { inviteSentAt: null, lastLoginAt: null, brandCount: 0, moduleCount: 0 };

  it("not invited -> not_started + send_invite", () => {
    expect(deriveOnboarding("not_invited", base)).toEqual({
      status: "not_started",
      action: "send_invite",
    });
  });

  it("disabled -> not_started + no_action", () => {
    expect(deriveOnboarding("disabled", base)).toEqual({
      status: "not_started",
      action: "no_action",
    });
  });

  it("invite_sent recent -> invite_sent + wait_for_user", () => {
    const r = deriveOnboarding("invite_sent", { ...base, inviteSentAt: new Date().toISOString() });
    expect(r.status).toBe("invite_sent");
    expect(r.action).toBe("wait_for_user");
  });

  it("invite_sent stale -> invite_sent + send_reminder", () => {
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const r = deriveOnboarding("invite_sent", { ...base, inviteSentAt: old });
    expect(r.action).toBe("send_reminder");
  });

  it("reset_sent -> password_pending + wait_for_user", () => {
    expect(deriveOnboarding("reset_sent", base)).toEqual({
      status: "password_pending",
      action: "wait_for_user",
    });
  });

  it("active without login -> password_pending", () => {
    expect(deriveOnboarding("active", base).status).toBe("password_pending");
  });

  it("active + login but no access -> access_review_needed", () => {
    const r = deriveOnboarding("active", { ...base, lastLoginAt: new Date().toISOString() });
    expect(r.status).toBe("access_review_needed");
    expect(r.action).toBe("review_access");
  });

  it("active + login + brand + module -> completed", () => {
    const r = deriveOnboarding("active", {
      inviteSentAt: null,
      lastLoginAt: new Date().toISOString(),
      brandCount: 1,
      moduleCount: 2,
    });
    expect(r.status).toBe("completed");
    expect(r.action).toBe("no_action");
  });
});

describe("matchesFilter", () => {
  it("all matches everything", () => {
    expect(matchesFilter("all", "not_invited", "not_started")).toBe(true);
  });
  it("not_invited filter", () => {
    expect(matchesFilter("not_invited", "not_invited", "not_started")).toBe(true);
    expect(matchesFilter("not_invited", "active", "completed")).toBe(false);
  });
  it("active filter requires completed onboarding", () => {
    expect(matchesFilter("active", "active", "completed")).toBe(true);
    expect(matchesFilter("active", "active", "access_review_needed")).toBe(false);
  });
  it("access_review filter", () => {
    expect(matchesFilter("access_review", "active", "access_review_needed")).toBe(true);
  });
  it("disabled filter", () => {
    expect(matchesFilter("disabled", "disabled", "not_started")).toBe(true);
  });
});
