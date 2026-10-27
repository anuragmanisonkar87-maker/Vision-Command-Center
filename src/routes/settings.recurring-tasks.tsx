import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import {
  listTemplates,
  listCompletionsForDate,
  createTemplate,
  updateTemplate,
  setTemplateActive,
  deleteTemplate,
  todayISO,
  type RecurringDailyTask,
  type RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";
import { listTaskDoers, type TaskDoer } from "@/services/delegation/taskDoers";
import { recurringStatusOf, summarizeRecurringDay } from "@/lib/delegation/overdueStatus";
import {
  applyMissedPenaltiesForDate,
  listRecentLedgerEntries,
  type RecurringDailyPointsEntry,
} from "@/services/recurringTasks/recurringPointsService";
import {
  sendMissedTaskEmail,
  listRecentEmailLogs,
  hasEmailProvider,
  DEFAULT_MISSED_SUBJECT,
  defaultMissedBody,
  type RecurringDailyEmailLog,
} from "@/services/recurringTasks/recurringEmailService";

export const Route = createFileRoute("/settings/recurring-tasks")({
  component: RecurringTasksAdminPage,
});

function RecurringTasksAdminPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [templates, setTemplates] = useState<RecurringDailyTask[]>([]);
  const [completions, setCompletions] = useState<RecurringDailyCompletion[]>([]);
  const [doers, setDoers] = useState<TaskDoer[]>([]);
  const [ledger, setLedger] = useState<RecurringDailyPointsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [penaltyMsg, setPenaltyMsg] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<RecurringDailyEmailLog[]>([]);
  const today = todayISO();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, d, c, l, em] = await Promise.all([
        listTemplates(),
        listTaskDoers(),
        listCompletionsForDate(today),
        listRecentLedgerEntries(25).catch(() => []),
        listRecentEmailLogs(25).catch(() => []),
      ]);
      setTemplates(t);
      setDoers(d);
      setCompletions(c);
      setLedger(l);
      setEmailLogs(em);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [today]);

  async function runApplyMissed() {
    if (!user) return;
    setPenaltyBusy(true);
    setPenaltyMsg(null);
    try {
      const r = await applyMissedPenaltiesForDate({ adminUserId: user.id });
      const parts = [
        `${r.appliedCount} applied`,
        `${r.skippedDuplicateCount} already recorded`,
        `${r.noMissedCount} not missed`,
      ];
      if (r.errors.length) parts.push(`${r.errors.length} error(s)`);
      setPenaltyMsg(parts.join(" · "));
      await refresh();
    } catch (e: any) {
      setPenaltyMsg(`Error: ${e.message}`);
    } finally {
      setPenaltyBusy(false);
    }
  }

  useEffect(() => {
    document.title = "Recurring Daily Tasks | Settings";
    void refresh();
  }, [refresh]);

  const completionByTpl = useMemo(() => {
    const m = new Map<string, RecurringDailyCompletion>();
    for (const c of completions) m.set(c.template_id, c);
    return m;
  }, [completions]);

  const summary = useMemo(
    () => summarizeRecurringDay(
      templates.map((t) => ({ template: t, completion: completionByTpl.get(t.id) ?? null })),
      new Date(),
    ),
    [templates, completionByTpl],
  );

  if (!user) return null;
  if (!admin) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Recurring Daily Tasks</h1>
        <p style={{ color: "var(--ink4)" }}>Admins only.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Recurring Daily Tasks</h1>
          <p style={{ color: "var(--ink4)", marginTop: 4 }}>Daily checklist templates assigned to employees.</p>
        </div>
        <button className="btn-sm" onClick={() => setShowNew(true)} style={{ background: "var(--ink)", color: "var(--ivory)" }}>
          + New Template
        </button>
      </div>

      {!loading && templates.length > 0 && (
        <div data-testid="rt-summary" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <SummaryPill label="Visible today" value={summary.visible} />
          <SummaryPill label="Done" value={summary.done} tone="good" />
          <SummaryPill label="Pending" value={summary.pending} tone={summary.pending > 0 ? "warn" : undefined} />
          <SummaryPill label="Missed" value={summary.missed} tone={summary.missed > 0 ? "bad" : undefined} />
        </div>
      )}

      {!loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button
            className="btn-sm"
            data-testid="rt-apply-missed"
            onClick={runApplyMissed}
            disabled={penaltyBusy}
            style={{ background: "var(--ink)", color: "var(--ivory)" }}
          >
            {penaltyBusy ? "Applying…" : "Apply Today's Missed Penalties"}
          </button>
          {penaltyMsg && (
            <span data-testid="rt-apply-missed-result" style={{ fontSize: 12, color: "var(--ink3)" }}>{penaltyMsg}</span>
          )}
        </div>
      )}


      {err && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{err}</div>}
      {loading ? (
        <div style={{ color: "var(--ink4)" }}>Loading…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Title</th>
              <th style={th}>Task Doer</th>
              <th style={th}>Due Time</th>
              <th style={th}>Today</th>
              <th style={th}>+ Pts</th>
              <th style={th}>- Pts</th>
              <th style={th}>Active</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, color: "var(--ink4)" }}>No templates yet.</td></tr>
            )}
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                row={t}
                doers={doers}
                completion={completionByTpl.get(t.id) ?? null}
                onChange={refresh}
                adminUserId={user.id}
              />
            ))}
          </tbody>
        </table>
      )}

      {!loading && (
        <LedgerPanel entries={ledger} templates={templates} />
      )}

      {!loading && (
        <EmailLogPanel entries={emailLogs} templates={templates} />
      )}

      {showNew && (
        <NewTemplateDialog
          doers={doers}
          createdBy={user.id}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void refresh(); }}
        />
      )}
    </div>
  );
}

function LedgerPanel({ entries, templates }: {
  entries: RecurringDailyPointsEntry[];
  templates: RecurringDailyTask[];
}) {
  const titleByTpl = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) m.set(t.id, t.title);
    return m;
  }, [templates]);
  return (
    <div style={{ marginTop: 32 }} data-testid="rt-ledger">
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Recurring Points Ledger</h2>
      <p style={{ color: "var(--ink4)", fontSize: 12, marginTop: 0 }}>Latest {entries.length} entries.</p>
      {entries.length === 0 ? (
        <div style={{ color: "var(--ink4)", fontSize: 13 }}>No entries yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Date</th>
              <th style={th}>Task</th>
              <th style={th}>Event</th>
              <th style={th}>Points</th>
              <th style={th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={td}>{e.points_date}</td>
                <td style={td}>{titleByTpl.get(e.template_id) ?? e.template_id.slice(0, 8)}</td>
                <td style={td}>{e.event_type.replace("recurring_daily_", "")}</td>
                <td style={{ ...td, fontWeight: 600, color: e.points >= 0 ? "#166534" : "#9F1239" }}>
                  {e.points >= 0 ? `+${e.points}` : e.points}
                </td>
                <td style={td}>{e.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink4)" };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid var(--border)" };

function TemplateRow({ row, doers: _doers, completion, onChange, adminUserId }: {
  row: RecurringDailyTask;
  doers: TaskDoer[];
  completion: RecurringDailyCompletion | null;
  onChange: () => void;
  adminUserId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [dueTime, setDueTime] = useState(row.due_time?.slice(0, 5) ?? "");
  const [showEmail, setShowEmail] = useState(false);
  const status = recurringStatusOf(row, completion, new Date());
  const canEmail = status === "missed" && row.active && !!row.task_doer_user_id;

  async function save() {
    await updateTemplate(row.id, { title: title.trim(), due_time: dueTime ? `${dueTime}:00` : null });
    setEditing(false);
    onChange();
  }

  return (
    <tr data-testid="rt-row" data-status={status}>
      <td style={td}>
        {editing ? (
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
        ) : (
          <div style={{ fontWeight: 500 }}>{row.title}</div>
        )}
        {row.description && !editing && <div style={{ color: "var(--ink4)", fontSize: 12 }}>{row.description}</div>}
      </td>
      <td style={td}>{row.task_doer_name}</td>
      <td style={td}>
        {editing ? (
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={{ ...input, width: 110 }} />
        ) : (
          row.due_time?.slice(0, 5) ?? "—"
        )}
      </td>
      <td style={td}>
        <StatusPill status={status} />
      </td>
      <td style={td}>+{row.points_on_completion}</td>
      <td style={td}>{row.negative_points_if_missed}</td>
      <td style={td}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={row.active}
            onChange={async (e) => { await setTemplateActive(row.id, e.target.checked); onChange(); }}
          />
          {row.active ? "Active" : "Inactive"}
        </label>
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        {editing ? (
          <>
            <button className="btn-sm" onClick={save}>Save</button>{" "}
            <button className="btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            {canEmail && (
              <>
                <button
                  className="btn-sm"
                  data-testid="rt-send-missed-email"
                  onClick={() => setShowEmail(true)}
                  style={{ background: "#9F1239", color: "#fff" }}
                >
                  Send Missed Email
                </button>{" "}
              </>
            )}
            <button className="btn-sm" onClick={() => setEditing(true)}>Edit</button>{" "}
            <button
              className="btn-sm"
              onClick={async () => {
                if (!confirm("Archive this template? It will be deleted.")) return;
                await deleteTemplate(row.id);
                onChange();
              }}
              style={{ color: "#b91c1c" }}
            >
              Archive
            </button>
          </>
        )}
      </td>
      {showEmail && (
        <MissedEmailModal
          template={row}
          adminUserId={adminUserId}
          onClose={() => setShowEmail(false)}
          onSent={() => { setShowEmail(false); onChange(); }}
        />
      )}
    </tr>
  );
}

const input: React.CSSProperties = { padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--parchment)" };

type Tone = "good" | "warn" | "bad" | undefined;
const TONE: Record<Exclude<Tone, undefined>, { bg: string; fg: string; br: string }> = {
  good: { bg: "#DCFCE7", fg: "#166534", br: "#86EFAC" },
  warn: { bg: "#FEF3C7", fg: "#92400E", br: "#FCD34D" },
  bad:  { bg: "#FFE4E6", fg: "#9F1239", br: "#FDA4AF" },
};

function SummaryPill({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  const t = tone ? TONE[tone] : { bg: "var(--parchment)", fg: "var(--ink3)", br: "var(--border)" };
  return (
    <div style={{
      padding: "8px 12px", borderRadius: 8, background: t.bg, color: t.fg,
      border: `1px solid ${t.br}`, fontSize: 12, display: "flex", gap: 8, alignItems: "baseline",
    }}>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{value}</span>
      <span style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 10 }}>{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "done" | "missed" }) {
  const map = {
    pending: TONE.warn,
    done: TONE.good,
    missed: TONE.bad,
  } as const;
  const t = map[status];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: ".08em",
      background: t.bg, color: t.fg, border: `1px solid ${t.br}`,
    }}>{status}</span>
  );
}


function NewTemplateDialog({
  doers, createdBy, onClose, onCreated,
}: { doers: TaskDoer[]; createdBy: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [doerId, setDoerId] = useState<string>("");
  const [dueTime, setDueTime] = useState("");
  const [posPts, setPosPts] = useState(2);
  const [negPts, setNegPts] = useState(-2);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const doer = doers.find((d) => d.id === doerId);
    if (!title.trim() || !doer) { setErr("Title and Task Doer are required."); return; }
    setSaving(true);
    try {
      await createTemplate({
        title,
        description: description || null,
        task_doer_team_member_id: doer.id,
        task_doer_user_id: doer.linked_user_id,
        task_doer_name: doer.name,
        task_doer_email: doer.email,
        due_time: dueTime ? `${dueTime}:00` : null,
        points_on_completion: posPts,
        negative_points_if_missed: negPts,
        active: true,
        created_by: createdBy,
      });
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 999 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--parchment)", padding: 24, borderRadius: 12, width: 480, maxWidth: "95vw" }}>
        <h3 style={{ marginTop: 0 }}>New Recurring Daily Task</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} style={input} /></label>
          <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...input, minHeight: 60 }} /></label>
          <label>Task Doer
            <select value={doerId} onChange={(e) => setDoerId(e.target.value)} style={input}>
              <option value="">— select —</option>
              {doers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label>Due Time<input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={input} /></label>
            <label>+ Points<input type="number" value={posPts} onChange={(e) => setPosPts(parseInt(e.target.value) || 0)} style={input} /></label>
            <label>− Points<input type="number" value={negPts} onChange={(e) => setNegPts(parseInt(e.target.value) || 0)} style={input} /></label>
          </div>
        </div>
        {err && <div style={{ color: "#b91c1c", marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-sm" onClick={save} disabled={saving} style={{ background: "var(--ink)", color: "var(--ivory)" }}>
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailLogPanel({ entries, templates }: {
  entries: RecurringDailyEmailLog[];
  templates: RecurringDailyTask[];
}) {
  const titleByTpl = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) m.set(t.id, t.title);
    return m;
  }, [templates]);
  return (
    <div style={{ marginTop: 32 }} data-testid="rt-email-logs">
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Missed Task Email Logs</h2>
      <p style={{ color: "var(--ink4)", fontSize: 12, marginTop: 0 }}>
        Latest {entries.length} entries. Email provider: {hasEmailProvider() ? "configured" : "not configured (drafts only)"}.
      </p>
      {entries.length === 0 ? (
        <div style={{ color: "var(--ink4)", fontSize: 13 }}>No email logs yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Date</th>
              <th style={th}>To</th>
              <th style={th}>Task</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <th style={th}>Sent At</th>
              <th style={th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} data-testid="rt-email-log-row" data-status={e.email_status}>
                <td style={td}>{e.points_date}</td>
                <td style={td}>{e.email_to}</td>
                <td style={td}>{titleByTpl.get(e.template_id) ?? e.template_id.slice(0, 8)}</td>
                <td style={td}>{e.email_type}</td>
                <td style={{ ...td, fontWeight: 600,
                  color: e.email_status === "sent" ? "#166534"
                    : e.email_status === "failed" ? "#9F1239" : "var(--ink3)" }}>
                  {e.email_status}
                </td>
                <td style={td}>{e.sent_at ? new Date(e.sent_at).toLocaleString() : "—"}</td>
                <td style={td}>{e.error_message ?? (e.email_status === "draft" ? "draft saved" : "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MissedEmailModal({ template, adminUserId, onClose, onSent }: {
  template: RecurringDailyTask;
  adminUserId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const employeeName = template.task_doer_name;
  const [recipient, setRecipient] = useState(template.task_doer_email ?? "");
  const [subject, setSubject] = useState(DEFAULT_MISSED_SUBJECT);
  const [body, setBody] = useState(defaultMissedBody(employeeName, template.title));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayISO();

  async function submit() {
    if (!recipient.trim()) { setMsg("Recipient email required."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await sendMissedTaskEmail({
        template,
        recipientEmail: recipient.trim(),
        subject: subject.trim(),
        body: body.trim(),
        pointsDate: today,
        adminUserId,
      });
      if (r.status === "draft") setMsg(r.reason);
      else if (r.status === "sent") { setMsg("Email sent."); setTimeout(onSent, 700); return; }
      else if (r.status === "duplicate") setMsg(r.reason);
      else setMsg(`Failed: ${r.error}`);
      setTimeout(onSent, 1200);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <td colSpan={8} style={{ padding: 0 }}>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 999 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="rt-missed-email-modal"
          style={{ background: "var(--parchment)", padding: 24, borderRadius: 12, width: 560, maxWidth: "95vw" }}
        >
          <h3 style={{ marginTop: 0 }}>Send Missed Task Email</h3>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 12 }}>
            <div><strong>Employee:</strong> {employeeName}</div>
            <div><strong>Task:</strong> {template.title}</div>
            <div><strong>Due:</strong> {template.due_time?.slice(0, 5) ?? "—"}</div>
            <div><strong>Penalty:</strong> {template.negative_points_if_missed} pts (if applied)</div>
            <div style={{ marginTop: 6, color: hasEmailProvider() ? "#166534" : "#92400E" }}>
              {hasEmailProvider() ? "Email provider configured." : "Email provider not configured — will save as draft."}
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <label>To<input value={recipient} onChange={(e) => setRecipient(e.target.value)} style={input} /></label>
            <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} style={input} /></label>
            <label>Body<textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ ...input, minHeight: 120 }} /></label>
          </div>
          {msg && <div data-testid="rt-missed-email-msg" style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn-sm"
              data-testid="rt-missed-email-confirm"
              onClick={submit}
              disabled={busy}
              style={{ background: "var(--ink)", color: "var(--ivory)" }}
            >
              {busy ? "Working…" : hasEmailProvider() ? "Send" : "Save Draft"}
            </button>
          </div>
        </div>
      </div>
    </td>
  );
}
