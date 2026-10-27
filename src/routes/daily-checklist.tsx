import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  listTemplates,
  listCompletionsForDate,
  markCompleted,
  todayISO,
  buildChecklist,
  type RecurringDailyTask,
  type RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";
import { awardCompletionPoints } from "@/services/recurringTasks/recurringPointsService";
import {
  recurringStatusOf,
  isCompletionLate,
  summarizeRecurringDay,
  type RecurringStatus,
} from "@/lib/delegation/overdueStatus";

export const Route = createFileRoute("/daily-checklist")({
  component: DailyChecklistPage,
});

function DailyChecklistPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<RecurringDailyTask[]>([]);
  const [completions, setCompletions] = useState<RecurringDailyCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const today = todayISO();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        listTemplates({ activeOnly: true }),
        listCompletionsForDate(today),
      ]);
      setTemplates(t);
      setCompletions(c);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    document.title = "Daily Checklist | GWV Vision Center";
    void refresh();
  }, [refresh]);

  if (!user) return <div style={{ padding: 24 }}>Sign in to view your daily checklist.</div>;

  const items = buildChecklist(templates, completions);
  const now = new Date();
  const summary = summarizeRecurringDay(
    items.map((it) => ({ template: it, completion: it.completion })),
    now,
  );

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ margin: 0 }}>Daily Checklist</h1>
      <p style={{ color: "var(--ink4)", marginTop: 4 }} data-testid="dc-summary">
        {summary.done} of {summary.visible} done today
        {summary.missed > 0 && <> · <span style={{ color: "#be123c", fontWeight: 600 }}>{summary.missed} missed</span></>}
        {summary.pending > 0 && <> · {summary.pending} pending</>}
      </p>
      {err && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{err}</div>}
      {loading ? (
        <div style={{ color: "var(--ink4)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24, color: "var(--ink4)" }}>No recurring daily tasks assigned.</div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {items.map((it) => (
            <ChecklistRow
              key={it.id}
              item={it}
              now={now}
              userId={user.id}
              displayName={user.display_name ?? user.email ?? null}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<RecurringStatus, { bg: string; fg: string; br: string; label: string }> = {
  pending: { bg: "#FEF3C7", fg: "#92400E", br: "#FCD34D", label: "Pending" },
  done:    { bg: "#DCFCE7", fg: "#166534", br: "#86EFAC", label: "Done" },
  missed:  { bg: "#FFE4E6", fg: "#9F1239", br: "#FDA4AF", label: "Missed" },
};

function StatusBadge({ status }: { status: RecurringStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      data-testid="dc-status"
      data-status={status}
      style={{
        display: "inline-block", padding: "3px 9px", borderRadius: 999,
        fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
        background: s.bg, color: s.fg, border: `1px solid ${s.br}`,
      }}
    >
      {s.label}
    </span>
  );
}

function ChecklistRow({
  item, now, userId, displayName, onDone,
}: {
  item: RecurringDailyTask & { completion: RecurringDailyCompletion | null };
  now: Date;
  userId: string;
  displayName: string | null;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const completed = !!item.completion;
  const status = recurringStatusOf(item, item.completion, now);
  const late = completed && isCompletionLate(item, item.completion);

  async function complete() {
    setBusy(true); setErr(null);
    try {
      const completion = await markCompleted({
        template_id: item.id,
        user_id: userId,
        team_member_id: item.task_doer_team_member_id,
        display_name: displayName,
        proof_url: proof || null,
        note: note || null,
      });
      // Award points (RLS allows employee to insert own completion reward).
      // Unique(completion_id) makes this safe against retries.
      let earned: number | null = null;
      let wasLate = false;
      try {
        const entry = await awardCompletionPoints({
          template: item,
          completion,
          userId,
        });
        if (entry) {
          earned = entry.points;
          wasLate = entry.event_type === "recurring_daily_late_completed";
        }
      } catch (pointsErr: any) {
        // Don't break the completion if points fail; surface a soft warning.
        setErr(`Marked done but points not recorded: ${pointsErr.message}`);
      }
      if (earned !== null) {
        setToast(wasLate ? `Completed late · +${earned} points earned` : `+${earned} points earned`);
        setTimeout(() => setToast(null), 4000);
      }
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const bg =
    status === "done" ? "#F0FDF4" :
    status === "missed" ? "#FFF1F2" :
    "var(--parchment)";

  return (
    <div data-testid="dc-row" data-status={status} style={{
      padding: 14,
      border: "1px solid var(--border)",
      borderRadius: 10,
      background: bg,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 600, textDecoration: completed ? "line-through" : "none" }}>{item.title}</div>
            <StatusBadge status={status} />
            {late && (
              <span style={{
                padding: "2px 7px", borderRadius: 999, fontSize: 9.5, fontWeight: 600,
                background: "#FFEDD5", color: "#9A3412", border: "1px solid #FDBA74",
                textTransform: "uppercase", letterSpacing: ".08em",
              }}>Late</span>
            )}
          </div>
          <div style={{ color: "var(--ink4)", fontSize: 12, marginTop: 2 }}>
            {item.due_time ? `Due ${item.due_time.slice(0, 5)}` : "No due time"} · +{item.points_on_completion} pts
            {completed && item.completion?.completed_at && (
              <> · ✓ Completed at {new Date(item.completion.completed_at).toLocaleTimeString()}</>
            )}
          </div>
        </div>
        {completed ? (
          <span style={{ color: "#16A34A", fontWeight: 600 }}>Done</span>
        ) : (
          <>
            <button className="btn-sm" onClick={() => setExpanded((x) => !x)}>
              {expanded ? "Hide" : "+ Proof"}
            </button>
            <button
              className="btn-sm"
              data-testid="dc-mark-done"
              onClick={complete}
              disabled={busy}
              style={{ background: "var(--ink)", color: "var(--ivory)" }}
              title={status === "missed" ? "Late completion — will be flagged" : undefined}
            >
              {busy ? "…" : status === "missed" ? "Mark Done (Late)" : "Mark Done"}
            </button>
          </>
        )}
      </div>
      {!completed && expanded && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <input placeholder="Proof URL (optional)" value={proof} onChange={(e) => setProof(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }} />
          <textarea placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, minHeight: 50 }} />
        </div>
      )}
      {toast && (
        <div data-testid="dc-points-toast" style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 12,
          background: "#ECFDF5", color: "#065F46", border: "1px solid #6EE7B7", fontWeight: 600,
        }}>{toast}</div>
      )}
      {err && <div style={{ color: "#b91c1c", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
