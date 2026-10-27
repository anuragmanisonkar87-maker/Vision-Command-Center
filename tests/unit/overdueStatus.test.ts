// Phase 2B — missed / overdue status helpers.
import { describe, expect, it } from "vitest";
import {
  recurringStatusOf,
  isCompletionLate,
  summarizeRecurringDay,
  isDelegationOverdue,
  dueTimePassed,
} from "@/lib/delegation/overdueStatus";
import type {
  RecurringDailyTask,
  RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";
import type { DelegationTask } from "@/services/delegation/delegationService";

const tpl = (o: Partial<RecurringDailyTask> = {}): RecurringDailyTask => ({
  id: "t1", title: "x", description: null,
  task_doer_team_member_id: "tm1", task_doer_user_id: "u1",
  task_doer_name: "Alice", task_doer_email: null,
  due_time: "10:00:00", points_on_completion: 2, negative_points_if_missed: -2,
  active: true, created_by: null, created_at: "", updated_at: "", ...o,
});
const cmp = (o: Partial<RecurringDailyCompletion> = {}): RecurringDailyCompletion => ({
  id: "c1", template_id: "t1", completion_date: "2026-06-13",
  completed_by_user_id: "u1", completed_by_team_member_id: "tm1",
  completed_by_name: "A", completed_at: "2026-06-13T09:00:00Z",
  proof_url: null, note: null, ...o,
});

const at = (h: number, m = 0) => new Date(2026, 5, 13, h, m, 0, 0);

describe("dueTimePassed", () => {
  it("false before due_time", () => expect(dueTimePassed("10:00:00", at(9, 30))).toBe(false));
  it("true at/after due_time", () => {
    expect(dueTimePassed("10:00:00", at(10, 0))).toBe(true);
    expect(dueTimePassed("10:00:00", at(11, 0))).toBe(true);
  });
  it("false when no due_time", () => expect(dueTimePassed(null, at(23))).toBe(false));
});

describe("recurringStatusOf", () => {
  it("pending before due_time with no completion", () => {
    expect(recurringStatusOf(tpl({ due_time: "10:00:00" }), null, at(9))).toBe("pending");
  });
  it("missed after due_time with no completion", () => {
    expect(recurringStatusOf(tpl({ due_time: "10:00:00" }), null, at(11))).toBe("missed");
  });
  it("done when a completion exists (even after due_time)", () => {
    expect(recurringStatusOf(tpl({ due_time: "10:00:00" }), cmp(), at(11))).toBe("done");
  });
  it("inactive template never becomes missed", () => {
    expect(recurringStatusOf(tpl({ active: false, due_time: "10:00:00" }), null, at(23))).toBe("pending");
  });
  it("no due_time → pending forever until done", () => {
    expect(recurringStatusOf(tpl({ due_time: null }), null, at(23))).toBe("pending");
    expect(recurringStatusOf(tpl({ due_time: null }), cmp(), at(23))).toBe("done");
  });
});

describe("isCompletionLate", () => {
  it("true when completed after due_time", () => {
    expect(isCompletionLate(tpl({ due_time: "10:00:00" }),
      cmp({ completed_at: new Date(2026, 5, 13, 11, 0).toISOString() }))).toBe(true);
  });
  it("false when completed before due_time", () => {
    expect(isCompletionLate(tpl({ due_time: "10:00:00" }),
      cmp({ completed_at: new Date(2026, 5, 13, 9, 0).toISOString() }))).toBe(false);
  });
  it("false when no due_time or no completion", () => {
    expect(isCompletionLate(tpl({ due_time: null }), cmp())).toBe(false);
    expect(isCompletionLate(tpl(), null)).toBe(false);
  });
});

describe("summarizeRecurringDay", () => {
  it("counts done/pending/missed and hides inactive-with-no-completion", () => {
    const items = [
      { template: tpl({ id: "a", due_time: "10:00:00" }), completion: cmp({ template_id: "a" }) }, // done
      { template: tpl({ id: "b", due_time: "10:00:00" }), completion: null }, // missed
      { template: tpl({ id: "c", due_time: "23:00:00" }), completion: null }, // pending
      { template: tpl({ id: "d", active: false }), completion: null }, // hidden
    ];
    const s = summarizeRecurringDay(items, at(12));
    expect(s).toEqual({ visible: 3, done: 1, pending: 1, missed: 1 });
  });
});

const task = (o: Partial<DelegationTask> = {}): DelegationTask =>
  ({
    id: "t", title: "T", assignee_id: "u1", created_by: "u1",
    system_stage: "planned", status: "Planned",
    priority: "medium" as any, difficulty: "medium" as any,
    is_deleted: false, due_date: null, revision_count: 0,
    proof_url: null, proof_note: null, completed_at: null,
    ...o,
  } as any);

describe("isDelegationOverdue", () => {
  const today = new Date(2026, 5, 13, 12);
  it("true when due_date is before today and not completed", () => {
    expect(isDelegationOverdue(task({ due_date: "2026-06-12", system_stage: "in_progress" }), today)).toBe(true);
  });
  it("false when due_date is today", () => {
    expect(isDelegationOverdue(task({ due_date: "2026-06-13", system_stage: "in_progress" }), today)).toBe(false);
  });
  it("false when completed or cancelled even if due_date is past", () => {
    expect(isDelegationOverdue(task({ due_date: "2026-06-01", system_stage: "completed" }), today)).toBe(false);
    expect(isDelegationOverdue(task({ due_date: "2026-06-01", system_stage: "cancelled" }), today)).toBe(false);
  });
  it("false when no due_date or deleted", () => {
    expect(isDelegationOverdue(task({ due_date: null }), today)).toBe(false);
    expect(isDelegationOverdue(task({ due_date: "2026-06-01", is_deleted: true }), today)).toBe(false);
  });
  it("submitted task with past due_date is still overdue (not yet approved)", () => {
    expect(isDelegationOverdue(task({ due_date: "2026-06-12", system_stage: "submitted" }), today)).toBe(true);
  });
});

describe("employee-vs-admin scope (documented contract)", () => {
  // Daily Checklist queries listCompletionsForDate(today). RLS restricts
  // employees to their own templates/completions, so summarizeRecurringDay
  // over their own rows naturally yields per-user counts. Admins query the
  // same helper over all rows to see global today summary.
  it("summary is a pure function of the rows passed in", () => {
    const mine = [{ template: tpl({ id: "a", due_time: "10:00:00" }), completion: null }];
    const all = [
      ...mine,
      { template: tpl({ id: "b", due_time: "10:00:00" }), completion: cmp({ template_id: "b" }) },
    ];
    expect(summarizeRecurringDay(mine, at(12))).toEqual({ visible: 1, done: 0, pending: 0, missed: 1 });
    expect(summarizeRecurringDay(all, at(12))).toEqual({ visible: 2, done: 1, pending: 0, missed: 1 });
  });
});
