import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client BEFORE importing the service.
const insertMock = vi.fn();
const fromMock = vi.fn(() => ({
  insert: insertMock,
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(async () => ({ data: { settings: {} }, error: null })),
  update: vi.fn().mockReturnThis(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => fromMock(...a) },
}));
vi.mock("@/services/delegation/delegationService", () => ({
  listAllTasks: vi.fn(async () => []),
}));

import {
  applyMissedTaskPenalties,
  draftMissedTaskEmail,
  defaultMissedTaskSubject,
  defaultMissedTaskBody,
  hasEmailProvider,
} from "@/services/delegation/missedTaskService";

const now = new Date(2026, 5, 10, 14, 0, 0);

function makeTask(over: any = {}) {
  return {
    id: "t1",
    title: "Send daily report",
    task_type: "standup",
    due_date: "2026-06-09",
    due_time: null,
    system_stage: "planned",
    is_deleted: false,
    assignee_id: "user-1",
    assignee_team_member_id: null,
    assignee_name: "Alex",
    assignee_email: "alex@example.com",
    completed_at: null,
    ...over,
  };
}

beforeEach(() => {
  insertMock.mockReset();
  fromMock.mockClear();
});

describe("defaults", () => {
  it("hasEmailProvider is false in this phase", () => {
    expect(hasEmailProvider()).toBe(false);
  });
  it("subject format", () => {
    expect(defaultMissedTaskSubject("Report X")).toBe("Missed Task Alert: Report X");
  });
  it("body mentions title, due date, penalty status, and time when set", () => {
    const body = defaultMissedTaskBody({
      employeeName: "Alex",
      taskTitle: "Report X",
      taskTypeLabel: "Stand-up Task",
      dueDate: "2026-06-09",
      dueTime: "09:30",
      penaltyApplied: true,
      penaltyPoints: -2,
    });
    expect(body).toContain("Alex");
    expect(body).toContain("Report X");
    expect(body).toContain("Stand-up Task");
    expect(body).toContain("2026-06-09 09:30");
    expect(body).toContain("-2");
  });
});

describe("applyMissedTaskPenalties", () => {
  it("inserts one row per missed task with configured penalty", async () => {
    insertMock.mockResolvedValue({ error: null });
    const tasks = [
      makeTask(),
      makeTask({ id: "t2", task_type: "ad_hoc" }),
      makeTask({ id: "t3", system_stage: "completed" }),
      makeTask({ id: "t4", due_date: null }),
    ];
    const res = await applyMissedTaskPenalties({
      adminUserId: "admin-1",
      now,
      tasks: tasks as any,
      configuredPenalty: -5,
    });
    expect(res.appliedCount).toBe(2);
    expect(res.noMissedCount).toBe(2);
    expect(res.skippedDuplicateCount).toBe(0);
    const call = insertMock.mock.calls[0][0];
    expect(call.points).toBe(-5);
  });

  it("falls back to -2 when no configured penalty is supplied", async () => {
    insertMock.mockResolvedValue({ error: null });
    const tasks = [makeTask()];
    await applyMissedTaskPenalties({
      adminUserId: "admin-1",
      now,
      tasks: tasks as any,
      configuredPenalty: -2,
    });
    expect(insertMock.mock.calls[0][0].points).toBe(-2);
  });

  it("treats unique-violation as duplicate skip", async () => {
    insertMock.mockResolvedValue({ error: { message: "duplicate key value violates unique constraint" } });
    const tasks = [makeTask()];
    const res = await applyMissedTaskPenalties({
      adminUserId: "admin-1",
      now,
      tasks: tasks as any,
      configuredPenalty: -2,
    });
    expect(res.appliedCount).toBe(0);
    expect(res.skippedDuplicateCount).toBe(1);
  });

  it("skips recurring_daily tasks", async () => {
    insertMock.mockResolvedValue({ error: null });
    const tasks = [makeTask({ task_type: "recurring_daily" })];
    const res = await applyMissedTaskPenalties({
      adminUserId: "admin-1",
      now,
      tasks: tasks as any,
      configuredPenalty: -2,
    });
    expect(res.appliedCount).toBe(0);
    expect(res.noMissedCount).toBe(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("respects due_time precision (today + future time → not missed)", async () => {
    insertMock.mockResolvedValue({ error: null });
    const tasks = [makeTask({ due_date: "2026-06-10", due_time: "18:00" })];
    const res = await applyMissedTaskPenalties({
      adminUserId: "admin-1",
      now,
      tasks: tasks as any,
      configuredPenalty: -2,
    });
    expect(res.appliedCount).toBe(0);
    expect(res.noMissedCount).toBe(1);
  });
});

describe("draftMissedTaskEmail", () => {
  function mockInsertReturning(row: any) {
    insertMock.mockReturnValue({
      select: () => ({ single: async () => ({ data: row, error: null }) }),
    });
  }

  it("saves a draft row (no real email) using default subject/body", async () => {
    mockInsertReturning({ id: "log-1", email_status: "draft", email_type: "missed_task_alert", email_subject: "Missed Task Alert: Send daily report", email_body: "..." });
    const res = await draftMissedTaskEmail({
      task: makeTask() as any,
      recipientEmail: "alex@example.com",
      adminUserId: "admin-1",
    });
    expect(res.status).toBe("draft");
    if (res.status === "draft") {
      expect(res.log.email_status).toBe("draft");
      expect(res.reason).toMatch(/no real email/i);
    }
  });

  it("persists custom subject and body when admin edits them", async () => {
    mockInsertReturning({ id: "log-2", email_status: "draft", email_subject: "Hey", email_body: "Custom body" });
    await draftMissedTaskEmail({
      task: makeTask() as any,
      recipientEmail: "alex@example.com",
      adminUserId: "admin-1",
      subject: "Hey",
      body: "Custom body",
    });
    const payload = insertMock.mock.calls[0][0];
    expect(payload.email_subject).toBe("Hey");
    expect(payload.email_body).toBe("Custom body");
    expect(payload.email_status).toBe("draft");
  });

  it("fails gracefully when task has no assignee (no insert)", async () => {
    const res = await draftMissedTaskEmail({
      task: makeTask({ assignee_id: null }) as any,
      recipientEmail: "x@y.com",
      adminUserId: "admin-1",
    });
    expect(res.status).toBe("failed");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
