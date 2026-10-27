// Ported from IPC Control Center src/pages/Tasks.tsx.
// Vision Center adaptations:
// - useAuth swapped for VC adapter (src/lib/tasks/useTaskAuth)
// - useSearchParams (react-router-dom) removed; open-by-query-param not used
// - members list sourced from VC users directory
import { useEffect, useMemo, useState } from "react";
import { Search, X, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/tasks/useTaskAuth";
import { listAllUsersWithRoles } from "@/services/users/userService";
import {
  Task, TaskStatus, TaskSubmission, STATUSES, PRIORITY_PILL, fetchTasks, updateTask, archiveOldDone,
  dueLabel, todayISO, isOverdue, isDueToday, whatsappText, initialsOf,
  fetchSubmissionsForTasks,
} from "@/lib/tasks";
import TaskCard from "./TaskCard";
import TaskDrawer from "./TaskDrawer";
import SubmitTaskModal from "./SubmitTaskModal";

type View = "kanban" | "list" | "people";
type Scope = "my" | "all";

interface Member { id: string; full_name: string; role: string | null }

export default function TasksPage() {
  const { user, profile, isAdmin } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>("kanban");
  const [scope, setScope] = useState<Scope>(isAdmin ? "all" : "my");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDefaultStatus, setDrawerDefaultStatus] = useState<TaskStatus | undefined>();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"due_date" | "title" | "priority" | "status">("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [submitFor, setSubmitFor] = useState<Task | null>(null);
  const [submissionsByTask, setSubmissionsByTask] = useState<Map<string, TaskSubmission[]>>(new Map());

  useEffect(() => { setScope(isAdmin ? "all" : "my"); }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await fetchTasks();
        if (!cancelled) setTasks(t);
      } catch (e: any) { toast.error(e?.message || "Failed to load tasks"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    if (isAdmin) {
      listAllUsersWithRoles().then((rows) => {
        if (cancelled) return;
        const mapped: Member[] = rows.map((r) => ({
          id: r.id,
          full_name: r.display_name || "(unnamed user)",
          role: r.roles?.[0] ?? null,
        }));
        mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setMembers(mapped);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isAdmin]);

  // Realtime — best-effort; if tables aren't in the realtime publication, this no-ops.
  useEffect(() => {
    const ch = (supabase as any).channel("tasks-rt").on("postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      (payload: any) => {
        setTasks((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Task;
            return prev.some((t) => t.id === row.id) ? prev : [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Task;
            if (row.is_archived) return prev.filter((t) => t.id !== row.id);
            return prev.map((t) => (t.id === row.id ? row : t));
          }
          if (payload.eventType === "DELETE") {
            const id = (payload.old as any).id; return prev.filter((t) => t.id !== id);
          }
          return prev;
        });
      }).subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!tasks.length) { setSubmissionsByTask(new Map()); return; }
    let cancelled = false;
    fetchSubmissionsForTasks(tasks.map(t => t.id))
      .then((m) => { if (!cancelled) setSubmissionsByTask(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tasks]);

  useEffect(() => {
    const ch = (supabase as any).channel("task-sub-rt").on("postgres_changes",
      { event: "*", schema: "public", table: "task_submissions" },
      (payload: any) => {
        setSubmissionsByTask((prev) => {
          const next = new Map(prev);
          if (payload.eventType === "INSERT") {
            const row = payload.new as TaskSubmission;
            const arr = [row, ...(next.get(row.task_id) ?? [])];
            next.set(row.task_id, arr);
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as TaskSubmission;
            const arr = (next.get(row.task_id) ?? []).filter(s => s.id !== row.id);
            next.set(row.task_id, arr);
          }
          return next;
        });
      }).subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchText.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [searchText]);

  const filtered = useMemo(() => {
    let arr = tasks.slice();
    if (scope === "my" && user) arr = arr.filter((t) => t.assigned_to === user.id);
    if (isAdmin && memberFilter !== "all") arr = arr.filter((t) => t.assigned_to === memberFilter);
    if (priorityFilter !== "all") arr = arr.filter((t) => t.priority === priorityFilter);
    if (dueFilter !== "all") {
      const today = todayISO();
      arr = arr.filter((t) => {
        if (dueFilter === "overdue") return isOverdue(t);
        if (dueFilter === "today") return t.due_date === today;
        if (dueFilter === "week") {
          if (!t.due_date) return false;
          const end = new Date(); end.setDate(end.getDate() + 7);
          return t.due_date <= end.toISOString().slice(0,10) && t.due_date >= today;
        }
        if (dueFilter === "nodue") return !t.due_date;
        return true;
      });
    }
    if (searchDebounced) {
      arr = arr.filter((t) =>
        t.title.toLowerCase().includes(searchDebounced)
        || (t.note ?? "").toLowerCase().includes(searchDebounced)
        || (t.assigned_name ?? "").toLowerCase().includes(searchDebounced)
      );
    }
    return arr;
  }, [tasks, scope, user, isAdmin, memberFilter, priorityFilter, dueFilter, searchDebounced]);

  const stats = useMemo(() => {
    const base = scope === "my" && user ? tasks.filter((t) => t.assigned_to === user.id) : tasks;
    const startOfWeek = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d.toISOString(); })();
    return {
      high: base.filter((t) => t.priority === "high" && t.status !== "done").length,
      inProgress: base.filter((t) => t.status === "inprogress").length,
      dueToday: base.filter((t) => isDueToday(t)).length,
      doneWeek: base.filter((t) => t.status === "done" && t.updated_at >= startOfWeek).length,
    };
  }, [tasks, scope, user]);

  const openDrawer = (t: Task | null, defaultStatus?: TaskStatus) => {
    setDrawerTask(t); setDrawerDefaultStatus(defaultStatus); setDrawerOpen(true);
  };

  const quickStatus = async (t: Task, s: TaskStatus) => {
    if (!user || !profile) return;
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: s } : x));
    try { await updateTask(t, { status: s }, { id: user.id, name: profile.full_name }); }
    catch (e: any) { toast.error(e?.message || "Failed"); setTasks((prev) => prev.map((x) => x.id === t.id ? t : x)); }
  };

  const onDropTo = async (s: TaskStatus) => {
    setDragOverCol(null);
    if (!draggedTask || !user || !profile || draggedTask.status === s) { setDraggedTask(null); return; }
    const t = draggedTask; setDraggedTask(null);
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: s } : x));
    try { await updateTask(t, { status: s }, { id: user.id, name: profile.full_name }); }
    catch (e: any) { toast.error(e?.message || "Failed"); setTasks((prev) => prev.map((x) => x.id === t.id ? t : x)); }
  };

  const onDropToPerson = async (assigneeId: string | null, assigneeName: string | null) => {
    if (!draggedTask || !user || !profile) { setDraggedTask(null); return; }
    const t = draggedTask; setDraggedTask(null);
    if ((t.assigned_to ?? null) === assigneeId) return;
    if (!isAdmin && t.assigned_to !== user.id) {
      toast.error("Only admins can reassign others' tasks");
      return;
    }
    const initials = assigneeName ? initialsOf(assigneeName) : null;
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, assigned_to: assigneeId, assigned_name: assigneeName, assigned_initials: initials } : x));
    try {
      await updateTask(t, { assigned_to: assigneeId, assigned_name: assigneeName } as any, { id: user.id, name: profile.full_name });
    } catch (e: any) {
      toast.error(e?.message || "Failed to reassign");
      setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
    }
  };

  const archiveDone = async () => {
    try { const n = await archiveOldDone(); toast.success(`Archived ${n} done tasks older than 7 days`); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const copyWhatsapp = async (t: Task) => {
    await navigator.clipboard.writeText(whatsappText(t));
    toast.success("Copied to clipboard");
    setMenuOpenFor(null);
  };

  const onSaved = (t: Task) => {
    setTasks((prev) => prev.some((x) => x.id === t.id) ? prev.map((x) => x.id === t.id ? t : x) : [t, ...prev]);
  };
  const onArchived = (t: Task) => setTasks((prev) => prev.filter((x) => x.id !== t.id));

  const latestSubmission = (taskId: string): TaskSubmission | null => {
    const arr = submissionsByTask.get(taskId);
    return arr && arr.length ? arr[0] : null;
  };
  const canSubmitFor = (t: Task) => !!user && (isAdmin || t.assigned_to === user.id || t.created_by === user.id);
  const onSubmissionCreated = (s: TaskSubmission, updated?: Task) => {
    setSubmissionsByTask((prev) => {
      const next = new Map(prev);
      next.set(s.task_id, [s, ...(next.get(s.task_id) ?? [])]);
      return next;
    });
    if (updated) onSaved(updated);
  };

  const resetFilters = () => { setPriorityFilter("all"); setDueFilter("all"); setMemberFilter("all"); setSearchText(""); };

  const [hideStats, setHideStats] = useState<boolean>(() => {
    try { return localStorage.getItem("tasks:hideStats") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("tasks:hideStats", hideStats ? "1" : "0"); } catch {} }, [hideStats]);

  return (
    <div className="max-w-[1600px]">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div className="font-sans text-[11px] text-muted-foreground">{filtered.length} task{filtered.length===1?"":"s"}</div>
        {!hideStats && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatPill label="High priority" value={stats.high} tone={stats.high > 0 ? "gold" : "muted"} />
            <StatPill label="In progress" value={stats.inProgress} />
            <StatPill label="Due today" value={stats.dueToday} tone={stats.dueToday > 0 ? "amber" : "muted"} />
            <StatPill label="Completed" value={stats.doneWeek} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setHideStats(v => !v)} className="text-[10px] text-muted-foreground hover:text-black underline-offset-2 hover:underline">
            {hideStats ? "Show stats" : "Hide stats"}
          </button>
          <button onClick={() => openDrawer(null)} className="ipc-btn ipc-btn-black !h-8 !px-3 !text-[11px] flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New task
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background flex items-center gap-2 flex-wrap mb-2 py-2 border-b border-line">
        <PillGroup options={[
          { v: "kanban", label: "Kanban" }, { v: "list", label: "List" }, { v: "people", label: "People" },
        ]} value={view} onChange={(v) => setView(v as View)} />
        <Sep />
        <PillGroup options={[
          { v: "my", label: "My Tasks" },
          { v: "all", label: "All Tasks", disabled: !isAdmin },
        ]} value={scope} onChange={(v) => setScope(v as Scope)} />
        {isAdmin && (
          <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="ipc-input !h-7 !text-[11px] !w-auto !px-2">
            <option value="all">All members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        )}
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="ipc-input !h-7 !text-[11px] !w-auto !px-2">
          <option value="all">All priorities</option>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className="ipc-input !h-7 !text-[11px] !w-auto !px-2">
          <option value="all">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">Next 7 days</option>
          <option value="nodue">No due date</option>
        </select>
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search tasks…"
            className="ipc-input !h-7 !text-[11px] !pl-8 !pr-7 !w-[200px]" />
          {searchText && (
            <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-black">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[calc(100vh-160px)]">
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-[13px]">Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <FullEmpty onCreate={() => openDrawer(null)} />
      ) : filtered.length === 0 ? (
        <CenteredEmpty msg={searchDebounced ? `No tasks match '${searchDebounced}'` : "No tasks match your filters"} onReset={resetFilters} />
      ) : view === "kanban" ? (
        <KanbanView tasks={filtered} onOpen={(t: Task) => openDrawer(t)} onQuickStatus={quickStatus}
          onDragStart={setDraggedTask} onDropTo={onDropTo} dragOverCol={dragOverCol} setDragOverCol={setDragOverCol}
          onAddTask={(s: TaskStatus) => openDrawer(null, s)} isAdmin={isAdmin} onArchiveDone={archiveDone}
          latestSubmission={latestSubmission} canSubmitFor={canSubmitFor} onSubmit={setSubmitFor} />
      ) : view === "list" ? (
        <ListView tasks={filtered} onOpen={(t: Task) => openDrawer(t)} onQuickStatus={quickStatus}
          sortBy={sortBy} sortDir={sortDir} onSort={(s: any) => { if (sortBy === s) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(s); setSortDir("asc"); } }}
          menuOpenFor={menuOpenFor} setMenuOpenFor={setMenuOpenFor} onCopy={copyWhatsapp} isAdmin={isAdmin}
          latestSubmission={latestSubmission}
          onArchive={async (t: Task) => { if (!user || !profile) return; if (!confirm("Archive this task?")) return;
            try { const { archiveTask } = await import("@/lib/tasks"); await archiveTask(t, { id: user.id, name: profile.full_name }); onArchived(t); } catch(e:any){ toast.error(e?.message); }
          }} />
      ) : (
        <PeopleView tasks={filtered} members={members} isAdmin={isAdmin} me={user?.id ?? null} myName={profile?.full_name ?? "Me"}
          onOpen={(t: Task) => openDrawer(t)} onQuickStatus={quickStatus}
          onDragStart={setDraggedTask} onDropToPerson={onDropToPerson} draggedTask={draggedTask}
          latestSubmission={latestSubmission} canSubmitFor={canSubmitFor} onSubmit={setSubmitFor} />
      )}
      </div>

      {drawerOpen && (
        <TaskDrawer task={drawerTask} defaultStatus={drawerDefaultStatus}
          onClose={() => { setDrawerOpen(false); setDrawerTask(null); setDrawerDefaultStatus(undefined); }}
          onSaved={onSaved} onArchived={onArchived}
          onOpenSubmit={(t) => setSubmitFor(t)}
          submissions={drawerTask ? (submissionsByTask.get(drawerTask.id) ?? []) : []} />
      )}
      {submitFor && (
        <SubmitTaskModal task={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={onSubmissionCreated} />
      )}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: "gold" | "amber" | "muted" }) {
  const valueColor = tone === "gold" ? "text-gold" : tone === "amber" ? "text-[#CA8A04]" : "text-black";
  const bg = tone === "gold" ? "bg-gold-pale border-gold-mid" : "bg-off border-line";
  return (
    <div className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border ${bg}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-semibold leading-none ${valueColor}`}>{value}</span>
    </div>
  );
}

function PillGroup<T extends string>({ options, value, onChange }: { options: { v: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex border border-line rounded-md overflow-hidden">
      {options.map((o) => (
        <button key={o.v} disabled={o.disabled} onClick={() => onChange(o.v)}
          className={`h-8 px-3 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            value === o.v ? "bg-black text-white" : "bg-white text-muted-foreground hover:text-black"
          }`}>{o.label}</button>
      ))}
    </div>
  );
}

const Sep = () => <span className="w-px h-5 bg-line" />;

function FullEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-24 text-center">
      <div className="font-serif text-[22px] mb-2">No tasks yet</div>
      <div className="text-[13px] text-muted-foreground mb-5">Create your first task to get started</div>
      <button onClick={onCreate} className="ipc-btn ipc-btn-black !text-xs">+ Create task</button>
    </div>
  );
}
function CenteredEmpty({ msg, onReset }: { msg: string; onReset: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="text-[13px] text-muted-foreground">{msg}</div>
      <button onClick={onReset} className="text-[12px] text-gold mt-2">Reset filters</button>
    </div>
  );
}

function KanbanView({
  tasks, onOpen, onQuickStatus, onDragStart, onDropTo, dragOverCol, setDragOverCol,
  onAddTask, isAdmin, onArchiveDone, latestSubmission, canSubmitFor, onSubmit,
}: any) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUSES.map((s) => {
        const cols = tasks.filter((t: Task) => t.status === s.key);
        return (
          <div key={s.key} className="flex-shrink-0 w-[280px]"
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(s.key); }}
            onDragLeave={() => setDragOverCol((c: any) => c === s.key ? null : c)}
            onDrop={() => onDropTo(s.key)}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-medium">{s.label}</span>
                <span className="font-serif text-[18px] text-muted-foreground leading-none">{cols.length}</span>
              </div>
              {s.key === "done" && isAdmin && (
                <button onClick={onArchiveDone} className="text-[10px] text-muted-foreground hover:text-gold">Archive ›</button>
              )}
            </div>
            <div className={`h-[2px] ${s.barClass} mb-3`} />
            <div className={`flex flex-col gap-2 min-h-[80px] p-1 rounded-md transition-colors ${dragOverCol === s.key ? "border border-dashed border-gold bg-gold-pale/40" : "border border-transparent"}`}>
              {cols.length === 0 && (
                <div className="border border-dashed border-line rounded-md py-6 text-center text-[12px] text-muted-foreground">No tasks here</div>
              )}
              {cols.map((t: Task) => (
                <TaskCard key={t.id} task={t} onOpen={onOpen} onQuickStatus={onQuickStatus} onDragStart={onDragStart}
                  submission={latestSubmission?.(t.id)} canSubmit={canSubmitFor?.(t)} onSubmit={onSubmit} />
              ))}
              <button onClick={() => onAddTask(s.key)}
                className="h-11 border border-dashed border-line rounded-md text-[12px] text-muted-foreground hover:bg-gold-pale hover:border-gold transition-colors">
                + Add task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks, onOpen, onQuickStatus, sortBy, sortDir, onSort, menuOpenFor, setMenuOpenFor, onCopy, onArchive, isAdmin, latestSubmission }: any) {
  const sorted = useMemo(() => {
    const arr = tasks.slice();
    const prioRank: any = { high: 0, medium: 1, low: 2 };
    arr.sort((a: Task, b: Task) => {
      let av: any, bv: any;
      switch (sortBy) {
        case "title": av = a.title; bv = b.title; break;
        case "priority": av = prioRank[a.priority]; bv = prioRank[b.priority]; break;
        case "status": av = a.status; bv = b.status; break;
        default: av = a.due_date ?? "9999-12-31"; bv = b.due_date ?? "9999-12-31";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortBy, sortDir]);

  const arrow = (col: string) => sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <div className="grid grid-cols-[40px_1fr_140px_120px_90px_110px_120px_50px] bg-off text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
        <div className="px-3 py-3" />
        <button className="px-3 py-3 text-left hover:text-black" onClick={() => onSort("title")}>Task{arrow("title")}</button>
        <div className="px-3 py-3">Assigned</div>
        <div className="px-3 py-3">Created by</div>
        <button className="px-3 py-3 text-left hover:text-black" onClick={() => onSort("priority")}>Priority{arrow("priority")}</button>
        <button className="px-3 py-3 text-left hover:text-black" onClick={() => onSort("status")}>Status{arrow("status")}</button>
        <button className="px-3 py-3 text-left hover:text-black" onClick={() => onSort("due_date")}>Due{arrow("due_date")}</button>
        <div />
      </div>
      {sorted.map((t: Task) => <ListRow key={t.id} t={t} onOpen={onOpen} onQuickStatus={onQuickStatus}
        menuOpen={menuOpenFor === t.id} setMenuOpen={(v: boolean) => setMenuOpenFor(v ? t.id : null)}
        onCopy={onCopy} onArchive={onArchive} isAdmin={isAdmin} submission={latestSubmission?.(t.id)} />)}
    </div>
  );
}

function ListRow({ t, onOpen, onQuickStatus, menuOpen, setMenuOpen, onCopy, onArchive, isAdmin, submission }: any) {
  const status = STATUSES.find((s) => s.key === t.status)!;
  const due = dueLabel(t.due_date);
  const dueColor = due.tone === "overdue" ? "text-[#DC2626]" : due.tone === "today" ? "text-[#CA8A04]" : "text-muted-foreground";
  const showCreator = t.created_by && t.created_by !== t.assigned_to;
  return (
    <div onClick={() => onOpen(t)}
      className="group grid grid-cols-[40px_1fr_140px_120px_90px_110px_120px_50px] items-center border-t border-line hover:bg-off cursor-pointer">
      <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onQuickStatus(t, t.status === "done" ? "todo" : "done")}
          className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center ${t.status === "done" ? "bg-[#16A34A] border-[#16A34A] text-white" : "border-line"}`}>
          {t.status === "done" && <span className="text-[10px] leading-none">✓</span>}
        </button>
      </div>
      <div className="px-3 py-3">
        <div className={`font-serif text-[15px] font-medium ${t.status === "done" ? "line-through opacity-65" : ""}`}>{t.title}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span>{t.tag}</span>
          {submission && (
            <a href={submission.submission_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-[#16A34A] hover:underline">· Open submission ↗</a>
          )}
        </div>
      </div>
      <div className="px-3 py-3 flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center font-serif text-[8px] text-gold flex-shrink-0">{t.assigned_initials ?? "—"}</div>
        <span className="text-[12px] truncate">{t.assigned_name ?? "—"}</span>
      </div>
      <div className="px-3 py-3 text-[11px] text-muted-foreground truncate">{showCreator ? t.created_by_name : "—"}</div>
      <div className="px-3 py-3">
        <span className={`inline-block px-2 h-[20px] text-[10px] rounded-full border leading-[18px] ${PRIORITY_PILL[t.priority as keyof typeof PRIORITY_PILL]} capitalize`}>{t.priority}</span>
      </div>
      <div className="px-3 py-3">
        <span className={`inline-block px-2 h-[20px] text-[10px] rounded-full border leading-[18px] ${status.pillClass}`}>{status.label}</span>
      </div>
      <div className={`px-3 py-3 text-[11px] ${dueColor}`}>{due.label}</div>
      <div className="px-3 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="w-7 h-7 rounded hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-3 top-10 z-30 w-[160px] bg-white border border-line rounded-lg shadow-lg overflow-hidden">
            <MenuBtn onClick={() => { setMenuOpen(false); onOpen(t); }}>Edit</MenuBtn>
            <MenuBtn onClick={() => onCopy(t)}>Copy for WhatsApp</MenuBtn>
            {isAdmin && <MenuBtn onClick={() => { setMenuOpen(false); onArchive(t); }} danger>Archive</MenuBtn>}
          </div>
        )}
      </div>
    </div>
  );
}
function MenuBtn({ children, onClick, danger }: any) {
  return <button onClick={onClick} className={`w-full text-left px-3 py-2 text-[12px] hover:bg-off ${danger ? "text-[#DC2626]" : ""}`}>{children}</button>;
}

function PeopleView({ tasks, members, isAdmin, me, myName, onOpen, onQuickStatus, onDragStart, onDropToPerson, draggedTask, latestSubmission, canSubmitFor, onSubmit }: any) {
  const [dragOverId, setDragOverId] = useState<string | "__unassigned__" | null>(null);

  const groups = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; role: string | null; tasks: Task[] }>();
    if (isAdmin) {
      members.forEach((m: Member) => byId.set(m.id, { id: m.id, name: m.full_name, role: m.role, tasks: [] }));
    } else if (me) {
      byId.set(me, { id: me, name: myName, role: null, tasks: [] });
    }
    const unassigned: Task[] = [];
    tasks.forEach((t: Task) => {
      if (!t.assigned_to) { unassigned.push(t); return; }
      if (!byId.has(t.assigned_to)) {
        if (!isAdmin) return;
        byId.set(t.assigned_to, { id: t.assigned_to, name: t.assigned_name ?? "—", role: null, tasks: [] });
      }
      byId.get(t.assigned_to)!.tasks.push(t);
    });
    const arr = Array.from(byId.values());
    arr.sort((a, b) => b.tasks.length - a.tasks.length || a.name.localeCompare(b.name));
    return { people: arr, unassigned };
  }, [tasks, members, isAdmin, me, myName]);

  const renderColumn = (key: string, title: string, role: string | null, list: Task[], onDrop: () => void) => {
    const overdue = list.filter(isOverdue).length;
    const isOver = dragOverId === key;
    const canDrop = !!draggedTask;
    return (
      <div key={key} className="flex-shrink-0 w-[280px]"
        onDragOver={(e) => { if (canDrop) { e.preventDefault(); setDragOverId(key); } }}
        onDragLeave={() => setDragOverId((c) => c === key ? null : c)}
        onDrop={() => { setDragOverId(null); onDrop(); }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center font-serif text-[9px] text-gold flex-shrink-0">{key === "__unassigned__" ? "—" : initialsOf(title)}</div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium truncate leading-tight">{title}</div>
              {role && <div className="text-[9px] text-muted-foreground truncate leading-tight">{role}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="font-serif text-[16px] text-muted-foreground leading-none">{list.length}</span>
            {overdue > 0 && <span className="text-[9px] text-[#DC2626]">⚠{overdue}</span>}
          </div>
        </div>
        <div className="h-[2px] bg-line mb-3" />
        <div className={`flex flex-col gap-2 min-h-[80px] p-1 rounded-md transition-colors ${isOver ? "border border-dashed border-gold bg-gold-pale/40" : "border border-transparent"}`}>
          {list.length === 0 ? (
            <div className="border border-dashed border-line rounded-md py-6 text-center text-[12px] text-muted-foreground">No tasks assigned</div>
          ) : list.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpen} onQuickStatus={onQuickStatus} onDragStart={onDragStart}
              submission={latestSubmission?.(t.id)} canSubmit={canSubmitFor?.(t)} onSubmit={onSubmit} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {groups.unassigned.length > 0 && renderColumn("__unassigned__", "Unassigned", null, groups.unassigned, () => onDropToPerson(null, null))}
      {groups.people.map((g) => renderColumn(g.id, g.name, g.role, g.tasks, () => onDropToPerson(g.id, g.name)))}
      {groups.people.length === 0 && groups.unassigned.length === 0 && (
        <div className="text-[13px] text-muted-foreground py-10">No team members</div>
      )}
    </div>
  );
}
