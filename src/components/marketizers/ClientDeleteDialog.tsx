// Confirmation dialog for soft-deleting a Marketizers client.
// Captures a reason and explains that linked finance records stay intact.
import { useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";

export function ClientDeleteDialog({
  clientName,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 70,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--parchment)", borderRadius: 10, width: "min(480px, 100%)",
          border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,.4)",
        }}
      >
        <div style={{ padding: "22px 24px 12px", borderBottom: "1px solid var(--border)" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Delete Client</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
            Delete “{clientName}”?
          </h2>
        </div>
        <div style={{ padding: "16px 24px 8px", color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.55 }}>
          This client may be linked to monthly revenue, collections, expenses, and reports.
          To protect finance history, the client will be <strong>marked as deleted</strong> — past records stay intact and remain in reports.
        </div>
        <div style={{ padding: "8px 24px 18px" }}>
          <FieldLabel>Reason (optional)</FieldLabel>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Contract ended, duplicate record, request from founder…"
            style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "'Figtree',sans-serif" }}
          />
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--ivory)", display: "flex", justifyContent: "flex-end", gap: 8, borderRadius: "0 0 10px 10px" }}>
          <button className="btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-sm btn-danger" onClick={submit} disabled={busy}>
            {busy ? "Deleting…" : "Delete Client"}
          </button>
        </div>
      </div>
    </div>
  );
}
