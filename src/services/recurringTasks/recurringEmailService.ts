// Phase 2D — manual missed-task email log service.
// No email provider is wired in this app, so this service logs drafts only.
// If/when a provider exists, `hasEmailProvider()` returns true and
// `sendMissedTaskEmail` will attempt a server-side send via that path.
import { supabase } from "@/integrations/supabase/client";
import type { RecurringDailyTask } from "./recurringTasksService";

export type RecurringEmailType = "missed_task_reminder";
export type RecurringEmailStatus = "draft" | "sent" | "failed";

export type RecurringDailyEmailLog = {
  id: string;
  template_id: string;
  user_id: string;
  team_member_id: string | null;
  email_to: string;
  email_subject: string;
  email_body: string;
  email_type: RecurringEmailType;
  email_status: RecurringEmailStatus;
  points_date: string;
  sent_at: string | null;
  sent_by: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

const db = supabase as any;
const TABLE = "recurring_daily_email_logs";

/** Whether the app has a configured server-side email provider. */
export function hasEmailProvider(): boolean {
  return false; // Phase 2D: no provider wired yet.
}

export const DEFAULT_MISSED_SUBJECT = "Missed Daily Task Reminder";

export function defaultMissedBody(employeeName: string, taskTitle: string): string {
  return (
    `Hi ${employeeName}, you missed your daily task "${taskTitle}" for today. ` +
    `Please complete it as soon as possible and update your checklist. ` +
    `If there is any issue, please inform your manager.`
  );
}

export type SendMissedEmailInput = {
  template: Pick<
    RecurringDailyTask,
    "id" | "title" | "task_doer_user_id" | "task_doer_team_member_id" | "task_doer_email" | "task_doer_name"
  >;
  recipientEmail: string;
  subject: string;
  body: string;
  pointsDate: string;
  adminUserId: string;
};

export type SendResult =
  | { status: "sent"; log: RecurringDailyEmailLog }
  | { status: "draft"; log: RecurringDailyEmailLog; reason: string }
  | { status: "failed"; log: RecurringDailyEmailLog | null; error: string }
  | { status: "duplicate"; reason: string };

function isUniqueViolation(msg: string): boolean {
  return /duplicate key|unique/i.test(msg);
}

async function insertLog(row: Partial<RecurringDailyEmailLog>): Promise<RecurringDailyEmailLog> {
  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as RecurringDailyEmailLog;
}

/**
 * Manual admin action. If no email provider is configured, this saves a
 * draft log entry rather than pretending to send.
 */
export async function sendMissedTaskEmail(input: SendMissedEmailInput): Promise<SendResult> {
  if (!input.template.task_doer_user_id) {
    return { status: "failed", log: null, error: "Template has no assigned user." };
  }
  const base = {
    template_id: input.template.id,
    user_id: input.template.task_doer_user_id,
    team_member_id: input.template.task_doer_team_member_id,
    email_to: input.recipientEmail,
    email_subject: input.subject,
    email_body: input.body,
    email_type: "missed_task_reminder" as const,
    points_date: input.pointsDate,
  };

  if (!hasEmailProvider()) {
    try {
      const log = await insertLog({ ...base, email_status: "draft" });
      return {
        status: "draft",
        log,
        reason: "Email provider is not configured. Draft has been saved.",
      };
    } catch (e: any) {
      return { status: "failed", log: null, error: e.message };
    }
  }

  // Provider path (unreachable today; kept for future wiring).
  try {
    const log = await insertLog({
      ...base,
      email_status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: input.adminUserId,
    });
    return { status: "sent", log };
  } catch (e: any) {
    if (isUniqueViolation(e.message)) {
      return { status: "duplicate", reason: "A successful reminder for today already exists." };
    }
    try {
      const log = await insertLog({
        ...base,
        email_status: "failed",
        sent_by: input.adminUserId,
        error_message: e.message,
      });
      return { status: "failed", log, error: e.message };
    } catch (inner: any) {
      return { status: "failed", log: null, error: inner.message };
    }
  }
}

export async function listRecentEmailLogs(limit = 25): Promise<RecurringDailyEmailLog[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringDailyEmailLog[];
}

export async function hasSuccessfulMissedReminder(
  templateId: string,
  userId: string,
  pointsDate: string,
): Promise<boolean> {
  const { data, error } = await db
    .from(TABLE)
    .select("id")
    .eq("template_id", templateId)
    .eq("user_id", userId)
    .eq("points_date", pointsDate)
    .eq("email_type", "missed_task_reminder")
    .eq("email_status", "sent")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
