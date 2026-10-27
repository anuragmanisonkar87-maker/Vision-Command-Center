import { describe, expect, it } from "vitest";
import {
  TASK_TYPE_LABELS,
  defaultTaskType,
  labelOfTaskType,
  isValidTaskType,
} from "@/lib/delegation/taskType";
import {
  buildChecklist,
  isCompletedToday,
  todayISO,
  type RecurringDailyTask,
  type RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";

describe("task type", () => {
  it("labels match user-facing copy", () => {
    expect(TASK_TYPE_LABELS.recurring_daily).toBe("Daily Task");
    expect(TASK_TYPE_LABELS.standup).toBe("Stand-up Task");
    expect(TASK_TYPE_LABELS.ad_hoc).toBe("Ad Hoc Task");
  });

  it("default is standup when no hints", () => {
    expect(defaultTaskType()).toBe("standup");
    expect(defaultTaskType({})).toBe("standup");
  });

  it("recurring template hint maps to recurring_daily", () => {
    expect(defaultTaskType({ isRecurring: true })).toBe("recurring_daily");
  });

  it("one-off hint maps to ad_hoc", () => {
    expect(defaultTaskType({ isOneOff: true })).toBe("ad_hoc");
  });

  it("labelOfTaskType defaults to stand-up for unknown / null", () => {
    expect(labelOfTaskType(null)).toBe("Stand-up Task");
    expect(labelOfTaskType("garbage")).toBe("Stand-up Task");
    expect(labelOfTaskType("recurring_daily")).toBe("Daily Task");
  });

  it("isValidTaskType discriminates", () => {
    expect(isValidTaskType("standup")).toBe(true);
    expect(isValidTaskType("ad_hoc")).toBe(true);
    expect(isValidTaskType("recurring_daily")).toBe(true);
    expect(isValidTaskType("x")).toBe(false);
    expect(isValidTaskType(null)).toBe(false);
  });
});

const tpl = (over: Partial<RecurringDailyTask> = {}): RecurringDailyTask => ({
  id: over.id ?? "t1",
  title: "Send daily report",
  description: null,
  task_doer_team_member_id: "tm1",
  task_doer_user_id: "u1",
  task_doer_name: "Alice",
  task_doer_email: "a@x",
  due_time: "10:00:00",
  points_on_completion: 2,
  negative_points_if_missed: -2,
  active: true,
  created_by: null,
  created_at: "",
  updated_at: "",
  ...over,
});

const cmp = (template_id: string, date = todayISO()): RecurringDailyCompletion => ({
  id: "c-" + template_id,
  template_id,
  completion_date: date,
  completed_by_user_id: "u1",
  completed_by_team_member_id: "tm1",
  completed_by_name: "Alice",
  completed_at: new Date().toISOString(),
  proof_url: null,
  note: null,
});

describe("recurring daily checklist building", () => {
  it("returns only active templates and joins today's completion", () => {
    const templates = [tpl({ id: "a" }), tpl({ id: "b", active: false }), tpl({ id: "c" })];
    const completions = [cmp("a")];
    const list = buildChecklist(templates, completions);
    expect(list.map((x) => x.id)).toEqual(["a", "c"]);
    expect(list[0].completion?.template_id).toBe("a");
    expect(list[1].completion).toBeNull();
  });

  it("isCompletedToday checks for today only", () => {
    const today = todayISO();
    expect(isCompletedToday("a", [cmp("a")], today)).toBe(true);
    expect(isCompletedToday("a", [cmp("a", "2000-01-01")], today)).toBe(false);
    expect(isCompletedToday("z", [cmp("a")], today)).toBe(false);
  });

  it("todayISO returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { badgeClassOfTaskType, matchesTaskTypeFilter, TASK_TYPE_VALUES, TASK_TYPE_SHORT } from "@/lib/delegation/taskType";

describe("task type badge + filter helpers", () => {
  it("badge classes are theme-compatible per type", () => {
    expect(badgeClassOfTaskType("recurring_daily")).toMatch(/emerald/);
    expect(badgeClassOfTaskType("standup")).toMatch(/amber/);
    expect(badgeClassOfTaskType("ad_hoc")).toMatch(/violet/);
  });
  it("unknown/null falls back to standup amber styling", () => {
    expect(badgeClassOfTaskType(null)).toMatch(/amber/);
    expect(badgeClassOfTaskType("garbage" as any)).toMatch(/amber/);
  });
  it("matchesTaskTypeFilter allows all when filter is empty", () => {
    expect(matchesTaskTypeFilter("recurring_daily", "")).toBe(true);
    expect(matchesTaskTypeFilter(null, "")).toBe(true);
  });
  it("matchesTaskTypeFilter matches by exact type and treats null as standup", () => {
    expect(matchesTaskTypeFilter("ad_hoc", "ad_hoc")).toBe(true);
    expect(matchesTaskTypeFilter("standup", "ad_hoc")).toBe(false);
    expect(matchesTaskTypeFilter(null, "standup")).toBe(true);
    expect(matchesTaskTypeFilter(null, "recurring_daily")).toBe(false);
  });
  it("short labels available for all known types", () => {
    for (const t of TASK_TYPE_VALUES) expect(TASK_TYPE_SHORT[t]).toBeTruthy();
  });
});

describe("daily checklist summary counts (via buildChecklist)", () => {
  it("done + pending derived correctly from active templates", () => {
    const templates = [
      tpl({ id: "a" }), tpl({ id: "b" }), tpl({ id: "c" }), tpl({ id: "d", active: false }),
    ];
    const completions = [cmp("a"), cmp("b")];
    const items = buildChecklist(templates, completions);
    expect(items.length).toBe(3);
    const done = items.filter((i) => i.completion).length;
    const pending = items.length - done;
    expect(done).toBe(2);
    expect(pending).toBe(1);
  });
});
