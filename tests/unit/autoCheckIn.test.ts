import { describe, it, expect } from "vitest";
import { shouldPromptAutoCheckIn } from "@/lib/attendance/autoCheckIn";
import type { UserProfile } from "@/types/auth";

const employee: UserProfile = {
  id: "u1", email: "e@x.com", display_name: "E", roles: ["team_member"],
};
const admin: UserProfile = {
  id: "a1", email: "a@x.com", display_name: "A", roles: ["admin"],
};
const settingsOn = { enable_auto_checkin_prompt: true };
const settingsOff = { enable_auto_checkin_prompt: false };

describe("shouldPromptAutoCheckIn", () => {
  it("prompts an employee with no attendance record", () => {
    expect(shouldPromptAutoCheckIn(employee, null, settingsOn)).toBe(true);
  });

  it("does not prompt admins", () => {
    expect(shouldPromptAutoCheckIn(admin, null, settingsOn)).toBe(false);
  });

  it("does not prompt when employee already checked in", () => {
    expect(
      shouldPromptAutoCheckIn(
        employee,
        { check_in_at: "2026-06-14T09:00:00Z", check_out_at: null },
        settingsOn,
      ),
    ).toBe(false);
  });

  it("does not prompt when employee already checked out (no duplicate)", () => {
    expect(
      shouldPromptAutoCheckIn(
        employee,
        { check_in_at: "2026-06-14T09:00:00Z", check_out_at: "2026-06-14T17:00:00Z" },
        settingsOn,
      ),
    ).toBe(false);
  });

  it("does not prompt when admin disabled the setting", () => {
    expect(shouldPromptAutoCheckIn(employee, null, settingsOff)).toBe(false);
  });

  it("defaults to enabled when settings are missing", () => {
    expect(shouldPromptAutoCheckIn(employee, null, null)).toBe(true);
  });

  it("does not prompt when there is no user", () => {
    expect(shouldPromptAutoCheckIn(null, null, settingsOn)).toBe(false);
  });
});
