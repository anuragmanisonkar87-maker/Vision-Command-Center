// Phase 3D — editable missed-task email draft modal.
// Admin can review/edit subject + body before saving as a draft row.
import { useEffect, useState } from "react";
import type { DelegationTask } from "@/services/delegation/delegationService";
import {
  defaultMissedTaskSubject,
  defaultMissedTaskBody,
  draftMissedTaskEmail,
} from "@/services/delegation/missedTaskService";
import { formatDueWhen } from "@/lib/delegation/missedTask";

export type MissedTaskEmailDraftModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  task: DelegationTask;
  adminUserId: string;
  penaltyPoints: number;
  penaltyApplied: boolean;
};

export default function MissedTaskEmailDraftModal(p: MissedTaskEmailDraftModalProps) {
  const typeLabel = p.task.task_type === "ad_hoc" ? "Ad Hoc Task" : "Stand-up Task";
  const dueWhen = formatDueWhen(p.task.due_date, p.task.due_time ?? null);
  const initialSubject = defaultMissedTaskSubject(p.task.title);
  const initialBody = defaultMissedTaskBody({
    employeeName: p.task.assignee_name ?? "team member",
    taskTitle: p.task.title,
    taskTypeLabel: typeLabel,
    dueDate: p.task.due_date ?? "—",
    dueTime: p.task.due_time ?? null,
    penaltyApplied: p.penaltyApplied,
    penaltyPoints: p.penaltyPoints,
  });

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipient, setRecipient] = useState(p.task.assignee_email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (p.open) {
      setSubject(initialSubject);
      setBody(initialBody);
      setRecipient(p.task.assignee_email ?? "");
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, p.task.id]);

  if (!p.open) return null;

  const handleSave = async () => {
    setBusy(true); setErr(null);
    try {
      if (!recipient.trim()) { setErr("Recipient email is required."); setBusy(false); return; }
      const r = await draftMissedTaskEmail({
        task: p.task,
        recipientEmail: recipient.trim(),
        subject,
        body,
        adminUserId: p.adminUserId,
        penaltyApplied: p.penaltyApplied,
        penaltyPoints: p.penaltyPoints,
      });
      if (r.status === "failed") { setErr(r.error); return; }
      p.onSaved?.();
      p.onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save draft.");
    } finally { setBusy(false); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="missed-email-draft-modal"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) p.onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 10, maxWidth: 640, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid #E8E5DE" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EFEAE0" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: "#78716c" }}>Discipline</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#292524" }}>Draft Missed Task Email</div>
          <div style={{ fontSize: 12, color: "#78716c", marginTop: 4 }}>No real email is sent — draft only.</div>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
            <Field label="Employee" value={p.task.assignee_name ?? "—"} />
            <Field label="Task" value={p.task.title} />
            <Field label="Type" value={typeLabel} />
            <Field label="Due" value={dueWhen} />
            <Field label="Penalty Points" value={String(p.penaltyPoints)} />
            <Field label="Penalty Status" value={p.penaltyApplied ? "Applied" : "Pending"} />
          </div>

          <label style={lbl}>
            Recipient
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              data-testid="missed-email-recipient"
              style={inp}
            />
          </label>
          <label style={lbl}>
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="missed-email-subject"
              style={inp}
            />
          </label>
          <label style={lbl}>
            Body
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              data-testid="missed-email-body"
              style={{ ...inp, fontFamily: "inherit", resize: "vertical" }}
            />
          </label>

          {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #EFEAE0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={p.onClose}
            disabled={busy}
            data-testid="missed-email-cancel"
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #D6D3D1", background: "#fff", fontSize: 12, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            data-testid="missed-email-save-draft"
            style={{ padding: "8px 14px", borderRadius: 6, background: "#1c1917", color: "#fff", fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Saving…" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "#a8a29e" }}>{label}</div>
      <div style={{ color: "#292524", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#57534e", fontWeight: 600,
};
const inp: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 6, border: "1px solid #D6D3D1",
  fontSize: 13, color: "#292524", background: "#fff", textTransform: "none", letterSpacing: 0, fontWeight: 400,
};
