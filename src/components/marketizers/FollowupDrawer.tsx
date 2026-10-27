// Reusable add/edit follow-up drawer. Right-side on desktop, full-screen on mobile.

import { useEffect, useMemo, useState } from "react";
import { FieldLabel, ErrorBanner, inputStyle, useIsNarrow } from "@/components/marketizers/ui";
import {
  createCollectionFollowup,
  updateCollectionFollowup,
} from "@/services/marketizers/collectionFollowupsService";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import { getMarketizersMonthlyEntries } from "@/services/marketizers/monthlyEntriesService";
import type {
  Client,
  CollectionFollowup,
  FollowupPriority,
  FollowupStatus,
  CommunicationChannel,
  MonthlyEntry,
} from "@/types/marketizers";

const STATUSES: FollowupStatus[] = [
  "pending",
  "followed_up",
  "promised",
  "partially_collected",
  "collected",
  "disputed",
  "overdue",
  "written_off",
];
const PRIORITIES: FollowupPriority[] = ["low", "medium", "high", "urgent"];
const CHANNELS: CommunicationChannel[] = ["Call", "WhatsApp", "Email", "Meeting", "Other"];

export type FollowupDrawerProps = {
  initial: Partial<CollectionFollowup>;
  fixedClientId?: string;
  onClose: () => void;
  onSaved: () => void;
};

type Draft = {
  id?: string;
  client_id: string;
  month: string;
  monthly_entry_id: string | null;
  pending_amount: string;
  amount_recovered: string;
  due_date: string;
  followup_owner: string;
  status: FollowupStatus;
  priority: FollowupPriority;
  communication_channel: CommunicationChannel | "";
  last_followup_date: string;
  next_followup_date: string;
  promise_to_pay_date: string;
  notes: string;
};

function toDraft(initial: Partial<CollectionFollowup>): Draft {
  return {
    id: initial.id,
    client_id: initial.client_id ?? "",
    month: initial.month ?? new Date().toISOString().slice(0, 7),
    monthly_entry_id: initial.monthly_entry_id ?? null,
    pending_amount: initial.pending_amount != null ? String(initial.pending_amount) : "",
    amount_recovered: initial.amount_recovered != null ? String(initial.amount_recovered) : "0",
    due_date: initial.due_date ?? "",
    followup_owner: initial.followup_owner ?? "",
    status: (initial.status ?? "pending") as FollowupStatus,
    priority: (initial.priority ?? "medium") as FollowupPriority,
    communication_channel: (initial.communication_channel ?? "") as any,
    last_followup_date: initial.last_followup_date ?? "",
    next_followup_date: initial.next_followup_date ?? "",
    promise_to_pay_date: initial.promise_to_pay_date ?? "",
    notes: initial.notes ?? "",
  };
}

export function FollowupDrawer({ initial, fixedClientId, onClose, onSaved }: FollowupDrawerProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [clients, setClients] = useState<Client[]>([]);
  const [entries, setEntries] = useState<MonthlyEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNarrow = useIsNarrow(720);

  useEffect(() => {
    if (!fixedClientId) void getMarketizersClients().then(setClients).catch(() => {});
  }, [fixedClientId]);

  useEffect(() => {
    if (draft.client_id && draft.month) {
      void getMarketizersMonthlyEntries(draft.month)
        .then((all) => setEntries(all.filter((e) => e.client_id === draft.client_id)))
        .catch(() => {});
    } else {
      setEntries([]);
    }
  }, [draft.client_id, draft.month]);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const validation = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!draft.client_id) errs.client_id = "Client is required";
    if (!/^\d{4}-\d{2}$/.test(draft.month)) errs.month = "Month must be YYYY-MM";
    const pending = Number(draft.pending_amount);
    if (!Number.isFinite(pending) || pending < 0) errs.pending_amount = "Pending must be ≥ 0";
    const recovered = Number(draft.amount_recovered || 0);
    if (!Number.isFinite(recovered) || recovered < 0) errs.amount_recovered = "Recovered must be ≥ 0";
    if (
      draft.last_followup_date &&
      draft.next_followup_date &&
      draft.next_followup_date < draft.last_followup_date
    ) {
      errs.next_followup_date = "Next follow-up cannot be before last follow-up";
    }
    if (draft.status === "collected" && !(recovered > 0)) {
      errs.amount_recovered = "Recovered amount required when status is Collected";
    }
    return errs;
  }, [draft]);

  const save = async () => {
    setError(null);
    if (Object.keys(validation).length) {
      setError("Please fix the highlighted fields.");
      return;
    }
    const pending = Number(draft.pending_amount);
    const recovered = Number(draft.amount_recovered || 0);

    if (recovered > pending) {
      const ok = confirm("Recovered amount exceeds pending. Save anyway?");
      if (!ok) return;
    }

    let status = draft.status;
    if (recovered > 0 && recovered < pending && status === "collected") {
      const partial = confirm(
        "Recovered amount is less than pending amount. Mark as partially collected instead?",
      );
      if (partial) status = "partially_collected";
    }

    setSaving(true);
    try {
      const payload = {
        client_id: draft.client_id,
        month: draft.month,
        monthly_entry_id: draft.monthly_entry_id,
        pending_amount: pending,
        amount_recovered: recovered,
        due_date: draft.due_date || null,
        followup_owner: draft.followup_owner || null,
        status,
        priority: draft.priority,
        communication_channel: (draft.communication_channel || null) as CommunicationChannel | null,
        last_followup_date: draft.last_followup_date || null,
        next_followup_date: draft.next_followup_date || null,
        promise_to_pay_date: draft.promise_to_pay_date || null,
        notes: draft.notes || null,
      };
      if (draft.id) await updateCollectionFollowup(draft.id, payload);
      else await createCollectionFollowup(payload);
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,24,20,.36)", zIndex: 60 }} />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: isNarrow ? "100vw" : 460,
          maxWidth: "100vw",
          background: "var(--ivory)",
          borderLeft: "1px solid var(--border)",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          animation: "fadeUp .25s ease both",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700 }}>
            {draft.id ? "Edit Follow-up" : "Add Follow-up"}
          </div>
          <button className="btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>
          {error && <ErrorBanner message={error} />}
          <div style={{ display: "grid", gap: 12 }}>
            {!fixedClientId && (
              <Field label="Client *" error={validation.client_id}>
                <select style={inputStyle} value={draft.client_id} onChange={(e) => update("client_id", e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.client_name}</option>
                  ))}
                </select>
              </Field>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Month (YYYY-MM) *" error={validation.month}>
                <input
                  type="month"
                  style={inputStyle}
                  value={draft.month}
                  onChange={(e) => update("month", e.target.value)}
                />
              </Field>
              <Field label="Linked Monthly Entry">
                <select
                  style={inputStyle}
                  value={draft.monthly_entry_id ?? ""}
                  onChange={(e) => update("monthly_entry_id", e.target.value || null)}
                  disabled={!entries.length}
                >
                  <option value="">{entries.length ? "Optional…" : "—"}</option>
                  {entries.map((e) => (
                    <option key={e.id} value={e.id}>
                      Pending {e.amount_pending}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Pending Amount *" error={validation.pending_amount}>
                <input
                  type="number"
                  min="0"
                  style={inputStyle}
                  value={draft.pending_amount}
                  onChange={(e) => update("pending_amount", e.target.value)}
                />
              </Field>
              <Field label="Amount Recovered" error={validation.amount_recovered}>
                <input
                  type="number"
                  min="0"
                  style={inputStyle}
                  value={draft.amount_recovered}
                  onChange={(e) => update("amount_recovered", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Due Date">
                <input type="date" style={inputStyle} value={draft.due_date} onChange={(e) => update("due_date", e.target.value)} />
              </Field>
              <Field label="Follow-up Owner">
                <input
                  style={inputStyle}
                  value={draft.followup_owner}
                  onChange={(e) => update("followup_owner", e.target.value)}
                  placeholder="e.g. Priya"
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Status *">
                <select style={inputStyle} value={draft.status} onChange={(e) => update("status", e.target.value as FollowupStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Priority *">
                <select style={inputStyle} value={draft.priority} onChange={(e) => update("priority", e.target.value as FollowupPriority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Communication Channel">
              <select
                style={inputStyle}
                value={draft.communication_channel}
                onChange={(e) => update("communication_channel", e.target.value as any)}
              >
                <option value="">—</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Last Follow-up Date">
                <input type="date" style={inputStyle} value={draft.last_followup_date} onChange={(e) => update("last_followup_date", e.target.value)} />
              </Field>
              <Field label="Next Follow-up Date" error={validation.next_followup_date}>
                <input type="date" style={inputStyle} value={draft.next_followup_date} onChange={(e) => update("next_followup_date", e.target.value)} />
              </Field>
            </div>

            <Field label="Promise to Pay Date">
              <input type="date" style={inputStyle} value={draft.promise_to_pay_date} onChange={(e) => update("promise_to_pay_date", e.target.value)} />
            </Field>

            <Field label="Notes">
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={draft.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button className="btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-sm btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Follow-up"}
          </button>
        </div>
      </aside>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {error && (
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 11,
            color: "var(--red)",
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
