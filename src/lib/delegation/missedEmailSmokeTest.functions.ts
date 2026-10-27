// Phase 3E.2A — admin-only automated Resend smoke test runner.
// Creates a temporary QA missed task, applies a penalty, drafts an email,
// sends ONE email to Resend's sandbox address (delivered@resend.dev), verifies
// the row flipped to sent, then deletes the QA task (FK CASCADE removes the
// penalty + email log rows).
//
// Hard safety rules:
//   - Admin-only (requireSupabaseAuth + has_role 'admin').
//   - Recipient is HARDCODED to delivered@resend.dev. No caller override.
//   - Never returns the Resend API key or Bearer token. All errors sanitized.
//   - Reuses performSendMissedTaskEmail; no duplicated send/validation logic.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  performSendMissedTaskEmail,
  sanitizeProviderError,
  type SendMissedEmailResult,
} from "./missedEmailSender.functions";

export const SMOKE_TEST_RECIPIENT = "delivered@resend.dev";
export const SMOKE_TEST_TASK_TITLE = "QA Resend Smoke Test Missed Task";
export const SMOKE_TEST_SUBJECT = "QA Resend Smoke Test — Please Ignore";
export const SMOKE_TEST_BODY =
  "This is an automated QA smoke test from Vision Center. Please ignore.";

type StepResult = { ok: boolean; detail?: string; error?: string };

export type SmokeTestReport = {
  ok: boolean;
  steps: {
    provider: StepResult;
    qaTask: StepResult;
    penalty: StepResult;
    duplicatePenalty: StepResult;
    draft: StepResult;
    send: StepResult;
    dbSentStatus: StepResult;
    duplicateSentCheck: StepResult;
    cleanup: StepResult;
  };
  /** Sanitized provider message id when send succeeded. */
  providerMessageId: string | null;
  /** Sanitized error when overall result is failure. Never includes secrets. */
  error?: string;
};

function step(ok: boolean, detail?: string, error?: string): StepResult {
  return error ? { ok, detail, error: sanitizeProviderError(error) } : { ok, detail };
}

function emptyReport(): SmokeTestReport {
  const skip: StepResult = { ok: false, detail: "skipped" };
  return {
    ok: false,
    steps: {
      provider: skip,
      qaTask: skip,
      penalty: skip,
      duplicatePenalty: skip,
      draft: skip,
      send: skip,
      dbSentStatus: skip,
      duplicateSentCheck: skip,
      cleanup: skip,
    },
    providerMessageId: null,
  };
}

export const runMissedEmailSmokeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmokeTestReport> => {
    const { supabase, userId } = context as any;
    const report = emptyReport();

    // 1. Admin check.
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      report.error = "Only admins can run the Resend smoke test.";
      return report;
    }

    // 2. Provider check.
    const providerOk = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
    report.steps.provider = step(
      providerOk,
      providerOk ? "Resend secrets configured" : undefined,
      providerOk ? undefined : "RESEND_API_KEY or RESEND_FROM_EMAIL missing",
    );
    if (!providerOk) {
      report.error = "Email provider not configured.";
      return report;
    }

    let qaTaskId: string | null = null;
    try {
      // 3. Create QA task — self-assigned to the running admin so it never
      // touches a real employee's grid.
      const today = new Date().toISOString().slice(0, 10);
      const { data: taskRow, error: taskErr } = await supabase
        .from("delegation_tasks")
        .insert({
          title: SMOKE_TEST_TASK_TITLE,
          description: "Automated smoke test row. Safe to delete.",
          assignee_id: userId,
          created_by: userId,
          priority: "low",
          difficulty: "easy",
          status: "Planned",
          system_stage: "planned",
          task_type: "ad_hoc",
          due_date: today,
          due_time: "00:01:00",
        })
        .select("id")
        .single();
      if (taskErr || !taskRow) throw new Error(taskErr?.message || "task insert failed");
      qaTaskId = taskRow.id as string;
      report.steps.qaTask = step(true, `task=${qaTaskId}`);

      // 4. Penalty row.
      const { error: penErr } = await supabase.from("task_missed_points_ledger").insert({
        task_id: qaTaskId,
        user_id: userId,
        points: -2,
        event_type: "ad_hoc_task_missed",
        reason: "missed_due_date",
        period_date: today,
        created_by: userId,
      });
      if (penErr) throw new Error(`penalty: ${penErr.message}`);
      report.steps.penalty = step(true, "penalty recorded");

      // 4b. Duplicate-prevention check — insert again, expect unique violation.
      const { error: dupErr } = await supabase.from("task_missed_points_ledger").insert({
        task_id: qaTaskId,
        user_id: userId,
        points: -2,
        event_type: "ad_hoc_task_missed",
        reason: "missed_due_date",
        period_date: today,
        created_by: userId,
      });
      const dupBlocked = !!dupErr && /duplicate key|unique/i.test(dupErr.message);
      report.steps.duplicatePenalty = step(
        dupBlocked,
        dupBlocked ? "unique constraint enforced" : undefined,
        dupBlocked ? undefined : "duplicate penalty was NOT blocked",
      );

      // 5. Draft email log.
      const { data: logRow, error: logErr } = await supabase
        .from("task_missed_email_logs")
        .insert({
          task_id: qaTaskId,
          user_id: userId,
          email_to: SMOKE_TEST_RECIPIENT,
          email_subject: SMOKE_TEST_SUBJECT,
          email_body: SMOKE_TEST_BODY,
          email_type: "missed_task_alert",
          email_status: "draft",
          sent_by: userId,
        })
        .select("id")
        .single();
      if (logErr || !logRow) throw new Error(`draft: ${logErr?.message || "log insert failed"}`);
      const logId = logRow.id as string;
      report.steps.draft = step(true, `log=${logId}`);

      // 6. Send via shared helper.
      const sendResult: SendMissedEmailResult = await performSendMissedTaskEmail(
        supabase,
        userId,
        { logId },
      );
      report.steps.send = sendResult.ok
        ? step(true, "Resend accepted")
        : step(false, undefined, sendResult.error);
      if (!sendResult.ok) {
        report.error = sendResult.error;
        return report;
      }
      report.providerMessageId = sendResult.providerMessageId;

      // 7. Verify DB row.
      const { data: verified, error: verifyErr } = await supabase
        .from("task_missed_email_logs")
        .select("email_status, provider, sent_at, sent_by, provider_message_id")
        .eq("id", logId)
        .maybeSingle();
      if (verifyErr || !verified) {
        report.steps.dbSentStatus = step(false, undefined, verifyErr?.message || "row missing");
      } else {
        const allOk =
          verified.email_status === "sent" &&
          verified.provider === "resend" &&
          !!verified.sent_at &&
          !!verified.sent_by;
        report.steps.dbSentStatus = step(
          allOk,
          allOk
            ? `status=sent provider=resend sent_at=${verified.sent_at}`
            : undefined,
          allOk ? undefined : `unexpected row: status=${verified.email_status} provider=${verified.provider}`,
        );
      }

      // 8. Duplicate-sent check (the partial unique index allows at most one sent per task).
      const { data: sentRows, error: dupCountErr } = await supabase
        .from("task_missed_email_logs")
        .select("id")
        .eq("task_id", qaTaskId)
        .eq("email_status", "sent");
      if (dupCountErr) {
        report.steps.duplicateSentCheck = step(false, undefined, dupCountErr.message);
      } else {
        const exactlyOne = (sentRows ?? []).length === 1;
        report.steps.duplicateSentCheck = step(
          exactlyOne,
          exactlyOne ? "exactly one sent row" : undefined,
          exactlyOne ? undefined : `unexpected sent-row count: ${(sentRows ?? []).length}`,
        );
      }
    } catch (e: any) {
      report.error = sanitizeProviderError(e?.message ?? e);
    } finally {
      // 9. Cleanup. FK CASCADE on task_id removes penalty + email log rows.
      if (qaTaskId) {
        const { error: delErr } = await supabase
          .from("delegation_tasks")
          .delete()
          .eq("id", qaTaskId);
        report.steps.cleanup = delErr
          ? step(false, undefined, delErr.message)
          : step(true, "QA task + cascade rows removed");
      }
    }

    report.ok = Object.values(report.steps).every((s) => s.ok);
    return report;
  });
