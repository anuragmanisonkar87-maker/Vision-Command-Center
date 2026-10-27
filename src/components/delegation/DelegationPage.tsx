import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, Trash2, RefreshCcw, Calendar, Award, ExternalLink } from "lucide-react";
import { VALID_TABS, type DelegationTab } from "@/routes/delegation";
import { useAuth } from "@/hooks/auth/useAuth";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import { listTaskDoers, type TaskDoer } from "@/services/delegation/taskDoers";

import {
  createTask,
  getLeaderboard,
  getSettings,
  listAllTasks,
  listMyTasks,
  markCompleted,
  markRevision,
  softDeleteTask,
  changeDueDate,
  updateSettings,
  type DelegationSettings,
  type DelegationTask,
  type LeaderboardRow,
  type Priority,
  type Difficulty,
} from "@/services/delegation/delegationService";
import {
  canChangeDueDate,
  canDeleteTask,
  canManageSettings,
  canViewTeamBoard,
} from "@/utils/permissions/delegationPermissions";
import { initialsOf } from "@/lib/tasks";
import DelegationGrid from "@/components/delegation/grid/DelegationGrid";
import { UserPointsDrawer } from "@/components/delegation/HistoryDrawers";
import MonthlyWinnersPanel from "@/components/delegation/MonthlyWinnersPanel";
import RewardSettingsPanel from "@/components/delegation/RewardSettingsPanel";
import BadgeStrip from "@/components/delegation/BadgeStrip";
import PerformanceReportsTab from "@/components/delegation/PerformanceReportsTab";
import TaskDoerPicker from "@/components/delegation/TaskDoerPicker";
import MyTasksView from "@/components/delegation/MyTasksView";
import MissedTasksPanel from "@/components/delegation/MissedTasksPanel";
import MissedTasksAlert from "@/components/delegation/MissedTasksAlert";
import DisciplineCenter from "@/components/delegation/DisciplineCenter";
import "@/components/delegation/grid/grid.css";

type Tab = DelegationTab;

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

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
    ? "bg-emerald-50 text-emerald-700"
    : s === "revision"
      ? "bg-rose-50 text-rose-700"
      : s === "blocked"
        ? "bg-zinc-100 text-zinc-700"
        : s === "in_progress" || s === "submitted"
          ? "bg-amber-50 text-amber-800"
          : "bg-stone-100 text-stone-700";

export default function DelegationPage() {
  const { user } = useAuth();
  const isAdmin = canViewTeamBoard(user);
  const search = useSearch({ from: "/delegation" }) as { tab?: Tab };
  const navigate = useNavigate({ from: "/delegation" });

  // Deterministic default: URL param wins, else admin→daily, employee→mytasks.
  // No localStorage persistence — prevents stale tab from overriding role default.
  const defaultTab: Tab = isAdmin ? "daily" : "mytasks";
  const tab: Tab =
    search.tab && VALID_TABS.includes(search.tab) && !(search.tab === "team" && !isAdmin) && !(search.tab === "settings" && !canManageSettings(user))
      ? search.tab
      : defaultTab;

  const setTab = (next: Tab) => {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, tab: next }), replace: true });
  };

  if (!user) {
    return <div className="p-8 text-stone-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F0E8", fontFamily: "Figtree, sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500 }} className="text-stone-900">
            Delegation Command Center
          </h1>
          <p className="text-sm text-stone-600 mt-2">Daily stand-up delegation in a spreadsheet — type, paste, save.</p>
        </header>

        <div
          role="tablist"
          aria-label="Delegation sections"
          className="flex items-center gap-1.5 bg-white border border-[#E8E5DE] rounded-xl p-1.5 mb-8 overflow-x-auto shadow-sm"
        >
          <TabBtn active={tab === "daily"} onClick={() => setTab("daily")}>Daily Grid</TabBtn>
          <TabBtn active={tab === "mytasks"} onClick={() => setTab("mytasks")}>My Tasks</TabBtn>
          {isAdmin && <TabBtn active={tab === "team"} onClick={() => setTab("team")}>Team Grid</TabBtn>}
          <TabBtn active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>Leaderboard</TabBtn>
          <TabBtn active={tab === "reports"} onClick={() => setTab("reports")}>Performance Reports</TabBtn>
          {isAdmin && <TabBtn active={tab === "discipline"} onClick={() => setTab("discipline")}>Discipline</TabBtn>}
          {canManageSettings(user) && <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>Admin Settings</TabBtn>}
        </div>

        {tab === "mytasks" && (
          <div className="space-y-6">
            <MyTasksView userId={user.id} isAdmin={isAdmin} />
            {!isAdmin && <MissedTasksPanel userId={user.id} isAdmin={false} />}
          </div>
        )}
        {tab === "daily" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E8E5DE] rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap min-h-[56px]">
              <span className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">Your badges this month</span>
              <BadgeStrip userId={user.id} period="month" />
            </div>
            {isAdmin && <MissedTasksAlert onOpenDisciplineCenter={() => setTab("discipline")} />}
            <DelegationGrid userId={user.id} isAdmin={isAdmin} scope="mine" />
          </div>
        )}
        {tab === "team" && isAdmin && (
          <div className="space-y-6">
            <MissedTasksAlert onOpenDisciplineCenter={() => setTab("discipline")} />
            <DelegationGrid userId={user.id} isAdmin={isAdmin} scope="all" />
          </div>
        )}
        {tab === "leaderboard" && <LeaderboardTab currentUserId={user.id} isAdmin={isAdmin} />}
        {tab === "reports" && <PerformanceReportsTab currentUserId={user.id} isAdmin={isAdmin} />}
        {tab === "discipline" && isAdmin && <DisciplineCenter userId={user.id} isAdmin={isAdmin} />}
        {tab === "settings" && canManageSettings(user) && <SettingsTab />}
      </div>
    </div>
  );
}



function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
        active
          ? "bg-stone-900 text-[#C8A84B] shadow-sm"
          : "text-stone-600 hover:text-stone-900 hover:bg-[#FBF6E9]"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#E8E5DE] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

/* ──────────────────────── My Tasks ──────────────────────── */
function MyTasksTab({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [completeFor, setCompleteFor] = useState<DelegationTask | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTasks(await listMyTasks(userId));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [userId]);

  const mine = tasks.filter((t) => t.assignee_id === userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-stone-600">{mine.length} task{mine.length === 1 ? "" : "s"} assigned to you</div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-stone-900 text-[#C8A84B] px-3.5 py-2 rounded-lg text-sm hover:bg-stone-800"
        >
          <Plus className="w-4 h-4" /> New task
        </button>
      </div>

      {loading ? (
        <div className="text-stone-500 text-sm">Loading…</div>
      ) : mine.length === 0 ? (
        <Card className="p-10 text-center">
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-700">No tasks yet</p>
          <p className="text-sm text-stone-500 mt-1">Create a task to start tracking your work.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-[#F0EDE5]">
            {mine.map((t) => (
              <TaskRow key={t.id} task={t} userId={userId} onChanged={load} onComplete={() => setCompleteFor(t)} />
            ))}
          </div>
        </Card>
      )}

      {showCreate && (
        <CreateTaskDrawer
          userId={userId}
          defaultAssignee={userId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}
      {completeFor && (
        <CompleteModal
          task={completeFor}
          userId={userId}
          onClose={() => setCompleteFor(null)}
          onDone={() => { setCompleteFor(null); void load(); }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task, userId, onChanged, onComplete, allowAdmin = false,
}: {
  task: DelegationTask;
  userId: string;
  onChanged: () => void;
  onComplete: () => void;
  allowAdmin?: boolean;
}) {
  const isMine = task.assignee_id === userId;
  const isDone = task.system_stage === "completed";
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#FBF6E9]/40">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-stone-900 truncate">{task.title}</div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(task.priority)}`}>{task.priority}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${stageClass(task.system_stage)}`}>{task.status}</span>
          {task.revision_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">rev x{task.revision_count}</span>
          )}
        </div>
        {task.description && <div className="text-xs text-stone-500 mt-0.5 truncate">{task.description}</div>}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-500">
          {task.category && <span>{task.category}</span>}
          {task.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.due_date}</span>}
          {task.proof_url && (
            <a href={task.proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#7A5E10] hover:underline">
              <ExternalLink className="w-3 h-3" /> proof
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isMine && !isDone && (
          <button onClick={onComplete} className="text-xs px-2.5 py-1.5 bg-[#FBF6E9] border border-[#E8D49A] rounded hover:bg-[#F4EAC9]">
            Complete
          </button>
        )}
        {allowAdmin && <AdminActions task={task} userId={userId} onChanged={onChanged} />}
      </div>
    </div>
  );
}

function AdminActions({ task, userId, onChanged }: { task: DelegationTask; userId: string; onChanged: () => void }) {
  const handleDate = async () => {
    const d = window.prompt("New due date (YYYY-MM-DD)", task.due_date ?? "");
    if (!d) return;
    await changeDueDate(task.id, userId, d, "admin reschedule");
    onChanged();
  };
  const handleRev = async () => {
    const n = window.prompt("Revision note (optional)") ?? undefined;
    await markRevision(task.id, userId, n);
    onChanged();
  };
  const handleDel = async () => {
    if (!window.confirm("Soft delete this task?")) return;
    await softDeleteTask(task.id, userId);
    onChanged();
  };
  return (
    <>
      <button onClick={handleDate} title="Change due date" className="p-1.5 text-stone-500 hover:text-stone-900">
        <Calendar className="w-4 h-4" />
      </button>
      <button onClick={handleRev} title="Mark revision" className="p-1.5 text-stone-500 hover:text-rose-700">
        <RefreshCcw className="w-4 h-4" />
      </button>
      <button onClick={handleDel} title="Soft delete" className="p-1.5 text-stone-500 hover:text-red-700">
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );
}

/* ──────────────────────── Team Board ──────────────────────── */
function TeamBoardTab({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const t = await listAllTasks({
        user_id: filterUser || undefined,
        stage: (filterStage || undefined) as any,
        priority: (filterPriority || undefined) as any,
      });
      setTasks(t);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [filterUser, filterStage, filterPriority]);
  useEffect(() => { listAllUsersWithRoles().then(setUsers).catch(() => setUsers([])); }, []);

  const userName = (id: string | null) => (id ? (users.find((u) => u.id === id)?.display_name || id.slice(0, 8)) : "—");

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <Field label="User">
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="ipc-input min-w-[180px]">
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.id.slice(0, 8)}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="ipc-input">
            <option value="">All</option>
            {["planned","in_progress","submitted","completed","revision","blocked","shifted","cancelled"].map((s) =>
              <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="ipc-input">
            <option value="">All</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </Card>

      {loading ? (
        <div className="text-stone-500 text-sm">Loading…</div>
      ) : tasks.length === 0 ? (
        <Card className="p-10 text-center text-stone-500">No tasks match filters.</Card>
      ) : (
        <Card>
          <div className="divide-y divide-[#F0EDE5]">
            {tasks.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#FBF6E9]/40">
                <div className="w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center text-[10px] text-[#C8A84B]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {initialsOf(userName(t.assignee_id))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-stone-900 truncate">{t.title}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(t.priority)}`}>{t.priority}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stageClass(t.system_stage)}`}>{t.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
                    <span>{userName(t.assignee_id)}</span>
                    {t.category && <span>{t.category}</span>}
                    {t.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t.due_date}</span>}
                  </div>
                </div>
                {canEdit && <AdminActions task={t} userId={userId} onChanged={load} />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wide text-stone-500">{label}</label>
      {children}
    </div>
  );
}

/* ──────────────────────── Leaderboard ──────────────────────── */
function LeaderboardTab({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillUser, setDrillUser] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    setLoading(true);
    Promise.all([getLeaderboard(range), listAllUsersWithRoles()])
      .then(([r, u]) => { setRows(r); setUsers(u); })
      .finally(() => setLoading(false));
  }, [range]);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.display_name || "Unknown";

  const openDrill = (uid: string) => {
    if (!isAdmin && uid !== currentUserId) return;
    setDrillUser({ id: uid, name: nameOf(uid) });
  };

  return (
    <div className="space-y-4">
      <MonthlyWinnersPanel userId={currentUserId} isAdmin={isAdmin} />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setRange("week")}
          className={`px-3 py-1.5 text-xs rounded-md ${range === "week" ? "bg-stone-900 text-[#C8A84B]" : "bg-white border border-[#E8E5DE] text-stone-600"}`}
        >This Week</button>
        <button
          onClick={() => setRange("month")}
          className={`px-3 py-1.5 text-xs rounded-md ${range === "month" ? "bg-stone-900 text-[#C8A84B]" : "bg-white border border-[#E8E5DE] text-stone-600"}`}
        >This Month</button>
      </div>
      <Card>
        {loading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-stone-500 text-sm">No activity in this range yet.</div>
        ) : (
          <div className="divide-y divide-[#F0EDE5]">
            {rows.map((r, i) => {
              const canOpen = isAdmin || r.user_id === currentUserId;
              return (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => canOpen && openDrill(r.user_id)}
                  disabled={!canOpen}
                  data-testid="dg-leaderboard-row"
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${canOpen ? "hover:bg-[#FBF6E9]/40 cursor-pointer" : "cursor-default"}`}
                >
                  <div className="w-7 text-center text-stone-500 text-sm">{i + 1}</div>
                  <div className="w-9 h-9 rounded-full bg-stone-900 flex items-center justify-center text-[12px] text-[#C8A84B]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {initialsOf(nameOf(r.user_id))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">{nameOf(r.user_id)}</div>
                    <div className="text-[11px] text-stone-500">{r.completed} completed · {r.on_time_pct}% on-time</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.badges.map((b) => (
                      <span key={b} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#FBF6E9] text-[#7A5E10] border border-[#E8D49A]">
                        <Award className="w-3 h-3" />{b}
                      </span>
                    ))}
                  </div>
                  <div className="w-20 text-right text-lg font-semibold text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {r.points}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
      {drillUser && (
        <UserPointsDrawer userId={drillUser.id} userName={drillUser.name} onClose={() => setDrillUser(null)} />
      )}
    </div>
  );
}

/* ──────────────────────── Settings ──────────────────────── */
function SettingsTab() {
  const [s, setS] = useState<DelegationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getSettings().then(setS).catch(() => setS(null)); }, []);
  if (!s) return <div className="text-sm text-stone-500">Loading…</div>;

  const save = async () => {
    setSaving(true);
    try { await updateSettings(s); } finally { setSaving(false); }
  };

  const updateList = (key: "categories" | "delay_reasons", value: string) =>
    setS({ ...s, [key]: value.split("\n").map((x) => x.trim()).filter(Boolean) });

  return (
    <div className="space-y-4">
      <RewardSettingsPanel />
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium text-stone-900">Categories</div>
        <textarea
          rows={5}
          defaultValue={s.categories.join("\n")}
          onBlur={(e) => updateList("categories", e.target.value)}
          className="ipc-input w-full font-mono text-xs"
        />
      </Card>
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium text-stone-900">Delay reasons</div>
        <textarea
          rows={5}
          defaultValue={s.delay_reasons.join("\n")}
          onBlur={(e) => updateList("delay_reasons", e.target.value)}
          className="ipc-input w-full font-mono text-xs"
        />
      </Card>
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium text-stone-900">Scoring rules</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(s.scoring_rules).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-[11px] text-stone-500">{k}</label>
              <input
                type="number"
                defaultValue={v}
                onBlur={(e) => setS({ ...s, scoring_rules: { ...s.scoring_rules, [k]: Number(e.target.value) } })}
                className="ipc-input"
              />
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium text-stone-900">Statuses</div>
        <div className="text-xs text-stone-500">Edit the display labels. System stages are fixed.</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {s.statuses.map((st, i) => (
            <input
              key={st.stage}
              defaultValue={st.label}
              onBlur={(e) => {
                const next = [...s.statuses];
                next[i] = { ...st, label: e.target.value };
                setS({ ...s, statuses: next });
              }}
              className="ipc-input"
            />
          ))}
        </div>
      </Card>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="bg-stone-900 text-[#C8A84B] px-4 py-2 rounded-lg text-sm hover:bg-stone-800">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── Create / Complete ──────────────────────── */
function CreateTaskDrawer({
  userId, defaultAssignee, isAdmin = false, onClose, onCreated,
}: { userId: string; defaultAssignee: string; isAdmin?: boolean; onClose: () => void; onCreated: () => void }) {
  const [taskDoers, setTaskDoers] = useState<TaskDoer[]>([]);
  const [settings, setSettings] = useState<DelegationSettings | null>(null);
  const [me, setMe] = useState<{ id: string; display_name: string | null; email: string | null }>({ id: userId, display_name: null, email: null });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  /** taskDoer holds gwv_team_members.id of the selected doer. */
  const [taskDoer, setTaskDoer] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [proofRequired, setProofRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  void defaultAssignee;

  useEffect(() => {
    listTaskDoers().then((list) => {
      setTaskDoers(list);
      // Employees: lock Task Doer to self (matched by linked auth user).
      if (!isAdmin) {
        const self = list.find((d) => d.linked_user_id === userId);
        if (self) setTaskDoer(self.id);
      }
    }).catch(() => setTaskDoers([]));
    getSettings().then(setSettings).catch(() => setSettings(null));
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        if (u) {
          let name: string | null = null;
          try {
            const { data: prof } = await supabase.from("profiles" as any).select("display_name").eq("id", u.id).maybeSingle();
            name = (prof as any)?.display_name ?? null;
          } catch { /* ignore */ }
          setMe({ id: u.id, display_name: name, email: u.email ?? null });
        }
      } catch { /* ignore */ }
    })();
  }, [isAdmin, userId]);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Employees cannot pick another doer — always self.
      const effectiveDoerId = isAdmin ? taskDoer : (taskDoers.find((d) => d.linked_user_id === userId)?.id ?? "");
      const doer = taskDoers.find((d) => d.id === effectiveDoerId) ?? null;
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignee_id: doer?.linked_user_id ?? (isAdmin ? null : userId),
        assignee_team_member_id: doer?.id ?? null,
        assignee_name: doer?.name ?? null,
        assignee_email: doer?.email ?? null,
        assigned_by_user_id: me.id,
        assigned_by_name: me.display_name ?? null,
        assigned_by_email: me.email ?? null,
        priority,
        difficulty,
        category: category || undefined,
        due_date: dueDate || undefined,
        proof_required: proofRequired,
      }, userId);
      onCreated();
    } finally { setSaving(false); }
  };


  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-[#F7F6F3] h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E8E5DE] flex items-center justify-between">
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-900">New task</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="ipc-input w-full" placeholder="What needs to get done?" />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="ipc-input w-full" />
          </Field>
          <Field label="Task Doer">
            {isAdmin ? (
              <TaskDoerPicker
                value={taskDoer}
                doers={taskDoers}
                size="md"
                testId="dg-create-taskdoer"
                onChange={(id) => setTaskDoer(id)}
              />
            ) : (
              <input
                readOnly
                disabled
                className="ipc-input w-full bg-stone-100 text-stone-700 cursor-not-allowed"
                value={taskDoers.find((d) => d.id === taskDoer)?.name ?? me.display_name ?? me.email ?? "You"}
                data-testid="dg-create-taskdoer-locked"
                title="Employees can only create tasks for themselves"
              />
            )}
          </Field>

          <div className="text-[11px] text-stone-500 -mt-2">
            Assigned by <strong>{me.display_name ?? me.email ?? "you"}</strong> (auto-captured).
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="ipc-input">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="ipc-input">
                {DIFFICULTIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="ipc-input w-full">
              <option value="">—</option>
              {(settings?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="ipc-input w-full" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} />
            Proof URL required to complete
          </label>
          <p className="text-xs text-stone-500">Due date is locked after saving. Only admins can reschedule.</p>
        </div>
        <div className="p-5 border-t border-[#E8E5DE] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900">Cancel</button>
          <button onClick={submit} disabled={saving || !title.trim()} className="bg-stone-900 text-[#C8A84B] px-4 py-2 rounded-lg text-sm hover:bg-stone-800 disabled:opacity-50">
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ task, userId, onClose, onDone }: { task: DelegationTask; userId: string; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState(task.proof_url ?? "");
  const [note, setNote] = useState(task.proof_note ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (task.proof_required && !url.trim()) {
      alert("Proof URL is required for this task.");
      return;
    }
    setSaving(true);
    try { await markCompleted(task.id, userId, url || undefined, note || undefined); onDone(); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E8E5DE]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E8E5DE]">
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-900">Complete task</h2>
          <p className="text-xs text-stone-500 mt-1">{task.title}</p>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Proof URL">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="ipc-input w-full" />
          </Field>
          <Field label="Note (optional)">
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="ipc-input w-full" />
          </Field>
        </div>
        <div className="p-5 border-t border-[#E8E5DE] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-stone-900 text-[#C8A84B] px-4 py-2 rounded-lg text-sm hover:bg-stone-800">
            {saving ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

