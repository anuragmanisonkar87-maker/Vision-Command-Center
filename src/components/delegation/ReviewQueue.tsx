// Compact admin/manager review queue for the Delegation Command Center.
// Lists Submitted + Revision Required tasks and pending due-date requests
// with inline approve / revision / reject actions.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, X, ExternalLink, Calendar } from "lucide-react";
import {
  approveCompletion,
  approveDueDateRequest,
  listAllTasks,
  listDueDateRequests,
  markRevision,
  rejectDueDateRequest,
  type DelegationTask,
  type DueDateRequest,
} from "@/services/delegation/delegationService";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import { TASK_TYPE_SHORT, badgeClassOfTaskType, labelOfTaskType } from "@/lib/delegation/taskType";
import { isDelegationOverdue } from "@/lib/delegation/overdueStatus";

interface Props {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewQueue({ userId, onClose, onChanged }: Props) {
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [requests, setRequests] = useState<DueDateRequest[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [all, reqs, u] = await Promise.all([
        listAllTasks({}),
        listDueDateRequests({ status: "pending" }),
        listAllUsersWithRoles(),
      ]);
      setTasks(all.filter((t) => t.system_stage === "submitted" || t.system_stage === "revision"));
      setRequests(reqs);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.display_name ?? id.slice(0, 8) : "—");

  const approve = async (taskId: string, assigneeId: string | null) => {
    if (assigneeId && assigneeId === userId) { alert("You cannot approve your own task."); return; }

    setBusy(taskId);
    try { await approveCompletion(taskId, userId); await reload(); onChanged(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  };

  const requestRev = async (taskId: string) => {
    const note = window.prompt("Revision note (required):");
    if (!note || !note.trim()) { alert("A revision note is required."); return; }
    setBusy(taskId);
    try { await markRevision(taskId, userId, note.trim()); await reload(); onChanged(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  };

  const approveReq = async (req: DueDateRequest) => {
    setBusy(req.id);
    try { await approveDueDateRequest(req.id, userId); await reload(); onChanged(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  };
  const rejectReq = async (req: DueDateRequest) => {
    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
    setBusy(req.id);
    try { await rejectDueDateRequest(req.id, userId, note?.trim() || undefined); await reload(); onChanged(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[110] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#F7F6F3] h-full overflow-y-auto border-l border-[#E8E5DE]"
        onClick={(e) => e.stopPropagation()}
        data-testid="dg-review-queue"
      >
        <div className="p-5 border-b border-[#E8E5DE] flex items-center justify-between bg-white">
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-900">Review queue</h2>
            <p className="text-xs text-stone-500">Submitted tasks and pending due-date requests.</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-2">Tasks awaiting review ({tasks.length})</div>
            {loading ? (
              <div className="text-sm text-stone-500">Loading…</div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-stone-500 bg-white border border-[#E8E5DE] rounded-lg p-3">Nothing pending.</div>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="bg-white border border-[#E8E5DE] rounded-lg p-3" data-testid="dg-review-task" data-task-id={t.id} data-task-title={t.title}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-900 truncate flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${badgeClassOfTaskType((t as any).task_type)} flex-shrink-0`}
                            data-testid="rq-tasktype"
                            title={labelOfTaskType((t as any).task_type)}
                          >
                            {TASK_TYPE_SHORT[(((t as any).task_type ?? "standup") as "recurring_daily" | "standup" | "ad_hoc")]}
                          </span>
                          <span className="truncate">{t.title}</span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {nameOf(t.assignee_id)} · {t.system_stage === "revision" ? "Revision required" : "Submitted"}
                          {t.due_date && <> · due {t.due_date}</>}
                          {isDelegationOverdue({ due_date: t.due_date, system_stage: t.system_stage, is_deleted: t.is_deleted }) && (
                            <span
                              data-testid="rq-overdue"
                              className="ml-1.5 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200"
                            >
                              Overdue
                            </span>
                          )}
                          {t.updated_at && <> · {fmt(t.updated_at)}</>}
                        </div>
                        {t.proof_url && (
                          <a href={t.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#7A5E10] hover:underline mt-1">
                            <ExternalLink className="w-3 h-3" /> proof
                          </a>
                        )}
                        {t.proof_note && <div className="text-[11px] text-stone-600 mt-1 italic">{t.proof_note}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          disabled={busy === t.id || t.assignee_id === userId}
                          onClick={() => approve(t.id, t.assignee_id)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                          data-testid="dg-review-approve"
                          title={t.assignee_id === userId ? "Cannot approve your own task" : "Approve"}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          disabled={busy === t.id}
                          onClick={() => requestRev(t.id)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                          data-testid="dg-review-revision"
                        >
                          <RotateCcw className="w-3 h-3" /> Revision
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-2">Due-date change requests ({requests.length})</div>
            {loading ? (
              <div className="text-sm text-stone-500">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="text-sm text-stone-500 bg-white border border-[#E8E5DE] rounded-lg p-3">No pending requests.</div>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="bg-white border border-[#E8E5DE] rounded-lg p-3" data-testid="dg-review-ddr">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-stone-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-stone-500" />
                          {r.current_due_date ?? "—"} → <strong>{r.requested_due_date}</strong>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          by {nameOf(r.requested_by)} · {fmt(r.created_at)}
                        </div>
                        {r.delay_reason && <div className="text-[11px] text-stone-700 mt-1">Reason: {r.delay_reason}</div>}
                        {r.note && <div className="text-[11px] text-stone-600 italic mt-0.5">{r.note}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          disabled={busy === r.id}
                          onClick={() => approveReq(r)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                          data-testid="dg-ddr-approve"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          disabled={busy === r.id}
                          onClick={() => rejectReq(r)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200 disabled:opacity-50"
                          data-testid="dg-ddr-reject"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
