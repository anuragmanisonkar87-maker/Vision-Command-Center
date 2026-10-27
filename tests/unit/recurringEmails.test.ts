// Phase 2D — tests for recurring missed-task email service.
import { describe, expect, it, vi, beforeEach } from "vitest";

let insertCalls: any[] = [];
let insertResult: { data: any; error: { message: string } | null } = {
  data: null,
  error: null,
};

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: (_t: string) => ({
        insert(row: any) {
          insertCalls.push(row);
          return {
            select: () => ({
              single: async () => {
                if (insertResult.error) return insertResult;
                return {
                  data: {
                    id: "log-" + insertCalls.length,
                    created_at: new Date().toISOString(),
                    sent_at: null,
                    sent_by: null,
                    provider_message_id: null,
                    error_message: null,
                    team_member_id: null,
                    ...row,
                  },
                  error: null,
                };
              },
            }),
          };
        },
        select() {
          return {
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({ limit: async () => ({ data: [], error: null }) }),
                  }),
                }),
              }),
            }),
          };
        },
      }),
    },
  };
});

import {
  sendMissedTaskEmail,
  hasEmailProvider,
  defaultMissedBody,
  DEFAULT_MISSED_SUBJECT,
} from "@/services/recurringTasks/recurringEmailService";

const baseTpl: any = {
  id: "t1",
  title: "Send daily report",
  task_doer_user_id: "u1",
  task_doer_team_member_id: "tm1",
  task_doer_email: "alice@example.com",
  task_doer_name: "Alice",
  due_time: "10:00:00",
  negative_points_if_missed: -2,
};

beforeEach(() => {
  insertCalls = [];
  insertResult = { data: null, error: null };
});

describe("recurringEmailService", () => {
  it("hasEmailProvider() is false in Phase 2D", () => {
    expect(hasEmailProvider()).toBe(false);
  });

  it("defaultMissedBody includes employee name and task title", () => {
    const body = defaultMissedBody("Alice", "Send daily report");
    expect(body).toContain("Alice");
    expect(body).toContain("Send daily report");
    expect(DEFAULT_MISSED_SUBJECT).toBe("Missed Daily Task Reminder");
  });

  it("saves a draft log entry when provider is not configured", async () => {
    const r = await sendMissedTaskEmail({
      template: baseTpl,
      recipientEmail: "alice@example.com",
      subject: DEFAULT_MISSED_SUBJECT,
      body: defaultMissedBody("Alice", baseTpl.title),
      pointsDate: "2026-06-13",
      adminUserId: "admin",
    });
    expect(r.status).toBe("draft");
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].email_status).toBe("draft");
    expect(insertCalls[0].email_type).toBe("missed_task_reminder");
    expect(insertCalls[0].user_id).toBe("u1");
  });

  it("returns failed when template has no assigned user (no write)", async () => {
    const r = await sendMissedTaskEmail({
      template: { ...baseTpl, task_doer_user_id: null },
      recipientEmail: "x@example.com",
      subject: "s",
      body: "b",
      pointsDate: "2026-06-13",
      adminUserId: "admin",
    });
    expect(r.status).toBe("failed");
    expect(insertCalls).toHaveLength(0);
  });

  it("returns failed when insert errors", async () => {
    insertResult = { data: null, error: { message: "permission denied" } };
    const r = await sendMissedTaskEmail({
      template: baseTpl,
      recipientEmail: "alice@example.com",
      subject: "s",
      body: "b",
      pointsDate: "2026-06-13",
      adminUserId: "admin",
    });
    expect(r.status).toBe("failed");
  });
});
