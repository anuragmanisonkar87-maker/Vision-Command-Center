// Phase 3F — Discipline Automation runner.
// Detects missed stand-up / ad hoc tasks, optionally applies penalties,
// creates email drafts, and (only if explicitly enabled) sends them via Resend.
// All behavior is gated by `delegation_settings.settings.discipline_automation`.
// Safe by default: auto-send is OFF. Every run is logged.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isStandupOrAdHocMissed, eventTypeFor, penaltyFor, DEFAULT_MISSED_TASK_PENALTY } from "@/lib/delegation/missedTask";
import {
  defaultMissedTaskSubject,
  defaultMissedTaskBody,
} from "@/services/delegation/missedTaskService";
import {
  performSendMissedTaskEmail,
  sanitizeProviderError,
} from "@/lib/delegation/missedEmailSender.functions";

export type DisciplineAutomationReport = {
  runType: "manual" | "scheduled";
  status: "pass" | "partial" | "fail";
  startedAt: string;
  finishedAt: string;
  scannedCount: number;
  missedCount: number;
  penaltiesApplied: number;
  penaltiesSkipped: number;
  draftsCreated: number;
  draftsSkipped: number;
  emailsSent: number;
  emailsFailed: number;
  autoSendEnabled: boolean;
  providerConfigured: boolean;
  errors: string[];
  notes: string[];
  logId?: string;
};

const SETTINGS_KEY = "discipline_automation";
const PENALTY_SETTING = "missed_task_penalty_points";

type AutomationSettings = {
  auto_apply_penalties: boolean;
  auto_create_drafts: boolean;
  auto_send_emails: boolean;
  automation_time: string;
  email_mode: "draft_only" | "auto_send_after_draft";
};

const DEFAULT_SETTINGS: AutomationSettings = {
  auto_apply_penalties: false,
  auto_create_drafts: true,
  auto_send_emails: false,
  automation_time: "19:00",
  email_mode: "draft_only",
};

async function loadSettings(supabase: any): Promise<{ settings: AutomationSettings; penalty: number }> {
  const { data } = await supabase
    .from("delegation_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const raw = (data?.settings ?? {}) as Record<string, any>;
  const auto = { ...DEFAULT_SETTINGS, ...(raw[SETTINGS_KEY] ?? {}) };
  const p = raw[PENALTY_SETTING];
  const penalty = typeof p === "number" && Number.isFinite(p) ? p : DEFAULT_MISSED_TASK_PENALTY;
  return { settings: auto, penalty };
}

function isUniqueViolation(msg: string): boolean {
  return /duplicate key|unique/i.test(msg);
}

/**
 * Pure core. Caller is responsible for authorization.
 * `userId` is used as `created_by` / `sent_by` for written rows. For scheduled
 * runs without a user, pass null and we'll store nulls on those columns.
 */
export async function performDisciplineAutomation(
  supabase: any,
  userId: string | null,
  opts: { runType: "manual" | "scheduled"; overrideSettings?: Partial<AutomationSettings> } = {
    runType: "manual",
  },
): Promise<DisciplineAutomationReport> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const notes: string[] = [];

  const { settings: loaded, penalty } = await loadSettings(supabase);
  const settings: AutomationSettings = { ...loaded, ...(opts.overrideSettings ?? {}) };
  const providerConfigured = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  let scannedCount = 0;
  let missedCount = 0;
  let penaltiesApplied = 0;
  let penaltiesSkipped = 0;
  let draftsCreated = 0;
  let draftsSkipped = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  try {
    const { data: tasks, error: tErr } = await supabase
      .from("delegation_tasks")
      .select("id, title, task_type, due_date, due_time, system_stage, is_deleted, completed_at, assignee_id, assignee_team_member_id, assignee_name, assignee_email")
      .eq("is_deleted", false)
      .in("task_type", ["standup", "ad_hoc"]);
    if (tErr) throw new Error(tErr.message);
    scannedCount = (tasks ?? []).length;

    const now = new Date();
    const missed = (tasks ?? []).filter((t: any) => isStandupOrAdHocMissed(t, now) && t.assignee_id);
    missedCount = missed.length;

    if (!missed.length) {
      notes.push("No missed stand-up / ad hoc tasks found.");
    }

    // A) Penalties
    if (settings.auto_apply_penalties) {
      for (const t of missed) {
        const event = eventTypeFor(t.task_type);
        if (!event) continue;
        const { error } = await supabase.from("task_missed_points_ledger").insert({
          task_id: t.id,
          user_id: t.assignee_id,
          team_member_id: t.assignee_team_member_id ?? null,
          points: penaltyFor(t.task_type, penalty),
          event_type: event,
          reason: "missed_due_date",
          period_date: t.due_date,
          created_by: userId,
        });
        if (error) {
          if (isUniqueViolation(error.message)) penaltiesSkipped++;
          else errors.push(`penalty[${t.title}]: ${sanitizeProviderError(error.message)}`);
        } else {
          penaltiesApplied++;
        }
      }
    } else {
      notes.push("Auto-apply penalties is OFF.");
    }

    // B) Drafts
    let createdDrafts: Array<{ id: string; task_id: string }> = [];
    if (settings.auto_create_drafts) {
      // Find existing draft/sent/failed logs to avoid duplicates.
      const taskIds = missed.map((t: any) => t.id);
      let existing: Array<{ task_id: string; email_status: string }> = [];
      if (taskIds.length) {
        const { data: ex } = await supabase
          .from("task_missed_email_logs")
          .select("task_id, email_status")
          .eq("email_type", "missed_task_alert")
          .in("task_id", taskIds);
        existing = ex ?? [];
      }
      const existingByTask = new Set(existing.map((e) => e.task_id));

      for (const t of missed) {
        if (existingByTask.has(t.id)) { draftsSkipped++; continue; }
        const recipient = (t.assignee_email ?? "").trim();
        if (!recipient) {
          draftsSkipped++;
          notes.push(`draft skipped — no recipient for "${t.title}"`);
          continue;
        }
        const subject = defaultMissedTaskSubject(t.title);
        const body = defaultMissedTaskBody({
          employeeName: t.assignee_name ?? "team member",
          taskTitle: t.title,
          taskTypeLabel: t.task_type === "ad_hoc" ? "Ad Hoc Task" : "Stand-up Task",
          dueDate: t.due_date ?? "—",
          dueTime: t.due_time ?? null,
          penaltyApplied: settings.auto_apply_penalties,
          penaltyPoints: penaltyFor(t.task_type, penalty),
        });
        const { data, error } = await supabase
          .from("task_missed_email_logs")
          .insert({
            task_id: t.id,
            user_id: t.assignee_id,
            team_member_id: t.assignee_team_member_id ?? null,
            email_to: recipient,
            email_subject: subject,
            email_body: body,
            email_type: "missed_task_alert",
            email_status: "draft",
            sent_by: userId,
          })
          .select("id, task_id")
          .single();
        if (error) {
          errors.push(`draft[${t.title}]: ${sanitizeProviderError(error.message)}`);
        } else if (data) {
          createdDrafts.push(data);
          draftsCreated++;
        }
      }
    } else {
      notes.push("Auto-create drafts is OFF.");
    }

    // C) Send (only if explicitly enabled AND provider configured)
    if (settings.auto_send_emails) {
      if (!providerConfigured) {
        notes.push("Auto-send is ON but email provider is not configured — no emails sent.");
      } else {
        // Pull all eligible draft/failed logs for missed tasks (including pre-existing ones)
        const taskIds = missed.map((t: any) => t.id);
        let sendable: Array<{ id: string }> = [];
        if (taskIds.length) {
          const { data: rows } = await supabase
            .from("task_missed_email_logs")
            .select("id, email_status")
            .eq("email_type", "missed_task_alert")
            .in("task_id", taskIds)
            .in("email_status", ["draft", "failed"]);
          sendable = (rows ?? []) as any;
        }
        for (const row of sendable) {
          const r = await performSendMissedTaskEmail(supabase, userId ?? "", { logId: row.id });
          if (r.ok) emailsSent++;
          else {
            emailsFailed++;
            errors.push(`send[${row.id}]: ${r.error}`);
          }
        }
      }
    } else {
      notes.push("Auto-send emails is OFF (default).");
    }
  } catch (e: any) {
    errors.push(sanitizeProviderError(e?.message ?? e));
  }

  const finishedAt = new Date().toISOString();
  const status: DisciplineAutomationReport["status"] =
    errors.length === 0 ? "pass"
    : (penaltiesApplied + draftsCreated + emailsSent) > 0 ? "partial"
    : "fail";

  // Write run log (best-effort)
  let logId: string | undefined;
  try {
    const { data } = await supabase
      .from("discipline_automation_run_logs")
      .insert({
        run_type: opts.runType,
        status,
        started_at: startedAt,
        finished_at: finishedAt,
        run_by: userId,
        scanned_count: scannedCount,
        penalties_applied: penaltiesApplied,
        penalties_skipped: penaltiesSkipped,
        drafts_created: draftsCreated,
        drafts_skipped: draftsSkipped,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        report_json: { errors, notes, missedCount, autoSendEnabled: settings.auto_send_emails, providerConfigured },
        error_message: errors.length ? errors.slice(0, 3).join(" | ").slice(0, 500) : null,
      })
      .select("id")
      .maybeSingle();
    logId = data?.id;
  } catch (e: any) {
    notes.push(`run log insert failed: ${sanitizeProviderError(e?.message ?? e)}`);
  }

  return {
    runType: opts.runType,
    status,
    startedAt,
    finishedAt,
    scannedCount,
    missedCount,
    penaltiesApplied,
    penaltiesSkipped,
    draftsCreated,
    draftsSkipped,
    emailsSent,
    emailsFailed,
    autoSendEnabled: settings.auto_send_emails,
    providerConfigured,
    errors,
    notes,
    logId,
  };
}

export const runDisciplineAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DisciplineAutomationReport> => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      const ts = new Date().toISOString();
      return {
        runType: "manual",
        status: "fail",
        startedAt: ts,
        finishedAt: ts,
        scannedCount: 0,
        missedCount: 0,
        penaltiesApplied: 0, penaltiesSkipped: 0,
        draftsCreated: 0, draftsSkipped: 0,
        emailsSent: 0, emailsFailed: 0,
        autoSendEnabled: false,
        providerConfigured: false,
        errors: ["Forbidden — admin only."],
        notes: [],
      };
    }
    return performDisciplineAutomation(supabase, userId, { runType: "manual" });
  });

export type DisciplineRunLogRow = {
  id: string;
  run_type: "manual" | "scheduled";
  status: "pass" | "partial" | "fail";
  started_at: string;
  finished_at: string | null;
  scanned_count: number;
  penalties_applied: number;
  penalties_skipped: number;
  drafts_created: number;
  drafts_skipped: number;
  emails_sent: number;
  emails_failed: number;
  error_message: string | null;
};

export const listDisciplineRunLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DisciplineRunLogRow[]> => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return [];
    const { data } = await supabase
      .from("discipline_automation_run_logs")
      .select("id, run_type, status, started_at, finished_at, scanned_count, penalties_applied, penalties_skipped, drafts_created, drafts_skipped, emails_sent, emails_failed, error_message")
      .order("started_at", { ascending: false })
      .limit(20);
    return (data ?? []) as DisciplineRunLogRow[];
  });
