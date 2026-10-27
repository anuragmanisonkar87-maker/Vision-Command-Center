import { describe, it, expect } from "vitest";
import {
  isStandupOrAdHocMissed,
  missedTaskBadge,
  penaltyFor,
  eventTypeFor,
  formatDueWhen,
  MISSED_TASK_PENALTY,
  DEFAULT_MISSED_TASK_PENALTY,
} from "@/lib/delegation/missedTask";

const now = new Date(2026, 5, 10, 14, 0, 0); // June 10, 2026 14:00

function make(overrides: any = {}) {
  return {
    task_type: "standup" as const,
    due_date: "2026-06-09",
    due_time: null,
    system_stage: "planned" as const,
    is_deleted: false,
    completed_at: null,
    ...overrides,
  };
}

describe("isStandupOrAdHocMissed", () => {
  it("stand-up past due is missed", () => {
    expect(isStandupOrAdHocMissed(make({ task_type: "standup" }), now)).toBe(true);
  });
  it("ad hoc past due is missed", () => {
    expect(isStandupOrAdHocMissed(make({ task_type: "ad_hoc" }), now)).toBe(true);
  });
  it("task without due_date is never missed", () => {
    expect(isStandupOrAdHocMissed(make({ due_date: null }), now)).toBe(false);
  });
  it("submitted task is not missed", () => {
    expect(isStandupOrAdHocMissed(make({ system_stage: "submitted" }), now)).toBe(false);
  });
  it("completed task is not missed", () => {
    expect(isStandupOrAdHocMissed(make({ system_stage: "completed" }), now)).toBe(false);
  });
  it("cancelled task is not missed", () => {
    expect(isStandupOrAdHocMissed(make({ system_stage: "cancelled" }), now)).toBe(false);
  });
  it("recurring_daily task is not handled here", () => {
    expect(isStandupOrAdHocMissed(make({ task_type: "recurring_daily" }), now)).toBe(false);
  });
  it("due today with no time is not missed (fallback)", () => {
    expect(isStandupOrAdHocMissed(make({ due_date: "2026-06-10" }), now)).toBe(false);
  });
  it("deleted task is not missed", () => {
    expect(isStandupOrAdHocMissed(make({ is_deleted: true }), now)).toBe(false);
  });
});

describe("due-time precision", () => {
  it("missed today when due_time has passed", () => {
    expect(
      isStandupOrAdHocMissed(make({ due_date: "2026-06-10", due_time: "10:00" }), now),
    ).toBe(true);
  });
  it("not missed today when due_time still in the future", () => {
    expect(
      isStandupOrAdHocMissed(make({ due_date: "2026-06-10", due_time: "18:30" }), now),
    ).toBe(false);
  });
  it("missed today at exact due_time", () => {
    expect(
      isStandupOrAdHocMissed(make({ due_date: "2026-06-10", due_time: "14:00" }), now),
    ).toBe(true);
  });
  it("ad hoc respects due_time too", () => {
    expect(
      isStandupOrAdHocMissed(
        make({ task_type: "ad_hoc", due_date: "2026-06-10", due_time: "09:00" }),
        now,
      ),
    ).toBe(true);
  });
  it("falls back to date-only when due_time is empty string", () => {
    expect(
      isStandupOrAdHocMissed(make({ due_date: "2026-06-10", due_time: "" }), now),
    ).toBe(false);
  });
  it("past due date is missed regardless of due_time", () => {
    expect(
      isStandupOrAdHocMissed(make({ due_date: "2026-06-09", due_time: "23:59" }), now),
    ).toBe(true);
  });
});

describe("missedTaskBadge", () => {
  it("returns 'missed' for past-due unsubmitted task", () => {
    expect(missedTaskBadge(make(), now)).toBe("missed");
  });
  it("returns 'overdue' when due today and no time", () => {
    expect(missedTaskBadge(make({ due_date: "2026-06-10" }), now)).toBe("overdue");
  });
  it("returns 'missed' when due today and time has passed", () => {
    expect(missedTaskBadge(make({ due_date: "2026-06-10", due_time: "10:00" }), now)).toBe("missed");
  });
  it("returns 'submitted_late' when completed after due", () => {
    expect(
      missedTaskBadge(
        make({ system_stage: "completed", completed_at: "2026-06-11T10:00:00Z" }),
        now,
      ),
    ).toBe("submitted_late");
  });
  it("returns 'completed' when on-time", () => {
    expect(
      missedTaskBadge(
        make({ system_stage: "completed", completed_at: "2026-06-08T10:00:00Z" }),
        now,
      ),
    ).toBe("completed");
  });
  it("returns null for recurring_daily", () => {
    expect(missedTaskBadge(make({ task_type: "recurring_daily" }), now)).toBe(null);
  });
});

describe("penaltyFor / eventTypeFor", () => {
  it("default penalty is -2", () => {
    expect(DEFAULT_MISSED_TASK_PENALTY).toBe(-2);
    expect(penaltyFor("standup")).toBe(-2);
    expect(penaltyFor("ad_hoc")).toBe(-2);
    expect(MISSED_TASK_PENALTY.standup).toBe(-2);
  });
  it("uses configured override when provided", () => {
    expect(penaltyFor("standup", -5)).toBe(-5);
    expect(penaltyFor("ad_hoc", -10)).toBe(-10);
  });
  it("configured zero is honored (not treated as falsy)", () => {
    expect(penaltyFor("standup", 0)).toBe(0);
  });
  it("ignores configured NaN / non-finite values", () => {
    expect(penaltyFor("standup", NaN as any)).toBe(-2);
  });
  it("non-missable types return 0", () => {
    expect(penaltyFor("recurring_daily", -5)).toBe(0);
  });
  it("event type maps correctly", () => {
    expect(eventTypeFor("standup")).toBe("standup_task_missed");
    expect(eventTypeFor("ad_hoc")).toBe("ad_hoc_task_missed");
    expect(eventTypeFor("recurring_daily")).toBe(null);
  });
});

describe("formatDueWhen", () => {
  it("returns dash when no date", () => {
    expect(formatDueWhen(null, null)).toBe("—");
  });
  it("returns date only when time empty", () => {
    expect(formatDueWhen("2026-06-10", null)).toBe("2026-06-10");
    expect(formatDueWhen("2026-06-10", "")).toBe("2026-06-10");
  });
  it("returns date + HH:MM when time set", () => {
    expect(formatDueWhen("2026-06-10", "09:30")).toBe("2026-06-10 09:30");
    expect(formatDueWhen("2026-06-10", "09:30:00")).toBe("2026-06-10 09:30");
  });
});
