// Employee-facing My Tasks card view.
// - Employee: sees only their own assigned tasks (assignee_id = self).
// - Admin preview: pick a team member; sees that employee's tasks read-only
//   (with Submit-for-Review disabled — admin actions belong in Review Queue).
//
// Submit-for-Review uses the existing approval workflow (no direct complete,
// no points until admin approves).

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, ExternalLink, FileText, Loader2, PlayCircle, Send, ShieldCheck, UserRound,
} from "lucide-react";
import {
  listMyTasks,
  listAllTasks,
  submitForReview,
  updateTaskFields,
  type DelegationTask,
  type Priority,
} from "@/services/delegation/delegationService";
import { listTaskDoers, resolveTaskDoerName, type TaskDoer } from "@/services/delegation/taskDoers";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import TaskDoerPicker from "./TaskDoerPicker";
import { Link } from "@tanstack/react-router";
import { TASK_TYPE_SHORT, badgeClassOfTaskType, labelOfTaskType } from "@/lib/delegation/taskType";
import { isDelegationOverdue } from "@/lib/delegation/overdueStatus";
import {
  listTemplates,
  listCompletionsForDate,
  buildChecklist,
  todayISO,
} from "@/services/recurringTasks/recurringTasksService";

interface Props {
  userId: string;          // the currently signed-in user
  isAdmin: boolean;        // admin = unlock preview selector
}

const priorityClass = (p: Priority) =>
  p === "critical"
    ? "bg-red-50 text-red-700 border-red-200"
    : p === "high"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : p === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-stone-50 text-stone-600 border-stone-200";

const stageClass = (s: string) =>
  s === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : s === "revision"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : s === "blocked"
        ? "bg-zinc-100 text-zinc-700 border-zinc-200"
        : s === "in_progress" || s === "submitted"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-stone-100 text-stone-700 border-stone-200";

export default function MyTasksView({ userId, isAdmin }: Props) {
  const [doers, setDoers] = useState<TaskDoer[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  // admin preview: team-member id of the employee we're previewing (or "" = self)
  const [previewDoerId, setPreviewDoerId] = useState<string>("");
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // resolve the user id we should fetch tasks for
  const targetUserId = useMemo(() => {
    if (!isAdmin || !previewDoerId) return userId;
    const d = doers.find((x) => x.id === previewDoerId);
    return d?.linked_user_id ?? null; // null = no linked auth user
  }, [isAdmin, previewDoerId, doers, userId]);

  const previewDoer = doers.find((d) => d.id === previewDoerId) ?? null;
  const isPreviewing = isAdmin && !!previewDoerId;

  useEffect(() => {
    Promise.all([listTaskDoers(), listAllUsersWithRoles().catch(() => [])])
      .then(([d, u]) => { setDoers(d); setUsers(u as AdminUserRow[]); })
      .catch(() => { /* picker just shows empty */ });
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPreviewing) {
        if (!targetUserId) {
          // team member has no auth account → no personal task list
          setTasks([]);
        } else {
          // admin RLS permits listAllTasks; filter by assignee
          setTasks(await listAllTasks({ user_id: targetUserId }));
        }
      } else {
        // Employee path: listMyTasks ORs assignee_id + created_by; filter to only assignee
        const all = await listMyTasks(userId);
        setTasks(all.filter((t) => t.assignee_id === userId));
      }
    } catch (e) {
      setError((e as Error).message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [targetUserId, isPreviewing]);

  const reload = () => { void load(); };

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-stone-900"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500 }}
          >
            {isPreviewing ? `Previewing: ${previewDoer?.name ?? "Employee"}` : "My Tasks"}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isPreviewing
              ? "Read-only preview of what this employee sees."
              : "Your assigned work — submit for review when done."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2" style={{ minWidth: 280 }}>
            <UserRound className="w-4 h-4 text-stone-500 flex-shrink-0" />
            <div className="flex-1">
              <TaskDoerPicker
                value={previewDoerId}
                doers={doers}
                placeholder="Preview My Tasks as employee…"
                size="md"
                testId="mytasks-preview-picker"
                onChange={(id) => setPreviewDoerId(id === previewDoerId ? "" : id)}
              />
            </div>
            {previewDoerId && (
              <button
                onClick={() => setPreviewDoerId("")}
                className="text-xs px-2.5 py-1.5 rounded border border-[#E8E2D2] bg-white text-stone-600 hover:bg-[#F7F4EA]"
              >
                Exit preview
              </button>
            )}
          </div>
        )}
      </div>

      {/* Banners */}
      {isPreviewing && (
        <div className="flex items-center gap-2 rounded-lg border border-[#E8D49A] bg-[#FBF6E9] px-4 py-2.5 text-[12.5px] text-[#7A5E10]">
          <ShieldCheck className="w-4 h-4" />
          <span>
            Read-only preview. To act on these tasks, use the Team Grid or Review Queue.
          </span>
        </div>
      )}

      {!isPreviewing && <DailyChecklistSummaryCard />}



      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading tasks…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <p
            className="text-stone-700"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}
          >
            {isPreviewing
              ? `${previewDoer?.name ?? "This employee"} has no tasks assigned yet.`
              : "You have no tasks assigned yet."}
          </p>
          <p className="text-xs text-stone-500 mt-2">
            {isPreviewing
              ? "Their card view will populate as soon as a task is assigned."
              : "New tasks from your manager will show up here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              actorId={userId}
              doers={doers}
              users={users}
              readOnly={isPreviewing}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <div className="text-[11px] text-stone-400 pt-1">
        Email notifications not implemented yet — employees see new tasks here on next login.
      </div>
    </div>
  );
}

/* ─────────────────────── Task Card ─────────────────────── */
function TaskCard({
  task, actorId, doers, users, readOnly, onChanged,
}: {
  task: DelegationTask;
  actorId: string;
  doers: TaskDoer[];
  users: AdminUserRow[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [proofUrl, setProofUrl] = useState(task.proof_url ?? "");
  const [proofNote, setProofNote] = useState(task.proof_note ?? "");
  const [busy, setBusy] = useState<null | "progress" | "save" | "submit">(null);

  const doerName = resolveTaskDoerName(task as any, doers, users as any);
  const assignedByName =
    (task as any).assigned_by_name ||
    users.find((u) => u.id === (task as any).assigned_by_user_id)?.display_name ||
    "—";
  const isSubmitted = task.system_stage === "submitted";
  const isCompleted = task.system_stage === "completed";
  const canStart = !readOnly && !isCompleted && !isSubmitted && task.system_stage !== "in_progress";
  const canSubmit = !readOnly && !isCompleted;

  const handleStart = async () => {
    setBusy("progress");
    try {
      await updateTaskFields(task.id, actorId, { system_stage: "in_progress", status: "In Progress" }, "marked in progress");
      onChanged();
    } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };

  const handleSaveProof = async () => {
    setBusy("save");
    try {
      await updateTaskFields(
        task.id, actorId,
        { proof_url: proofUrl || null, proof_note: proofNote || null },
        "proof / note updated",
      );
      onChanged();
    } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };

  const handleSubmit = async () => {
    if (!confirm("Submit this task for admin review? You will not be able to edit it until reviewed.")) return;
    setBusy("submit");
    try {
      await submitForReview(task.id, actorId, proofUrl || undefined, proofNote || undefined);
      onChanged();
    } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div
      className="bg-white border border-[#E8E5DE] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#E8D49A] transition-colors"
      data-testid="mytasks-card"
      data-task-id={task.id}
      data-task-title={task.title}
      data-task-stage={task.system_stage}
    >
      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-stone-900 break-words"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, lineHeight: 1.25 }}
          >
            {task.title}
          </div>
          {task.description && (
            <p className="text-[12.5px] text-stone-600 mt-1.5 line-clamp-3">{task.description}</p>
          )}
        </div>
        <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded border ${stageClass(task.system_stage)} flex-shrink-0`}>
          {task.status || task.system_stage}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-stone-600">
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${badgeClassOfTaskType((task as any).task_type)}`}
          data-testid="mytasks-tasktype"
          title={labelOfTaskType((task as any).task_type)}
        >
          {TASK_TYPE_SHORT[(((task as any).task_type ?? "standup") as "recurring_daily" | "standup" | "ad_hoc")]}
        </span>
        <Meta label="Task Doer" value={doerName === "—" ? "You" : doerName} />
        <Meta label="Assigned by" value={assignedByName} />
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-stone-400" />
          <span className="text-stone-500">Due</span>
          <span className="text-stone-800" data-testid="mytasks-due">
            {task.due_date ? (task.due_time ? `${task.due_date} ${String(task.due_time).slice(0,5)}` : task.due_date) : "—"}
          </span>
        </span>
        {isDelegationOverdue({ due_date: task.due_date, system_stage: task.system_stage, is_deleted: task.is_deleted }) && (
          <span
            data-testid="mytasks-overdue"
            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200"
          >
            Overdue
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(task.priority)}`}>{task.priority}</span>
        {task.revision_count > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            rev × {task.revision_count}
          </span>
        )}
        {task.completed_at && (
          <span className="text-stone-500">Submitted {task.completed_at.slice(0, 10)}</span>
        )}
      </div>

      {/* Proof + note */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-stone-500">Proof URL</span>
          <input
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            disabled={readOnly || isCompleted}
            placeholder="https://…"
            className="bg-white border border-[#E8E2D2] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#C8A84B] focus:ring-1 focus:ring-[#C8A84B] disabled:bg-stone-50 disabled:text-stone-500"
            data-testid="mytasks-proof-url"
          />
          {task.proof_url && (
            <a
              href={task.proof_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#7A5E10] hover:underline flex items-center gap-1 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" /> Open current proof
            </a>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-stone-500">Note</span>
          <textarea
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            disabled={readOnly || isCompleted}
            rows={2}
            placeholder="Optional note for the reviewer"
            className="bg-white border border-[#E8E2D2] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#C8A84B] focus:ring-1 focus:ring-[#C8A84B] disabled:bg-stone-50 disabled:text-stone-500 resize-none"
            data-testid="mytasks-proof-note"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {canStart && (
          <button
            onClick={handleStart}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white border border-[#E8E2D2] text-stone-700 hover:bg-[#F7F4EA] disabled:opacity-50"
            data-testid="mytasks-start"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Mark in progress
          </button>
        )}
        {!readOnly && !isCompleted && (
          <button
            onClick={handleSaveProof}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white border border-[#E8E2D2] text-stone-700 hover:bg-[#F7F4EA] disabled:opacity-50"
            data-testid="mytasks-save-proof"
          >
            <FileText className="w-3.5 h-3.5" />
            {busy === "save" ? "Saving…" : "Save proof / note"}
          </button>
        )}
        <div className="flex-1" />
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-stone-900 text-[#C8A84B] hover:bg-stone-800 disabled:opacity-50 font-medium"
            data-testid="mytasks-submit"
          >
            <Send className="w-3.5 h-3.5" />
            {busy === "submit" ? "Submitting…" : isSubmitted ? "Resubmit for review" : "Submit for review"}
          </button>
        )}
        {isCompleted && (
          <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            Approved
          </span>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800 truncate max-w-[180px]">{value}</span>
    </span>
  );
}

function DailyChecklistSummaryCard() {
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = todayISO();
        const [t, c] = await Promise.all([
          listTemplates({ activeOnly: true }),
          listCompletionsForDate(today),
        ]);
        if (cancelled) return;
        const items = buildChecklist(t, c);
        setTotal(items.length);
        setDone(items.filter((i) => i.completion).length);
      } catch {
        /* ignore — RLS returns empty for users with no templates */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || total === 0) return null;
  const pending = total - done;

  return (
    <div
      className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4"
      data-testid="mytasks-daily-checklist-card"
    >
      <div>
        <div className="text-[11px] uppercase tracking-wide text-emerald-700">Daily Checklist</div>
        <div className="text-stone-900 mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>
          {done} of {total} done today
        </div>
        <div className="text-[12px] text-stone-600 mt-0.5">
          {pending === 0 ? "All daily tasks complete." : `${pending} pending`}
        </div>
      </div>
      <Link
        to="/daily-checklist"
        className="text-xs px-4 py-2 rounded-lg bg-stone-900 text-[#C8A84B] hover:bg-stone-800 font-medium"
        data-testid="mytasks-open-checklist"
      >
        Open Daily Checklist
      </Link>
    </div>
  );
}
