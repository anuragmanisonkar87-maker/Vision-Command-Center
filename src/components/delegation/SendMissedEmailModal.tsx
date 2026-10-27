// Phase 3E — admin confirmation modal that sends a missed-task email draft via Resend.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  sendMissedTaskEmail,
  type SendMissedEmailResult,
} from "@/lib/delegation/missedEmailSender.functions";
import type { MissedTaskEmailLog } from "@/services/delegation/missedTaskService";

type Props = {
  open: boolean;
  log: MissedTaskEmailLog;
  providerConfigured: boolean;
  onClose: () => void;
  onSent: () => void;
};

export default function SendMissedEmailModal({ open, log, providerConfigured, onClose, onSent }: Props) {
  const sendFn = useServerFn(sendMissedTaskEmail);
  const [busy, setBusy] = useState(false);
  const isRetry = log.email_status === "failed";

  if (!open) return null;

  const handleSend = async () => {
    setBusy(true);
    try {
      const result = (await sendFn({ data: { logId: log.id } })) as SendMissedEmailResult;
      if (result.ok) {
        toast.success("Email sent.");
        onSent();
        onClose();
      } else {
        if (result.status === "not_configured") {
          toast.error("Email provider not configured.");
        } else if (result.status === "forbidden") {
          toast.error("Only admins can send missed-task emails.");
        } else {
          toast.error(result.error || "Send failed.");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Send failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 10, width: "100%", maxWidth: 580,
          maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EFEAE0" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: "#a8a29e", fontWeight: 600 }}>
            {isRetry ? "Retry Send" : "Confirm Send"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#1c1917", marginTop: 2 }}>
            Send missed-task email
          </div>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", display: "grid", gap: 12 }}>
          {!providerConfigured && (
            <div data-testid="provider-not-configured" style={{ padding: "10px 12px", borderRadius: 6, background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", fontSize: 12 }}>
              Email provider not configured. Add <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> to enable sending.
            </div>
          )}

          <Field label="To" value={log.email_to} />
          <Field label="Subject" value={log.email_subject} />
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "#a8a29e", marginBottom: 4 }}>
              Body
            </div>
            <pre style={{
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              padding: 12, background: "#fafaf9", border: "1px solid #EFEAE0", borderRadius: 6,
              fontSize: 12.5, fontFamily: "inherit", color: "#292524", margin: 0, maxHeight: 280, overflowY: "auto",
            }}>{log.email_body}</pre>
          </div>

          {log.email_status === "failed" && log.error_message && (
            <div style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 10px" }}>
              Previous error: {log.error_message}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #EFEAE0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            disabled={busy}
            data-testid="send-missed-email-cancel"
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #D6D3D1", background: "#fff", fontSize: 12, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={busy || !providerConfigured}
            data-testid="send-missed-email-confirm"
            style={{
              padding: "8px 14px", borderRadius: 6,
              background: providerConfigured ? "#0f766e" : "#a8a29e",
              color: "#fff", fontSize: 12, fontWeight: 600,
              opacity: busy ? 0.6 : 1, cursor: providerConfigured ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Sending…" : isRetry ? "Retry Send" : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "#a8a29e", marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#292524", fontWeight: 500, fontSize: 13.5, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
