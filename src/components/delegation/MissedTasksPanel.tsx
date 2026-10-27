// Phase 3D + 3E — admin panel: scan missed stand-up/ad hoc tasks, apply penalties,
// open editable email draft modal, send the draft via Resend with admin confirmation.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllTasks, type DelegationTask } from "@/services/delegation/delegationService";
import {
  applyMissedTaskPenalties,
  listMissedTaskLedger,
  listMissedTaskEmails,
  getConfiguredMissedTaskPenalty,
  setConfiguredMissedTaskPenalty,
  type MissedTaskPointsEntry,
  type MissedTaskEmailLog,
} from "@/services/delegation/missedTaskService";
import {
  isStandupOrAdHocMissed,
  missedTaskBadge,
  formatDueWhen,
  DEFAULT_MISSED_TASK_PENALTY,
} from "@/lib/delegation/missedTask";
import MissedTaskEmailDraftModal from "./MissedTaskEmailDraftModal";
import SendMissedEmailModal from "./SendMissedEmailModal";
import { getEmailProviderStatus } from "@/lib/delegation/missedEmailSender.functions";

type Props = { userId: string; isAdmin: boolean };

export default function MissedTasksPanel({ userId, isAdmin }: Props) {
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [ledger, setLedger] = useState<MissedTaskPointsEntry[]>([]);
  const [emails, setEmails] = useState<MissedTaskEmailLog[]>([]);
  const [penalty, setPenalty] = useState<number>(DEFAULT_MISSED_TASK_PENALTY);
  const [penaltyInput, setPenaltyInput] = useState<string>(String(DEFAULT_MISSED_TASK_PENALTY));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<DelegationTask | null>(null);
  const [sendLog, setSendLog] = useState<MissedTaskEmailLog | null>(null);
  const [providerConfigured, setProviderConfigured] = useState<boolean>(false);
  const providerStatusFn = useServerFn(getEmailProviderStatus);

  const refresh = async () => {
    const [t, l, e, p] = await Promise.all([
      listAllTasks({}).catch(() => []),
      listMissedTaskLedger({ userId: isAdmin ? undefined : userId, limit: 100 }).catch(() => []),
      isAdmin
        ? listMissedTaskEmails({ limit: 50 }).catch(() => [])
        : listMissedTaskEmails({ userId, limit: 50 }).catch(() => []),
      getConfiguredMissedTaskPenalty().catch(() => DEFAULT_MISSED_TASK_PENALTY),
    ]);
    setTasks(t);
    setLedger(l);
    setEmails(e);
    setPenalty(p);
    setPenaltyInput(String(p));
  };

  useEffect(() => {
    refresh();
    if (isAdmin) {
      providerStatusFn()
        .then((r: any) => setProviderConfigured(!!r?.configured))
        .catch(() => setProviderConfigured(false));
    }
  }, [isAdmin]);

  const visibleTasks = (isAdmin ? tasks : tasks.filter((t) => t.assignee_id === userId))
    .filter((t) => isStandupOrAdHocMissed(t as any, new Date()));

  const penalizedTaskIds = new Set(ledger.map((l) => l.task_id));
  const draftedTaskIds = new Set(emails.map((e) => e.task_id));

  const handleApply = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await applyMissedTaskPenalties({ adminUserId: userId, tasks, configuredPenalty: penalty });
      setMsg(`Penalties applied: ${r.appliedCount} · Already recorded: ${r.skippedDuplicateCount} · No missed: ${r.noMissedCount}${r.errors.length ? ` · Errors: ${r.errors.length}` : ""}`);
      await refresh();
    } catch (e: any) {
      setMsg(`Failed: ${e.message}`);
    } finally { setBusy(false); }
  };

  const handleSavePenalty = async () => {
    setBusy(true); setMsg(null);
    try {
      const n = Number(penaltyInput);
      if (!Number.isFinite(n)) { setMsg("Penalty must be a number."); return; }
      await setConfiguredMissedTaskPenalty(n);
      setPenalty(n);
      setMsg(`Penalty points updated to ${n}.`);
    } catch (e: any) {
      setMsg(`Failed: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-[#E8E5DE] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">Discipline</div>
          <div className="text-lg font-semibold text-stone-800">Missed Stand-up & Ad Hoc Tasks</div>
          <div className="text-xs text-stone-500 mt-1">
            {isAdmin
              ? providerConfigured
                ? "Admin-only actions. Real emails will be sent via Resend after you confirm."
                : "Admin-only actions. Email provider is not configured — drafts can be saved but Send is disabled."
              : "Your missed-task penalties and email drafts (read-only)."}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <span className="uppercase tracking-[0.08em] text-stone-500">Penalty</span>
              <input
                type="number"
                value={penaltyInput}
                onChange={(e) => setPenaltyInput(e.target.value)}
                data-testid="missed-penalty-input"
                className="w-20 px-2 py-1 border border-stone-300 rounded text-xs"
              />
              <button
                onClick={handleSavePenalty}
                disabled={busy}
                data-testid="missed-penalty-save"
                className="px-2 py-1 rounded border border-stone-300 text-xs hover:bg-stone-50 disabled:opacity-60"
              >
                Save
              </button>
            </label>
            <button
              onClick={handleApply}
              disabled={busy}
              data-testid="apply-missed-penalties"
              className="px-3 py-2 rounded-md bg-stone-900 text-white text-xs font-semibold disabled:opacity-60"
            >
              {busy ? "Working…" : "Apply Missed Task Penalties"}
            </button>
          </div>
        )}
      </div>

      {msg && <div className="text-xs text-stone-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-stone-500 border-b border-[#EFEAE0]">
              <th className="py-2 pr-3">Task</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Employee</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Penalty</th>
              <th className="py-2 pr-3">Email</th>
              {isAdmin && <th className="py-2 pr-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {visibleTasks.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="py-4 text-stone-500 italic text-xs">No missed stand-up / ad hoc tasks.</td></tr>
            )}
            {visibleTasks.map((t) => {
              const badge = missedTaskBadge(t as any, new Date());
              const latestEmail = emails.find((e) => e.task_id === t.id) ?? null;
              return (
                <tr key={t.id} className="border-b border-[#F3EFE6]">
                  <td className="py-2 pr-3">{t.title}</td>
                  <td className="py-2 pr-3 text-stone-600">{t.task_type === "ad_hoc" ? "Ad Hoc" : "Stand-up"}</td>
                  <td className="py-2 pr-3 text-stone-600">{t.assignee_name ?? "—"}</td>
                  <td className="py-2 pr-3 text-stone-600" data-testid="missed-row-due">
                    {formatDueWhen(t.due_date, t.due_time ?? null)}
                  </td>
                  <td className="py-2 pr-3"><Badge tone={badge === "missed" ? "bad" : "warn"}>{badge ?? "—"}</Badge></td>
                  <td className="py-2 pr-3">
                    {penalizedTaskIds.has(t.id)
                      ? <Badge tone="bad">{penalty} applied</Badge>
                      : <span className="text-xs text-stone-400">pending ({penalty})</span>}
                  </td>
                  <td className="py-2 pr-3" data-testid="missed-row-email-status">
                    <EmailStatusCell log={latestEmail} />
                  </td>
                  {isAdmin && (
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setModalTask(t)}
                          disabled={busy}
                          data-testid="open-draft-email-modal"
                          className="px-2 py-1 rounded border border-stone-300 text-xs hover:bg-stone-50 disabled:opacity-60"
                        >
                          {latestEmail ? "Edit Draft" : "Draft Email"}
                        </button>
                        {latestEmail && (latestEmail.email_status === "draft" || latestEmail.email_status === "failed") && (
                          <button
                            onClick={() => setSendLog(latestEmail)}
                            disabled={busy || !providerConfigured}
                            title={!providerConfigured ? "Email provider not configured" : ""}
                            data-testid={latestEmail.email_status === "failed" ? "retry-missed-email" : "send-missed-email"}
                            className="px-2 py-1 rounded text-white text-xs font-semibold disabled:opacity-60"
                            style={{ background: providerConfigured ? "#0f766e" : "#a8a29e" }}
                          >
                            {latestEmail.email_status === "failed" ? "Retry" : "Send"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalTask && (
        <MissedTaskEmailDraftModal
          open={!!modalTask}
          task={modalTask}
          adminUserId={userId}
          penaltyPoints={penalty}
          penaltyApplied={penalizedTaskIds.has(modalTask.id)}
          onClose={() => setModalTask(null)}
          onSaved={() => { refresh(); }}
        />
      )}
      {sendLog && isAdmin && (
        <SendMissedEmailModal
          open={!!sendLog}
          log={sendLog}
          providerConfigured={providerConfigured}
          onClose={() => setSendLog(null)}
          onSent={() => { refresh(); }}
        />
      )}
    </div>
  );
}

function EmailStatusCell({ log }: { log: MissedTaskEmailLog | null }) {
  if (!log) return <span className="text-xs text-stone-400">—</span>;
  if (log.email_status === "sent") {
    const when = log.sent_at ? new Date(log.sent_at).toLocaleString() : "";
    return (
      <span title={when}>
        <Badge tone="ok">Sent</Badge>
        {when && <span className="ml-1 text-[10px] text-stone-500">{when}</span>}
      </span>
    );
  }
  if (log.email_status === "failed") {
    return (
      <span title={log.error_message ?? ""}>
        <Badge tone="bad">Failed</Badge>
      </span>
    );
  }
  return <Badge tone="warn">Draft</Badge>;
}

function Badge({ tone, children }: { tone: "bad" | "warn" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "bad" ? "bg-red-50 text-red-700 border-red-200"
    : tone === "warn" ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`inline-block text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>;
}
