// Phase 2E — dashboard summary helpers.
import { describe, expect, it } from "vitest";
import {
  attendanceCardSummary,
  myTasksCardSummary,
  pointsTodaySummary,
  formatHMS,
} from "@/services/dashboard/dashboardSummary";
import type { DelegationTask } from "@/services/delegation/delegationService";

const task = (o: Partial<DelegationTask>): DelegationTask =>
  ({
    id: "t",
    title: "x",
    description: null,
    assignee_id: "u1",
    created_by: "u1",
    brand_id: null,
    department: null,
    category: null,
    priority: "medium",
    difficulty: "easy",
    status: "open",
    system_stage: "planned",
    due_date: null,
    due_date_locked: false,
    completed_at: null,
    proof_url: null,
    proof_note: null,
    proof_required: false,
    revision_count: 0,
    delay_reason: null,
    blocked_reason: null,
    waiting_on_user_id: null,
    revision_1_date: null,
    revision_2_date: null,
    final_date: null,
    is_deleted: false,
    ...o,
  }) as DelegationTask;

const NOW = new Date(2026, 5, 13, 12, 0, 0);
const TODAY = "2026-06-13";

describe("attendanceCardSummary", () => {
  it("returns not_checked_in when null", () => {
    expect(attendanceCardSummary(null).status).toBe("not_checked_in");
  });
  it("returns checked_in when only check_in_at", () => {
    const r = attendanceCardSummary({
      check_in_at: "2026-06-13T03:00:00Z",
      check_out_at: null,
      total_work_seconds: 1800,
    });
    expect(r.status).toBe("checked_in");
    expect(r.workedSeconds).toBe(1800);
  });
  it("returns checked_out when both present", () => {
    const r = attendanceCardSummary({
      check_in_at: "x",
      check_out_at: "y",
      total_work_seconds: 7200,
    });
    expect(r.status).toBe("checked_out");
  });
});

describe("myTasksCardSummary", () => {
  it("counts only my assigned tasks", () => {
    const tasks = [
      task({ id: "1", assignee_id: "u1", system_stage: "planned" }),
      task({ id: "2", assignee_id: "u2", system_stage: "planned" }),
      task({ id: "3", assignee_id: "u1", system_stage: "submitted" }),
      task({ id: "4", assignee_id: "u1", system_stage: "completed" }),
      task({ id: "5", assignee_id: "u1", system_stage: "in_progress", due_date: "2026-06-01" }),
      task({ id: "6", assignee_id: "u1", is_deleted: true, system_stage: "planned" }),
    ];
    const r = myTasksCardSummary(tasks, "u1", NOW);
    expect(r.pending).toBe(2); // tasks 1 and 5
    expect(r.submitted).toBe(1);
    expect(r.overdue).toBe(1);
  });
  it("empty state returns zeros", () => {
    expect(myTasksCardSummary([], "u1", NOW)).toEqual({ pending: 0, submitted: 0, overdue: 0 });
  });
  it("does NOT leak another user's tasks", () => {
    const tasks = [task({ assignee_id: "other", system_stage: "planned" })];
    expect(myTasksCardSummary(tasks, "u1", NOW)).toEqual({ pending: 0, submitted: 0, overdue: 0 });
  });
});

describe("pointsTodaySummary", () => {
  const e = (p: number, user = "u1", d = TODAY) => ({ user_id: user, points: p, points_date: d });
  it("sums earned, lost, net for the user", () => {
    const r = pointsTodaySummary(
      [e(2), e(2), e(-2), e(2, "other"), e(2, "u1", "2026-06-12")],
      "u1",
      TODAY,
    );
    expect(r.earned).toBe(4);
    expect(r.lost).toBe(-2);
    expect(r.net).toBe(2);
    expect(r.entries).toBe(3);
  });
  it("empty when no entries", () => {
    expect(pointsTodaySummary([], "u1", TODAY)).toEqual({ earned: 0, lost: 0, net: 0, entries: 0 });
  });
});

describe("formatHMS", () => {
  it("formats seconds", () => {
    expect(formatHMS(0)).toBe("0m");
    expect(formatHMS(120)).toBe("2m");
    expect(formatHMS(3660)).toBe("1h 1m");
  });
});
