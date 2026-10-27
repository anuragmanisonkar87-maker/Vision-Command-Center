// Phase 3E — pure validation helpers for missed-task email sending.
// Extracted so unit tests can exercise the rules without the server fn machinery.

export type EmailSendablePolicy = {
  status: "draft" | "sent" | "failed" | string;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSendInputs(args: {
  recipient: string;
  subject: string;
  body: string;
}): ValidationResult {
  if (!args.recipient || !EMAIL_RE.test(args.recipient)) {
    return { ok: false, reason: "Recipient email is invalid." };
  }
  if (!args.subject.trim()) return { ok: false, reason: "Subject is required." };
  if (!args.body.trim()) return { ok: false, reason: "Body is required." };
  return { ok: true };
}

export function canSendFromStatus(status: string, allowResend: boolean): ValidationResult {
  if (status === "draft" || status === "failed") return { ok: true };
  if (status === "sent" && allowResend) return { ok: true };
  if (status === "sent") return { ok: false, reason: "This email has already been sent." };
  return { ok: false, reason: `Cannot send from status '${status}'.` };
}

export function sanitizeProviderError(raw: unknown): string {
  const s =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : (() => {
            try { return JSON.stringify(raw); } catch { return "Unknown provider error."; }
          })();
  return s
    .replace(/re_[A-Za-z0-9_\-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

export function hasResendConfig(env: { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string }): boolean {
  return !!(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

export const MISSED_TASK_EMAIL_FOOTER =
  "\n\n—\nThis is an automated operational notice from Vision Center.";
