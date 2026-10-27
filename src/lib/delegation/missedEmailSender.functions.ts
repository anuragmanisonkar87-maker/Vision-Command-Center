// Phase 3E — server-side missed-task email sender via Resend.
// Authenticated server fn: caller must be admin. Reads RESEND secrets at runtime.
// Never exposes secrets to the client. Updates log row to sent/failed.
//
// Phase 3E.2A — core send flow extracted into `performSendMissedTaskEmail` so
// the admin smoke-test runner can reuse identical send/validation/log-update
// logic without duplicating the Resend call.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendMissedEmailInput = {
  logId: string;
  /** Optional explicit overrides (must match log row if provided — we re-read log). */
  recipient?: string;
  subject?: string;
  body?: string;
  /** Allow re-sending a row whose status is already 'sent'. Default false. */
  allowResend?: boolean;
};

export type SendMissedEmailResult =
  | { ok: true; status: "sent"; providerMessageId: string | null; sentAt: string }
  | { ok: false; status: "failed" | "not_configured" | "forbidden" | "invalid"; error: string };

const FOOTER = "\n\n—\nThis is an automated operational notice from Vision Center.";

export function sanitizeProviderError(raw: unknown): string {
  const s =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : (() => {
            try {
              return JSON.stringify(raw);
            } catch {
              return "Unknown provider error.";
            }
          })();
  // Strip anything resembling a bearer token / api key.
  return s
    .replace(/re_[A-Za-z0-9_\-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

/**
 * Internal core: validate the log row, call Resend, persist result.
 * Caller is responsible for authorization (admin check). Reused by the
 * public `sendMissedTaskEmail` serverFn and the admin smoke-test runner.
 */
export async function performSendMissedTaskEmail(
  supabase: any,
  userId: string,
  data: SendMissedEmailInput,
): Promise<SendMissedEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL;
  if (!apiKey || !fromEmail) {
    return {
      ok: false,
      status: "not_configured",
      error: "Email provider not configured. Ask an admin to set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  const { data: log, error: logErr } = await supabase
    .from("task_missed_email_logs")
    .select("id, email_to, email_subject, email_body, email_status")
    .eq("id", data.logId)
    .maybeSingle();
  if (logErr || !log) {
    return { ok: false, status: "invalid", error: "Email draft not found." };
  }
  if (log.email_status === "sent" && !data.allowResend) {
    return { ok: false, status: "invalid", error: "This email has already been sent." };
  }
  if (
    log.email_status !== "draft" &&
    log.email_status !== "failed" &&
    !(data.allowResend && log.email_status === "sent")
  ) {
    return { ok: false, status: "invalid", error: `Cannot send from status '${log.email_status}'.` };
  }

  const recipient = (data.recipient ?? log.email_to ?? "").trim();
  const subject = (data.subject ?? log.email_subject ?? "").trim();
  const bodyRaw = (data.body ?? log.email_body ?? "").trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { ok: false, status: "invalid", error: "Recipient email is invalid." };
  }
  if (!subject) return { ok: false, status: "invalid", error: "Subject is required." };
  if (!bodyRaw) return { ok: false, status: "invalid", error: "Body is required." };

  const finalBody = bodyRaw + FOOTER;
  const htmlBody = finalBody
    .split("\n")
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br/>");

  let providerMessageId: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        text: finalBody,
        html: htmlBody,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const safeErr = sanitizeProviderError(payload?.message ?? `HTTP ${res.status}`);
      await supabase
        .from("task_missed_email_logs")
        .update({
          email_status: "failed",
          error_message: safeErr,
          provider: "resend",
          sent_by: userId,
        })
        .eq("id", log.id);
      return { ok: false, status: "failed", error: safeErr };
    }
    providerMessageId = typeof payload?.id === "string" ? payload.id : null;
  } catch (e) {
    const safeErr = sanitizeProviderError(e);
    await supabase
      .from("task_missed_email_logs")
      .update({
        email_status: "failed",
        error_message: safeErr,
        provider: "resend",
        sent_by: userId,
      })
      .eq("id", log.id);
    return { ok: false, status: "failed", error: safeErr };
  }

  const sentAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("task_missed_email_logs")
    .update({
      email_status: "sent",
      sent_at: sentAt,
      sent_by: userId,
      provider: "resend",
      provider_message_id: providerMessageId,
      error_message: null,
    })
    .eq("id", log.id);
  if (updErr) {
    return {
      ok: false,
      status: "failed",
      error: `Email sent but log update failed: ${sanitizeProviderError(updErr.message)}`,
    };
  }

  return { ok: true, status: "sent", providerMessageId, sentAt };
}

export const sendMissedTaskEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SendMissedEmailInput) => {
    if (!d || typeof d.logId !== "string" || d.logId.length === 0) {
      throw new Error("logId is required");
    }
    return d;
  })
  .handler(async ({ data, context }): Promise<SendMissedEmailResult> => {
    const { supabase, userId } = context as any;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return { ok: false, status: "forbidden", error: "Only admins can send missed-task emails." };
    }
    return performSendMissedTaskEmail(supabase, userId, data);
  });

/** Lightweight server fn: report whether Resend secrets are configured. No PII. */
export const getEmailProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ configured: boolean; provider: "resend" | null }> => {
    const ok = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
    return { configured: ok, provider: ok ? "resend" : null };
  });
