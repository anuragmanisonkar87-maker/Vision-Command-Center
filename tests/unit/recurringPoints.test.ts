// Phase 2C — tests for recurring daily points ledger service.
import { describe, expect, it, vi, beforeEach } from "vitest";

type Row = Record<string, any>;
let insertCalls: Row[] = [];
let insertImpl: (row: Row) => { data: Row | null; error: { message: string } | null } = (row) => ({
  data: { id: "ledger-" + insertCalls.length, ...row, created_at: new Date().toISOString() },
  error: null,
});
let templateList: any[] = [];
let completionList: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => ({
    insert(row: Row) {
      insertCalls.push({ ...row, __table: table });
      const result = insertImpl(row);
      const thenable: any = {
        select: () => ({ single: async () => result }),
        then: (resolve: any) => resolve(result),
      };
      return thenable;
    },
    select() {
      return {
        order: () => ({ limit: async () => ({ data: [], error: null }) }),
        eq: async () => ({ data: [], error: null }),
      };
    },
  });
  return { supabase: { from: (t: string) => builder(t) } };
});

vi.mock("@/services/recurringTasks/recurringTasksService", async () => {
  const actual: any = await vi.importActual("@/services/recurringTasks/recurringTasksService");
  return {
    ...actual,
    listTemplates: async () => templateList,
    listCompletionsForDate: async () => completionList,
  };
});

import {
  awardCompletionPoints,
  applyMissedPenaltiesForDate,
} from "@/services/recurringTasks/recurringPointsService";

const baseTpl = {
  id: "t1",
  title: "Send daily report",
  description: null,
  task_doer_team_member_id: "tm1",
  task_doer_user_id: "u1",
  task_doer_name: "Alice",
  task_doer_email: null,
  due_time: "10:00:00",
  points_on_completion: 2,
  negative_points_if_missed: -2,
  active: true,
  created_by: null,
  created_at: "",
  updated_at: "",
};

beforeEach(() => {
  insertCalls = [];
  insertImpl = (row) => ({
    data: { id: "ledger-1", ...row, created_at: new Date().toISOString() },
    error: null,
  });
  templateList = [];
  completionList = [];
});

describe("awardCompletionPoints", () => {
  it("writes on-time event when completed before due_time", async () => {
    const entry = await awardCompletionPoints({
      template: baseTpl,
      completion: {
        id: "c1",
        completed_by_user_id: "u1",
        completed_by_team_member_id: "tm1",
        completed_at: "2026-06-13T08:00:00Z",
      } as any,
      userId: "u1",
    });
    expect(entry?.event_type).toBe("recurring_daily_completed");
    expect(entry?.points).toBe(2);
    expect(insertCalls).toHaveLength(1);
  });

  it("writes late event when completed after due_time on same day", async () => {
    const completedAt = new Date();
    completedAt.setHours(23, 0, 0, 0);
    const entry = await awardCompletionPoints({
      template: baseTpl,
      completion: {
        id: "c2",
        completed_by_user_id: "u1",
        completed_by_team_member_id: "tm1",
        completed_at: completedAt.toISOString(),
      } as any,
      userId: "u1",
    });
    expect(entry?.event_type).toBe("recurring_daily_late_completed");
    expect(entry?.points).toBe(2);
  });

  it("returns null (no throw) when duplicate completion reward attempted", async () => {
    insertImpl = () => ({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });
    const entry = await awardCompletionPoints({
      template: baseTpl,
      completion: {
        id: "c1",
        completed_by_user_id: "u1",
        completed_by_team_member_id: "tm1",
        completed_at: "2026-06-13T08:00:00Z",
      } as any,
      userId: "u1",
    });
    expect(entry).toBeNull();
  });
});

describe("applyMissedPenaltiesForDate", () => {
  it("writes one negative entry per missed active template", async () => {
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    templateList = [
      { ...baseTpl, id: "t1", due_time: "10:00:00" },
      { ...baseTpl, id: "t2", due_time: "10:00:00" },
    ];
    completionList = [];
    const r = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(r.appliedCount).toBe(2);
    expect(r.noMissedCount).toBe(0);
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0].event_type).toBe("recurring_daily_missed");
    expect(insertCalls[0].points).toBe(-2);
  });

  it("does not penalize pending templates (before due_time)", async () => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    templateList = [{ ...baseTpl, id: "t1", due_time: "10:00:00" }];
    const r = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(r.appliedCount).toBe(0);
    expect(r.noMissedCount).toBe(1);
    expect(insertCalls).toHaveLength(0);
  });

  it("does not penalize templates already completed", async () => {
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    templateList = [{ ...baseTpl, id: "t1" }];
    completionList = [
      {
        id: "c1",
        template_id: "t1",
        completion_date: "2026-06-13",
        completed_by_user_id: "u1",
        completed_by_team_member_id: "tm1",
        completed_by_name: "A",
        completed_at: new Date().toISOString(),
        proof_url: null,
        note: null,
      },
    ];
    const r = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(r.appliedCount).toBe(0);
    expect(insertCalls).toHaveLength(0);
  });

  it("skips templates without assigned user", async () => {
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    templateList = [{ ...baseTpl, id: "t1", task_doer_user_id: null }];
    const r = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(r.appliedCount).toBe(0);
    expect(insertCalls).toHaveLength(0);
  });

  it("counts duplicate-insert errors as skippedDuplicate", async () => {
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    templateList = [{ ...baseTpl, id: "t1" }];
    insertImpl = () => ({
      data: null,
      error: { message: "duplicate key value violates unique constraint rdpl_missed_unique" },
    });
    const r = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(r.appliedCount).toBe(0);
    expect(r.skippedDuplicateCount).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it("late completion after penalty: both entries coexist (audit trail)", async () => {
    // Simulate: penalty already written (skipped as duplicate), then late completion writes reward
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    templateList = [{ ...baseTpl, id: "t1" }];
    insertImpl = () => ({
      data: null,
      error: { message: "duplicate key value violates unique constraint rdpl_missed_unique" },
    });
    const penalty = await applyMissedPenaltiesForDate({ adminUserId: "admin", now });
    expect(penalty.skippedDuplicateCount).toBe(1);

    // Reset insertImpl for the reward path
    insertImpl = (row) => ({ data: { id: "ledger-x", ...row, created_at: "" }, error: null });
    const reward = await awardCompletionPoints({
      template: baseTpl,
      completion: {
        id: "c-late",
        completed_by_user_id: "u1",
        completed_by_team_member_id: "tm1",
        completed_at: now.toISOString(),
      } as any,
      userId: "u1",
    });
    expect(reward?.event_type).toBe("recurring_daily_late_completed");
    expect(reward?.points).toBe(2);
    // Two separate insert attempts overall
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);
  });
});
