// Phase 3D — service for missed stand-up / ad hoc task penalties + email drafts.
// Adds configurable penalty points (delegation_settings.settings.missed_task_penalty_points)
// and supports custom subject/body from the editable draft modal.
import { supabase } from "@/integrations/supabase/client";
import { listAllTasks, type DelegationTask } from "./delegationService";
import {
  isStandupOrAdHocMissed,
  eventTypeFor,
  penaltyFor,
  formatDueWhen,
  DEFAULT_MISSED_TASK_PENALTY,
} from "@/lib/delegation/missedTask";

const db = supabase as any;
const LEDGER = "task_missed_points_ledger";
const EMAILS = "task_missed_email_logs";
const SETTINGS_KEY = "missed_task_penalty_points";

function isUniqueViolation(msg: string): boolean {
  return /duplicate key|unique/i.test(msg);
}

export type MissedTaskPointsEntry = {
  id: string;
  task_id: string;
  user_id: string;
  team_member_id: string | null;
  points: number;
  event_type: "standup_task_missed" | "ad_hoc_task_missed";
  reason: string | null;
  period_date: string;
  created_by: string | null;
  created_at: string;
};

export type MissedTaskEmailLog = {
  id: string;
  task_id: string;
  user_id: string;
  team_member_id: string | null;
  email_to: string;
  email_subject: string;
  email_body: string;
  email_type: "missed_task_alert";
  email_status: "draft" | "sent" | "failed";
  sent_at: string | null;
  sent_by: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type ApplyMissedPenaltiesResult = {
  appliedCount: number;
  skippedDuplicateCount: number;
  noMissedCount: number;
  errors: string[];
};

/**
 * Reads the admin-configured missed-task penalty from delegation_settings.
 * Falls back to DEFAULT_MISSED_TASK_PENALTY when unset or invalid.
 */
export async function getConfiguredMissedTaskPenalty(): Promise<number> {
  try {
    const { data, error } = await db
      .from("delegation_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    if (error) return DEFAULT_MISSED_TASK_PENALTY;
    const v = (data?.settings ?? {})[SETTINGS_KEY];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return DEFAULT_MISSED_TASK_PENALTY;
  } catch {
    return DEFAULT_MISSED_TASK_PENALTY;
  }
}

/** Admin update — patches just the missed-task penalty field on delegation_settings. */
export async function setConfiguredMissedTaskPenalty(points: number): Promise<void> {
  const { data: row, error: readErr } = await db
    .from("delegation_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const next = { ...(row?.settings ?? {}), [SETTINGS_KEY]: points };
  const { error } = await db
    .from("delegation_settings")
    .update({ settings: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

/**
 * Admin action — scan delegation tasks and write one missed-penalty row per
 * stand-up / ad hoc task that is past due and not submitted/completed.
 * Duplicates are skipped via the unique(task_id, event_type) index.
 */
export async function applyMissedTaskPenalties(args: {
  adminUserId: string;
  now?: Date;
  tasks?: DelegationTask[];
  /** Optional explicit penalty override (e.g. from caller-side settings). */
  configuredPenalty?: number;
}): Promise<ApplyMissedPenaltiesResult> {
  const now = args.now ?? new Date();
  const tasks = args.tasks ?? (await listAllTasks({}));
  const penalty =
    typeof args.configuredPenalty === "number"
      ? args.configuredPenalty
      : await getConfiguredMissedTaskPenalty();
  const result: ApplyMissedPenaltiesResult = {
    appliedCount: 0,
    skippedDuplicateCount: 0,
    noMissedCount: 0,
    errors: [],
  };
  for (const t of tasks) {
    if (!isStandupOrAdHocMissed(t as any, now)) {
      result.noMissedCount++;
      continue;
    }
    if (!t.assignee_id) continue;
    const event = eventTypeFor(t.task_type);
    if (!event) continue;
    const { error } = await db.from(LEDGER).insert({
      task_id: t.id,
      user_id: t.assignee_id,
      team_member_id: t.assignee_team_member_id ?? null,
      points: penaltyFor(t.task_type, penalty),
      event_type: event,
      reason: "missed_due_date",
      period_date: t.due_date,
      created_by: args.adminUserId,
    });
    if (error) {
      if (isUniqueViolation(error.message)) result.skippedDuplicateCount++;
      else result.errors.push(`${t.title}: ${error.message}`);
    } else {
      result.appliedCount++;
    }
  }
  return result;
}

export async function listMissedTaskLedger(opts?: {
  userId?: string;
  limit?: number;
}): Promise<MissedTaskPointsEntry[]> {
  let q = db.from(LEDGER).select("*").order("created_at", { ascending: false });
  if (opts?.userId) q = q.eq("user_id", opts.userId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MissedTaskPointsEntry[];
}

// ---------- Email drafts ----------

export const DEFAULT_MISSED_TASK_SUBJECT = "Missed Task Alert";

export function defaultMissedTaskSubject(taskTitle: string): string {
  return `Missed Task Alert: ${taskTitle}`;
}

export function defaultMissedTaskBody(args: {
  employeeName: string;
  taskTitle: string;
  taskTypeLabel: string;
  dueDate: string;
  dueTime?: string | null;
  penaltyApplied: boolean;
  penaltyPoints: number;
}): string {
  const penaltyLine = args.penaltyApplied
    ? `A penalty of ${args.penaltyPoints} points has been recorded in your performance dashboard.`
    : `Negative points of ${args.penaltyPoints} may be applied as per company policy.`;
  const when = formatDueWhen(args.dueDate, args.dueTime);
  return (
    `Hi ${args.employeeName},\n\n` +
    `You missed the assigned task "${args.taskTitle}" (${args.taskTypeLabel}) which was due on ${when}. ` +
    `This has been recorded in your performance dashboard. ${penaltyLine}\n\n` +
    `Please review and discuss with your manager if you need support.`
  );
}

/** Whether a real email provider is wired. Phase 3D: drafts only. */
export function hasEmailProvider(): boolean {
  return false;
}

export type DraftMissedEmailInput = {
  task: Pick<
    DelegationTask,
    "id" | "title" | "task_type" | "due_date" | "assignee_id"
    | "assignee_team_member_id" | "assignee_name" | "assignee_email"
  > & { due_time?: string | null };
  recipientEmail: string;
  subject?: string;
  body?: string;
  adminUserId: string;
  penaltyApplied?: boolean;
  penaltyPoints?: number;
};

export type DraftMissedEmailResult =
  | { status: "draft"; log: MissedTaskEmailLog; reason: string }
  | { status: "failed"; log: null; error: string };

export async function draftMissedTaskEmail(
  input: DraftMissedEmailInput,
): Promise<DraftMissedEmailResult> {
  if (!input.task.assignee_id) {
    return { status: "failed", log: null, error: "Task has no assigned user." };
  }
  const penaltyPoints =
    typeof input.penaltyPoints === "number"
      ? input.penaltyPoints
      : penaltyFor(input.task.task_type);
  const subject =
    (input.subject ?? "").trim() || defaultMissedTaskSubject(input.task.title);
  const body =
    (input.body ?? "").trim() ||
    defaultMissedTaskBody({
      employeeName: input.task.assignee_name ?? "team member",
      taskTitle: input.task.title,
      taskTypeLabel:
        input.task.task_type === "ad_hoc" ? "Ad Hoc Task" : "Stand-up Task",
      dueDate: input.task.due_date ?? "—",
      dueTime: input.task.due_time ?? null,
      penaltyApplied: !!input.penaltyApplied,
      penaltyPoints,
    });
  try {
    const { data, error } = await db
      .from(EMAILS)
      .insert({
        task_id: input.task.id,
        user_id: input.task.assignee_id,
        team_member_id: input.task.assignee_team_member_id ?? null,
        email_to: input.recipientEmail,
        email_subject: subject,
        email_body: body,
        email_type: "missed_task_alert",
        email_status: "draft",
        sent_by: input.adminUserId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      status: "draft",
      log: data as MissedTaskEmailLog,
      reason:
        "Email provider is not configured. Draft has been saved (no real email sent).",
    };
  } catch (e: any) {
    return { status: "failed", log: null, error: e.message };
  }
}

export async function listMissedTaskEmails(opts?: {
  userId?: string;
  limit?: number;
}): Promise<MissedTaskEmailLog[]> {
  let q = db.from(EMAILS).select("*").order("created_at", { ascending: false });
  if (opts?.userId) q = q.eq("user_id", opts.userId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MissedTaskEmailLog[];
}
