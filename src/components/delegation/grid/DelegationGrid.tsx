// Premium Google-Sheet-style grid for the Delegation Command Center.
// Single-file impl. Adds focus mode, column resize, density toggle,
// sticky columns, visibility menu, row menu, beforeunload guard,
// searchable assignee.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Plus, Trash2, RefreshCw, Search, Save,
  Maximize2, Minimize2, MoreHorizontal, Columns3, RotateCcw, ChevronDown,
  History, Coins, CheckCircle2, CalendarClock,
} from "lucide-react";
import { TaskActivityDrawer, TaskPointsDrawer } from "@/components/delegation/HistoryDrawers";
import ReviewQueue from "@/components/delegation/ReviewQueue";
import DueDateRequestDialog from "@/components/delegation/DueDateRequestDialog";
import TaskDoerPicker, { TaskDoerSelfPill } from "@/components/delegation/TaskDoerPicker";
import { Link } from "@tanstack/react-router";
import {
  TASK_TYPE_VALUES,
  TASK_TYPE_LABELS,
  TASK_TYPE_SHORT,
  badgeClassOfTaskType,
  matchesTaskTypeFilter,
  labelOfTaskType,
} from "@/lib/delegation/taskType";



import {
  addMasterOption,
  bulkCreateTasks,
  changeDueDate,
  getCustomColumns,
  getSettings,
  listAllTasks,
  listMyTasks,
  markRevision,
  setCustomColumns,
  softDeleteTask,
  updateTaskFields,
  markCompleted,
  submitForReview,
  type CustomColumn,
  type DelegationSettings,
  type DelegationTask,
  type Difficulty,
  type Priority,
  type SystemStage,
} from "@/services/delegation/delegationService";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import { listTaskDoers, resolveTaskDoerName, type TaskDoer } from "@/services/delegation/taskDoers";
import {
  isCoreColumn,
  moveColumn as moveColumnFn,
  parseTsv,
  removeColumn as removeColumnFn,
  toggleHidden as toggleHiddenFn,
} from "@/services/delegation/grid";
import {
  clampWidth,
  loadDensity, saveDensity,
  loadHidden, saveHidden, toggleHiddenKey, isHidable, resetHidden,
  loadWidths, saveWidths,
  loadLabels, saveLabels, setLabel,
  migrateLayoutPrefs,
  type Density,
} from "@/services/delegation/gridPrefs";
import {
  loadOrder, saveOrder, resetOrder, applyOrder, reorderKeys, isLockedFirst,
} from "@/services/delegation/columnOrder";
import { summarizeMine, summarizeAdmin } from "@/services/delegation/summary";
import { isDelegationOverdue } from "@/lib/delegation/overdueStatus";



type Scope = "mine" | "all";

interface Props {
  userId: string;
  isAdmin: boolean;
  scope: Scope;
}

type Row = DelegationTask & { __draft?: boolean; __dirty?: boolean };

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  type: "text" | "date" | "url" | "dropdown" | "user" | "taskdoer" | "number" | "actions" | "rowno" | "points" | "checkbox" | "tasktype";
  optionsKey?: "statuses" | "categories" | "delay_reasons" | "blocked_reasons" | "priorities" | "difficulties";
  options?: string[];
  custom?: boolean;
}


const STAGE_BY_LABEL = (settings: DelegationSettings | null, label: string): SystemStage => {
  const found = settings?.statuses.find((s) => s.label === label);
  return (found?.stage ?? "planned") as SystemStage;
};

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function newDraft(userId: string, selfDoer?: TaskDoer | null): Row {
  return {
    id: `draft-${crypto.randomUUID()}`,
    title: "", description: null,
    assignee_id: selfDoer?.linked_user_id ?? userId, created_by: userId,
    assignee_team_member_id: selfDoer?.id ?? null,
    assignee_name: selfDoer?.name ?? null,
    assignee_email: selfDoer?.email ?? null,
    assigned_by_user_id: userId,
    assigned_by_name: null,
    assigned_by_email: null,
    brand_id: null, department: null, category: null,
    priority: "medium", difficulty: "medium",
    status: "Planned", system_stage: "planned",
    due_date: todayISO(), due_date_locked: false,
    completed_at: null, proof_url: null, proof_note: null, proof_required: false,
    revision_count: 0, delay_reason: null, blocked_reason: null,
    waiting_on_user_id: null,
    revision_1_date: null, revision_2_date: null, final_date: null,
    follow_up_reminder: null, custom_fields: {}, is_deleted: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    __draft: true, __dirty: true,
  };
}


export default function DelegationGrid({ userId, isAdmin, scope }: Props) {
  useState(() => { migrateLayoutPrefs(); return 0; });
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [taskDoers, setTaskDoers] = useState<TaskDoer[]>([]);
  /** Logged-in user's profile (display_name + email) used to auto-fill "Assigned By". */
  const [me, setMe] = useState<{ id: string; display_name: string | null; email: string | null }>({ id: userId, display_name: null, email: null });
  /** Saved column order (list of keys). Row_no is always pinned first. */
  const [colOrder, setColOrderState] = useState<string[]>(() => loadOrder());
  const setColOrder = (next: string[]) => { setColOrderState(next); saveOrder(next); };
  const [dragColKey, setDragColKey] = useState<string | null>(null);

  const [settings, setSettings] = useState<DelegationSettings | null>(null);
  const [customCols, setCustomColsState] = useState<CustomColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [active, setActive] = useState<{ rowId: string; colKey: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterTaskType, setFilterTaskType] = useState<string>("");
  const [completeFor, setCompleteFor] = useState<Row | null>(null);
  const [activityFor, setActivityFor] = useState<Row | null>(null);
  const [pointsFor, setPointsFor] = useState<Row | null>(null);
  const [ddrFor, setDdrFor] = useState<Row | null>(null);
  const [showReviewQueue, setShowReviewQueue] = useState(false);

  // ⟵ NEW UX state
  const [focus, setFocus] = useState(false);
  const [density, setDensityState] = useState<Density>(() => loadDensity());
  const [widths, setWidthsState] = useState<Record<string, number>>(() => loadWidths());
  // Migration: drop any stale entries that hide essential core columns
  // (older sessions hid Revision 1 / Revision 2 / Final Date by mistake).
  const [hiddenKeys, setHiddenKeysState] = useState<string[]>(() => {
    const ESSENTIAL = new Set([
      "row_no","assignee_id","title","due_date",
      "revision_1_date","revision_2_date","final_date",
      "status","priority","actions",
    ]);
    const cleaned = loadHidden().filter((k) => !ESSENTIAL.has(k));
    if (cleaned.length !== loadHidden().length) saveHidden(cleaned);
    return cleaned;
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [headerMenuKey, setHeaderMenuKey] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [labelTick, setLabelTick] = useState(0);
  const [colWizard, setColWizard] = useState(false);


  const setDensity = (d: Density) => { setDensityState(d); saveDensity(d); };
  const setHidden = (next: string[]) => { setHiddenKeysState(next); saveHidden(next); };
  const setWidth = (key: string, w: number) => {
    setWidthsState((prev) => {
      const next = { ...prev, [key]: clampWidth(w) };
      saveWidths(next);
      return next;
    });
  };
  const resetWidths = () => { setWidthsState({}); saveWidths({}); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = scope === "mine" ? await listMyTasks(userId) : await listAllTasks({});
      setRows(data as Row[]);
    } finally { setLoading(false); }
  }, [scope, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    listAllUsersWithRoles().then(setUsers).catch(() => setUsers([]));
    listTaskDoers().then(setTaskDoers).catch(() => setTaskDoers([]));
    getSettings().then(setSettings).catch(() => setSettings(null));
    getCustomColumns().then(setCustomColsState).catch(() => setCustomColsState([]));
    // Capture "Assigned By" identity (logged-in user) for new task creation.
    void (async () => {
      try {
        const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
        const u = data.user;
        if (u) {
          // Try to enrich display_name from profiles or team-member match.
          let name: string | null = (u.user_metadata as any)?.display_name ?? null;
          try {
            const { data: prof } = await (await import("@/integrations/supabase/client")).supabase
              .from("profiles" as any).select("display_name").eq("id", u.id).maybeSingle();
            if ((prof as any)?.display_name) name = (prof as any).display_name;
          } catch { /* ignore */ }
          setMe({ id: u.id, display_name: name, email: u.email ?? null });
        }
      } catch { /* ignore */ }
    })();
  }, []);


  /* ─── unsaved-warning ─── */
  const dirtyCount = rows.filter((r) => r.__draft || r.__dirty).length;
  useEffect(() => {
    if (dirtyCount === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount]);

  /* ─── close row menu on outside click ─── */
  useEffect(() => {
    if (!rowMenu && !headerMenuKey) return;
    const h = () => { setRowMenu(null); setHeaderMenuKey(null); };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [rowMenu, headerMenuKey]);


  const labels = useMemo(() => loadLabels(), [labelTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns: ColumnDef[] = useMemo(() => {
    const lbl = (key: string, def: string) => labels[key] ?? def;
    const core: ColumnDef[] = [
      { key: "row_no", label: "#", width: 44, type: "rowno" },
      { key: "assignee_id", label: lbl("assignee_id", "Task Doer"), width: 200, type: "taskdoer" },
      { key: "title", label: lbl("title", "Task"), width: 300, type: "text" },
      { key: "due_date", label: lbl("due_date", "Due Date"), width: 190, type: "date" },
      { key: "revision_1_date", label: lbl("revision_1_date", "Revision 1"), width: 190, type: "date" },
      { key: "revision_2_date", label: lbl("revision_2_date", "Revision 2"), width: 190, type: "date" },
      { key: "final_date", label: lbl("final_date", "Final Date"), width: 190, type: "date" },
      { key: "revision_count", label: lbl("revision_count", "Revisions"), width: 80, type: "number" },
      { key: "task_type", label: lbl("task_type", "Type"), width: 130, type: "tasktype" },
      { key: "status", label: lbl("status", "Status"), width: 150, type: "dropdown", optionsKey: "statuses" },
      { key: "priority", label: lbl("priority", "Priority"), width: 110, type: "dropdown", optionsKey: "priorities" },
      { key: "difficulty", label: lbl("difficulty", "Difficulty"), width: 110, type: "dropdown", optionsKey: "difficulties" },
      { key: "category", label: lbl("category", "Category"), width: 140, type: "dropdown", optionsKey: "categories" },
      { key: "delay_reason", label: lbl("delay_reason", "Delay"), width: 150, type: "dropdown", optionsKey: "delay_reasons" },
      { key: "blocked_reason", label: lbl("blocked_reason", "Blocked"), width: 150, type: "dropdown", optionsKey: "blocked_reasons" },
      { key: "waiting_on_user_id", label: lbl("waiting_on_user_id", "Waiting On"), width: 160, type: "user" },
      { key: "proof_url", label: lbl("proof_url", "Proof URL"), width: 220, type: "url" },
      { key: "follow_up_reminder", label: lbl("follow_up_reminder", "Follow-up Reminder"), width: 170, type: "date" },
      { key: "points", label: lbl("points", "Points"), width: 80, type: "points" },
      { key: "actions", label: "", width: 170, type: "actions" },
    ];
    const customDefs: ColumnDef[] = customCols
      .filter((c) => !c.hidden)
      .map((c) => ({
        key: `custom.${c.key}`,
        label: lbl(`custom.${c.key}`, c.label),
        width: c.width ?? 140,
        type:
          c.type === "date" ? "date" :
          c.type === "url" ? "url" :
          c.type === "number" ? "number" :
          c.type === "dropdown" ? "dropdown" :
          c.type === "checkbox" ? "checkbox" : "text",
        options: c.options,
        custom: true,
      }));
    return [...core.slice(0, core.length - 1), ...customDefs, core[core.length - 1]];
  }, [customCols, labels]);

  // visible after user hide preferences and applying saved column order
  const visibleColumns = useMemo(() => {
    const visible = columns.filter((c) => !isHidable(c.key) || !hiddenKeys.includes(c.key));
    return applyOrder(visible, colOrder);
  }, [columns, hiddenKeys, colOrder]);


  const widthOf = (c: ColumnDef) => {
    const saved = widths[c.key] ?? c.width;
    return c.type === "date" ? Math.max(saved, 190) : saved;
  };
  const tableWidth = visibleColumns.reduce((total, c) => total + widthOf(c), 0);

  /* Keep all data columns in normal table flow; sticky columns caused overlap when scrolled. */
  const stickyClass = (key: string): string => {
    void key;
    return "";
  };
  const stickyStyle = (key: string) => {
    void key;
    return undefined;
  };

  /* ─── filters ─── */
  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.is_deleted && !r.__draft) return false;
      if (filterStage && r.system_stage !== filterStage) return false;
      if (filterPriority && r.priority !== filterPriority) return false;
      if (filterTaskType && !matchesTaskTypeFilter((r as any).task_type, filterTaskType)) return false;
      if (filterAssignee) {
        // filterAssignee holds a Task Doer (team member) id; match either the
        // team-member id directly or the linked auth user id on the row.
        const doer = taskDoers.find((d) => d.id === filterAssignee);
        const linkedUid = doer?.linked_user_id ?? null;
        const matches =
          r.assignee_team_member_id === filterAssignee
          || (linkedUid && r.assignee_id === linkedUid);
        if (!matches) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filterStage, filterPriority, filterAssignee, filterTaskType, taskDoers]);

  /* ─── cell edit / save ─── */
  const updateLocal = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, __dirty: true } : r)));
  }, []);

  const persistPatch = useCallback(async (row: Row, patch: Partial<DelegationTask>) => {
    if (!isAdmin && "due_date" in patch && row.due_date_locked && patch.due_date !== row.due_date) {
      alert("Due date is locked. Only an admin can reschedule.");
      await load();
      return;
    }
    setSaveState("saving");
    try {
      if ("due_date" in patch && isAdmin && row.due_date_locked) {
        await changeDueDate(row.id, userId, patch.due_date!, "grid edit");
      } else {
        await updateTaskFields(row.id, userId, patch);
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  }, [isAdmin, userId, load]);

  const selfDoer = taskDoers.find((d) => d.linked_user_id === userId) ?? null;

  const commitCell = useCallback(async (row: Row, colKey: string, raw: string) => {
    // Task Doer column writes 4 fields atomically (snapshot + team-member link
    // + linked auth user). Handles both draft and saved rows.
    if (colKey === "assignee_id") {
      // Employees cannot reassign tasks. Force self.
      const target = isAdmin ? raw : (selfDoer?.id ?? "");
      const doer = taskDoers.find((d) => d.id === target) ?? null;
      const patch: Partial<DelegationTask> = {
        assignee_team_member_id: doer?.id ?? null,
        assignee_name: doer?.name ?? null,
        assignee_email: doer?.email ?? null,
        assignee_id: doer?.linked_user_id ?? (isAdmin ? null : userId),
      };
      if (row.__draft) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
      } else {
        await persistPatch(row, patch);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch, __dirty: false } : r)));
      }
      return;
    }
    if (row.__draft) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? applyValue(r, colKey, raw) : r)));
      return;
    }

    const next = applyValue({ ...row }, colKey, raw);
    if (colKey === "status" && settings) {
      const stage = STAGE_BY_LABEL(settings, raw);
      if (stage === "completed" && row.system_stage !== "completed") {
        setCompleteFor({ ...row, status: raw, system_stage: stage });
        return;
      }
      if (stage === "revision" && row.system_stage !== "revision") {
        await markRevision(row.id, userId, "grid status change");
        await load();
        return;
      }
      await persistPatch(row, { status: raw, system_stage: stage });
    } else if (colKey === "revision_1_date" || colKey === "revision_2_date") {
      await persistPatch(row, { [colKey]: raw || null } as any);
      if (isAdmin && raw && (row as any)[colKey] !== raw) {
        await markRevision(row.id, userId, `${colKey} set`);
      }
    } else if (colKey.startsWith("custom.")) {
      const k = colKey.slice("custom.".length);
      const cf = { ...(row.custom_fields ?? {}), [k]: raw };
      await persistPatch(row, { custom_fields: cf } as any);
    } else if (colKey === "due_date") {
      await persistPatch(row, { due_date: raw || null });
    } else {
      await persistPatch(row, { [colKey]: raw || null } as any);
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...next, __dirty: false } : r)));
  }, [settings, persistPatch, userId, load, isAdmin, taskDoers]);

  /* ─── add / save / delete ─── */
  const addRow = (n = 1) => setRows((p) => [...p, ...Array.from({ length: n }, () => newDraft(userId, isAdmin ? null : selfDoer))]);

  const insertRow = (atId: string, where: "above" | "below" | "duplicate") => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === atId);
      if (idx < 0) return prev;
      const draft = newDraft(userId, isAdmin ? null : selfDoer);
      if (where === "duplicate") {
        const src = prev[idx];
        Object.assign(draft, {
          title: src.title, category: src.category, priority: src.priority,
          difficulty: src.difficulty, due_date: src.due_date,
          // Preserve doer only for admins; employees can't reassign.
          ...(isAdmin ? {
            assignee_id: src.assignee_id,
            assignee_team_member_id: src.assignee_team_member_id ?? null,
            assignee_name: src.assignee_name ?? null,
            assignee_email: src.assignee_email ?? null,
          } : {}),
        });
      }

      const at = where === "above" ? idx : idx + 1;
      const next = [...prev];
      next.splice(at, 0, draft);
      return next;
    });
  };

  const saveAllDrafts = async () => {
    const allDrafts = rows.filter((r) => r.__draft);
    const drafts = allDrafts.filter((r) => r.title.trim().length > 0);
    if (drafts.length === 0) {
      if (allDrafts.length > 0) alert(`Cannot save ${allDrafts.length} draft row(s) — each needs a Task title.`);
      else alert("Nothing to save — all rows already saved.");
      return;
    }
    // Admin: require a Task Doer on every new task. Employees auto-fill self,
    // so this guard only ever triggers for admin-created drafts.
    if (isAdmin) {
      const missing = drafts.filter((d) => !d.assignee_team_member_id && !d.assignee_id);
      if (missing.length > 0) {
        alert(`Please choose a task doer before saving ${missing.length === 1 ? "this task" : `these ${missing.length} tasks`}.`);
        return;
      }
    }
    const skipped = allDrafts.length - drafts.length;

    setSaveState("saving");
    try {
      const created = await bulkCreateTasks(
        drafts.map((d) => ({
          title: d.title.trim(),
          description: d.description ?? undefined,
          assignee_id: d.assignee_id ?? null,
          assignee_team_member_id: d.assignee_team_member_id ?? null,
          assignee_name: d.assignee_name ?? null,
          assignee_email: d.assignee_email ?? null,
          assigned_by_user_id: me.id,
          assigned_by_name: me.display_name ?? null,
          assigned_by_email: me.email ?? null,
          category: d.category ?? undefined,
          priority: d.priority,
          difficulty: d.difficulty,
          due_date: d.due_date ?? undefined,
          proof_required: d.proof_required,
        })),
        userId,
      );

      setRows((prev) => {
        const kept = prev.filter((r) => !r.__draft || r.title.trim().length === 0);
        return [...kept, ...(created as Row[])];
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      if (skipped > 0) alert(`Saved ${created.length} row(s). ${skipped} skipped (missing Task title).`);
    } catch (e) {
      console.error(e);
      setSaveState("error");
      alert(`Save failed: ${(e as Error).message ?? "unknown error"}. Your data is still here — try again.`);
    }
  };

  const deleteRow = async (row: Row) => {
    if (row.__draft) { setRows((p) => p.filter((r) => r.id !== row.id)); return; }
    if (!isAdmin) { alert("Only an admin can delete saved rows."); return; }
    if (!confirm("Soft-delete this task?")) return;
    await softDeleteTask(row.id, userId);
    await load();
  };

  /* ─── paste ─── */
  const onPaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const rowsTsv = parseTsv(text);
    if (rowsTsv.length === 0) return;
    const drafts: Row[] = rowsTsv.map((cells) => {
      const d = newDraft(userId);
      const [title, due, prio, cat] = cells;
      if (title) d.title = title;
      if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) d.due_date = due;
      if (prio && (PRIORITIES as readonly string[]).includes(prio.toLowerCase())) d.priority = prio.toLowerCase() as Priority;
      if (cat) d.category = cat;
      return d;
    });
    setRows((prev) => [...prev, ...drafts]);
  };

  /* ─── custom columns ─── */
  const addCustomColumnWith = async (input: { label: string; type: CustomColumn["type"]; options?: string[] }) => {
    const label = input.label.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) return;
    if (customCols.some((c) => c.key === key)) { alert("A column with that name already exists."); return; }
    const next: CustomColumn[] = [
      ...customCols,
      { key, label, type: input.type, width: 140, options: input.options },
    ];
    setCustomColsState(next);
    if (isAdmin) await setCustomColumns(next);
  };
  const moveCol = async (key: string, dir: -1 | 1) => {
    const next = moveColumnFn(customCols, key.replace(/^custom\./, ""), dir);
    setCustomColsState(next);
    if (isAdmin) await setCustomColumns(next);
  };
  const toggleHiddenCol = async (key: string) => {
    const next = toggleHiddenFn(customCols, key.replace(/^custom\./, ""));
    setCustomColsState(next);
    if (isAdmin) await setCustomColumns(next);
  };
  /** Rename any column header label. Core columns store override in localStorage
   * (internal field key unchanged); custom columns update the stored CustomColumn.label. */
  const renameColumnLabel = async (key: string) => {
    const current = columns.find((c) => c.key === key)?.label ?? key;
    const label = prompt("Rename column label", current);
    if (label == null) return;
    if (key.startsWith("custom.")) {
      const bare = key.slice("custom.".length);
      const next = customCols.map((c) => (c.key === bare ? { ...c, label: label.trim() || c.label } : c));
      setCustomColsState(next);
      if (isAdmin) await setCustomColumns(next);
    } else {
      const next = setLabel(loadLabels(), key, label);
      saveLabels(next);
      setLabelTick((t) => t + 1);
    }
  };
  const deleteCustomCol = async (key: string) => {
    if (!key.startsWith("custom.")) { alert("Core columns cannot be deleted."); return; }
    const bare = key.slice("custom.".length);
    if (isCoreColumn(bare)) { alert("Core columns cannot be deleted."); return; }
    if (!confirm(`Delete column "${bare}"?`)) return;
    const next = removeColumnFn(customCols, bare);
    setCustomColsState(next);
    if (isAdmin) await setCustomColumns(next);
  };
  void toggleHiddenCol;


  /* ─── resize ─── */
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const startResize = (e: React.MouseEvent, c: ColumnDef) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { key: c.key, startX: e.clientX, startW: widthOf(c) };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setWidth(d.key, d.startW + (ev.clientX - d.startX));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* ─── render ─── */
  const saveDot =
    saveState === "saving" ? "#d97706" :
    saveState === "saved" ? "#16a34a" :
    saveState === "error" ? "#dc2626" :
    dirtyCount > 0 ? "#a16207" : "#9ca3af";

  const summarySource = rows.filter((r) => !r.__draft);
  const mineSum = summarizeMine(summarySource as any, userId);
  const adminSum = summarizeAdmin(summarySource as any);

  return (
    <div className={`dg-root dg-density-${density} ${focus ? "dg-focus" : ""}`} onPaste={onPaste}>
      {!focus && (
        <div className="dg-summary" data-testid="dg-summary">
          {scope === "mine" || !isAdmin ? (
            <>
              <SummaryCard label="My Tasks Today" value={mineSum.todayCount} />
              <SummaryCard label="Pending" value={mineSum.pendingCount} tone={mineSum.pendingCount > 0 ? "warn" : undefined} />
              <SummaryCard label="Overdue" value={mineSum.overdueCount} tone={mineSum.overdueCount > 0 ? "bad" : undefined} />
            </>
          ) : (
            <>
              <SummaryCard label="Active Tasks" value={adminSum.activeCount} />
              <SummaryCard label="Due Today" value={adminSum.dueTodayCount} tone={adminSum.dueTodayCount > 0 ? "warn" : undefined} />
              <SummaryCard label="Overdue" value={adminSum.overdueCount} tone={adminSum.overdueCount > 0 ? "bad" : undefined} />
              <SummaryCard label="Completed Today" value={adminSum.completedTodayCount} tone="good" />
            </>
          )}
        </div>
      )}
      {/* toolbar */}
      <div className="dg-toolbar">

        <div className="dg-search">
          <Search className="w-3.5 h-3.5 text-stone-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="bg-transparent outline-none text-sm w-44"
          />
        </div>
        <select className="dg-filter" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">All statuses</option>
          {["planned","in_progress","submitted","completed","revision","blocked","shifted","cancelled"].map((s) => (
            <option key={s} value={s}>{s.replace("_"," ")}</option>
          ))}
        </select>
        <select className="dg-filter" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="dg-filter"
          value={filterTaskType}
          onChange={(e) => setFilterTaskType(e.target.value)}
          data-testid="dg-filter-tasktype"
          title="Filter by task type"
        >
          <option value="">All task types</option>
          {TASK_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
          ))}
        </select>
        {isAdmin && (
          <div style={{ minWidth: 200 }}>
            <TaskDoerPicker
              value={filterAssignee}
              doers={taskDoers}
              placeholder="All task doers"
              testId="dg-filter-taskdoer"
              onChange={(id) => setFilterAssignee(id === filterAssignee ? "" : id)}
            />
          </div>
        )}


        <button className="dg-btn-ghost" onClick={() => { setSearch(""); setFilterStage(""); setFilterPriority(""); setFilterAssignee(""); setFilterTaskType(""); }}>
          Clear
        </button>

        <div className="flex-1" />

        <div className="dg-save-state" data-testid="dg-save-state">
          <span className="dot" style={{ background: saveDot }} />
          {saveState === "saving" && <span className="text-amber-700">Saving…</span>}
          {saveState === "saved" && <span className="text-emerald-700">Saved</span>}
          {saveState === "error" && <span className="text-rose-700">Save error</span>}
          {saveState === "idle" && (dirtyCount > 0
            ? <span className="text-amber-800">{dirtyCount} unsaved</span>
            : <span className="text-stone-500">All saved</span>)}
        </div>

        {/* density */}
        <select
          className="dg-filter"
          value={density}
          onChange={(e) => setDensity(e.target.value as Density)}
          title="Row density"
          data-testid="dg-density"
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>

        {/* column visibility */}
        <div className="dg-menu">
          <button className="dg-btn" onClick={() => setShowColMenu((v) => !v)} data-testid="dg-cols-menu">
            <Columns3 className="w-3.5 h-3.5" /> Columns
          </button>
          {showColMenu && (
            <div className="dg-menu-pop" onMouseLeave={() => setShowColMenu(false)}>
              <div className="dg-menu-section">Show / hide columns</div>
              {columns.map((c) => {
                const protectedCol = !isHidable(c.key);
                return (
                  <label key={c.key} className={protectedCol ? "protected" : ""}>
                    <input
                      type="checkbox"
                      disabled={protectedCol}
                      checked={!hiddenKeys.includes(c.key)}
                      onChange={() => !protectedCol && setHidden(toggleHiddenKey(hiddenKeys, c.key))}
                    />
                    <span>{c.label || c.key}</span>
                    {protectedCol && <span className="core-tag">Core</span>}
                    {c.custom && <span className="core-tag">Custom</span>}
                  </label>
                );
              })}
              <div className="dg-menu-section" style={{ borderTop: "1px solid #F1EAD8", marginTop: 4 }}>Layout</div>
              <button className="dg-btn-ghost" onClick={() => { resetHidden(); setHiddenKeysState([]); }} style={{ width: "100%", justifyContent: "flex-start" }} data-testid="dg-show-all">
                <RotateCcw className="w-3.5 h-3.5" /> Show all columns
              </button>
              <button className="dg-btn-ghost" onClick={resetWidths} style={{ width: "100%", justifyContent: "flex-start" }}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset column widths
              </button>
              <button
                className="dg-btn-ghost"
                data-testid="dg-reset-order"
                onClick={() => { resetOrder(); setColOrderState([]); }}
                style={{ width: "100%", justifyContent: "flex-start" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset column order
              </button>

              <button
                className="dg-btn-ghost"
                data-testid="dg-reset-layout"
                style={{ width: "100%", justifyContent: "flex-start", color: "#A23B2D", fontWeight: 600 }}
                onClick={() => {
                  resetHidden();
                  setHiddenKeysState([]);
                  resetWidths();
                  resetOrder();
                  setColOrderState([]);
                  saveLabels({});
                  setLabelTick((t) => t + 1);
                  setHeaderMenuKey(null);
                }}

              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset sheet layout
              </button>
            </div>
          )}

        </div>

        {isAdmin && (
          <button className="dg-btn" onClick={() => setColWizard(true)} data-testid="dg-add-col">
            <Plus className="w-3.5 h-3.5" /> Column
          </button>
        )}
        <button className="dg-btn-primary" onClick={() => addRow(1)} data-testid="dg-add-row"><Plus className="w-3.5 h-3.5" /> Add row</button>
        <button className="dg-btn-ghost" onClick={() => addRow(5)}>+5 rows</button>
        <button className="dg-btn-primary" onClick={saveAllDrafts} data-testid="dg-save-all"><Save className="w-3.5 h-3.5" /> Save all</button>
        {isAdmin && (
          <button className="dg-btn-accent" onClick={() => setShowReviewQueue(true)} data-testid="dg-review-queue-btn">
            <CheckCircle2 className="w-3.5 h-3.5" /> Review queue
          </button>
        )}
        {isAdmin && (
          <Link
            to="/settings/recurring-tasks"
            className="dg-btn-ghost"
            data-testid="dg-manage-recurring"
            title="Manage Recurring Daily Tasks"
          >
            Manage Recurring Daily Tasks
          </Link>
        )}

        <button className="dg-btn-accent" onClick={() => setFocus((v) => !v)} title={focus ? "Exit focus mode" : "Expand sheet"} data-testid="dg-focus">
          {focus ? <><Minimize2 className="w-3.5 h-3.5" /> Exit Focus</> : <><Maximize2 className="w-3.5 h-3.5" /> Expand</>}
        </button>
      </div>

      {/* grid */}
      <div className="dg-scroll">
        <table className="dg-table" data-testid="delegation-grid" style={{ width: tableWidth, minWidth: tableWidth }}>
          <colgroup>
            {visibleColumns.map((c) => (
              <col key={c.key} style={{ width: widthOf(c), minWidth: widthOf(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((c) => {
                const locked = isLockedFirst(c.key);
                return (
                <th
                  key={c.key}
                  style={{
                    width: widthOf(c), minWidth: widthOf(c), maxWidth: widthOf(c),
                    ...(stickyStyle(c.key) ?? {}),
                    cursor: locked ? undefined : "grab",
                    opacity: dragColKey && dragColKey === c.key ? 0.5 : 1,
                  }}
                  className={`${c.key === "row_no" ? "dg-th-rowno" : "dg-th"} ${stickyClass(c.key)}`}
                  draggable={!locked}
                  data-testid={`dg-th-${c.key}`}
                  onDragStart={(e) => {
                    if (locked) { e.preventDefault(); return; }
                    setDragColKey(c.key);
                    e.dataTransfer.effectAllowed = "move";
                    try { e.dataTransfer.setData("text/plain", c.key); } catch { /* ignore */ }
                  }}
                  onDragOver={(e) => {
                    if (!dragColKey || dragColKey === c.key || locked) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    if (!dragColKey || dragColKey === c.key || locked) return;
                    e.preventDefault();
                    const keys = visibleColumns.map((x) => x.key);
                    const from = keys.indexOf(dragColKey);
                    const to = keys.indexOf(c.key);
                    if (from < 0 || to < 0) { setDragColKey(null); return; }
                    const nextKeys = reorderKeys(keys, from, to);
                    setColOrder(nextKeys);
                    setDragColKey(null);
                  }}
                  onDragEnd={() => setDragColKey(null)}
                >

                  <div className="flex items-center gap-1 group relative">
                    <span className="truncate flex-1">{c.label}</span>
                    {(c.custom || isHidable(c.key)) && (
                      <button
                        type="button"
                        title="Column options"
                        className="dg-icon dg-col-menu-btn"
                        data-testid={`dg-col-menu-${c.key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeaderMenuKey((k) => (k === c.key ? null : c.key));
                        }}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                    {headerMenuKey === c.key && (
                      <div
                        className="dg-row-menu dg-header-menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => { void renameColumnLabel(c.key); setHeaderMenuKey(null); }}>Rename label</button>
                        {c.custom && (
                          <>
                            <button onClick={() => { void moveCol(c.key, -1); setHeaderMenuKey(null); }}>Move left</button>
                            <button onClick={() => { void moveCol(c.key, 1); setHeaderMenuKey(null); }}>Move right</button>
                          </>
                        )}
                        {isHidable(c.key) && (
                          <button onClick={() => { setHidden(toggleHiddenKey(hiddenKeys, c.key)); setHeaderMenuKey(null); }}>Hide column</button>
                        )}
                        {c.custom ? (
                          <button className="danger" onClick={() => { void deleteCustomCol(c.key); setHeaderMenuKey(null); }} data-testid={`dg-col-delete-${c.key}`}>Delete column</button>
                        ) : (
                          <button disabled style={{ color: "#a8a29e", cursor: "not-allowed" }}>Core (protected)</button>
                        )}
                      </div>
                    )}
                  </div>

                  {c.type !== "rowno" && c.type !== "actions" && (
                    <span
                      className="dg-resize"
                      onMouseDown={(e) => startResize(e, c)}
                      data-testid={`dg-resize-${c.key}`}
                    />
                  )}
                </th>
                );
              })}

            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleColumns.length} className="dg-empty">Loading…</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="dg-empty">No rows. Click <em>Add row</em> to begin.</td></tr>
            ) : (
              visibleRows.map((r, i) => (
                <tr key={r.id} className={r.__draft ? "dg-row dg-row-draft" : "dg-row"}>
                  {visibleColumns.map((c) => (
                    <Cell
                      key={c.key}
                      row={r}
                      col={c}
                      width={widthOf(c)}
                      stickyStyle={stickyStyle(c.key)}
                      stickyClass={stickyClass(c.key)}
                      index={i + 1}
                      active={active?.rowId === r.id && active?.colKey === c.key}
                      isAdmin={isAdmin}
                      userId={userId}
                      users={users}
                      taskDoers={taskDoers}

                      settings={settings}
                      onActivate={() => setActive({ rowId: r.id, colKey: c.key })}
                      onCommit={(v) => commitCell(r, c.key, v)}
                      onLocal={(v) => updateLocal(r.id, applyValueDraftOnly(r, c.key, v))}
                      onDelete={() => deleteRow(r)}
                      onComplete={() => setCompleteFor(r)}
                      onActivity={() => setActivityFor(r)}
                      onPoints={() => setPointsFor(r)}
                      onRequestDueDate={() => setDdrFor(r)}
                      onRowMenu={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setRowMenu({ rowId: r.id, x: rect.right - 180, y: rect.bottom + 4 });
                      }}
                      onAddOption={async (val) => {
                        if (!isAdmin || !c.optionsKey) return;
                        if (c.optionsKey === "categories" || c.optionsKey === "delay_reasons" || c.optionsKey === "blocked_reasons") {
                          const next = await addMasterOption(c.optionsKey, val);
                          setSettings(next);
                        }
                      }}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row menu */}
      {rowMenu && (
        <div className="dg-row-menu" style={{ left: rowMenu.x, top: rowMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { insertRow(rowMenu.rowId, "above"); setRowMenu(null); }}>Insert row above</button>
          <button onClick={() => { insertRow(rowMenu.rowId, "below"); setRowMenu(null); }}>Insert row below</button>
          <button onClick={() => { insertRow(rowMenu.rowId, "duplicate"); setRowMenu(null); }}>Duplicate row</button>
          {(() => {
            const r = rows.find((x) => x.id === rowMenu.rowId);
            if (!r) return null;
            const canDel = isAdmin || r.__draft;
            return canDel ? (
              <button className="danger" onClick={() => { void deleteRow(r); setRowMenu(null); }}>Delete row</button>
            ) : null;
          })()}
        </div>
      )}

      {completeFor && (
        <CompleteDialog
          row={completeFor}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setCompleteFor(null)}
          onDone={async () => { setCompleteFor(null); await load(); }}
        />
      )}
      {activityFor && (
        <TaskActivityDrawer
          taskId={activityFor.id}
          taskTitle={activityFor.title || "Untitled"}
          onClose={() => setActivityFor(null)}
        />
      )}
      {pointsFor && (
        <TaskPointsDrawer
          taskId={pointsFor.id}
          taskTitle={pointsFor.title || "Untitled"}
          onClose={() => setPointsFor(null)}
        />
      )}
      {ddrFor && (
        <DueDateRequestDialog
          taskId={ddrFor.id}
          userId={userId}
          currentDueDate={ddrFor.due_date}
          onClose={() => setDdrFor(null)}
          onSubmitted={() => { setDdrFor(null); alert("Request sent to a manager for approval."); }}
        />
      )}
      {showReviewQueue && (
        <ReviewQueue
          userId={userId}
          onClose={() => setShowReviewQueue(false)}
          onChanged={() => { void load(); }}
        />
      )}
      {colWizard && (
        <ColumnWizard
          onClose={() => setColWizard(false)}
          onCreate={async (input) => { await addCustomColumnWith(input); setColWizard(false); }}
        />
      )}
    </div>
  );
}

/* ─────────── helpers ─────────── */

function applyValue(row: Row, colKey: string, raw: string): Row {
  if (colKey.startsWith("custom.")) {
    const k = colKey.slice("custom.".length);
    return { ...row, custom_fields: { ...(row.custom_fields ?? {}), [k]: raw }, __dirty: true };
  }
  return { ...row, [colKey]: raw || null, __dirty: true } as Row;
}
function applyValueDraftOnly(row: Row, colKey: string, raw: string): Partial<Row> {
  if (colKey.startsWith("custom.")) {
    const k = colKey.slice("custom.".length);
    return { custom_fields: { ...(row.custom_fields ?? {}), [k]: raw } };
  }
  return { [colKey]: raw || null } as Partial<Row>;
}

/* ─────────── Cell ─────────── */

interface CellProps {
  row: Row;
  col: ColumnDef;
  width: number;
  stickyStyle?: CSSProperties;
  stickyClass: string;
  index: number;
  active: boolean;
  isAdmin: boolean;
  userId: string;
  users: AdminUserRow[];
  taskDoers: TaskDoer[];

  settings: DelegationSettings | null;
  onActivate: () => void;
  onCommit: (val: string) => void | Promise<void>;
  onLocal: (val: string) => void;
  onDelete: () => void;
  onComplete: () => void;
  onActivity: () => void;
  onPoints: () => void;
  onRequestDueDate: () => void;
  onRowMenu: (e: React.MouseEvent) => void;
  onAddOption: (val: string) => void;
}

function Cell({ row, col, width, stickyStyle, stickyClass, index, active, isAdmin, userId, users, taskDoers, settings, onActivate, onCommit, onLocal, onDelete, onComplete, onActivity, onPoints, onRequestDueDate, onRowMenu, onAddOption }: CellProps) {
  const baseStyle = { width, minWidth: width, maxWidth: width, ...stickyStyle };
  if (col.type === "rowno") {
    return <td className={`dg-cell dg-cell-rowno ${stickyClass}`} style={baseStyle}>{index}</td>;
  }
  if (col.type === "actions") {
    const canDelete = isAdmin || row.__draft;
    const canComplete = row.system_stage !== "completed" && !row.__draft;
    const isSaved = !row.__draft;
    const canRequestDate = isSaved && !isAdmin && row.assignee_id === userId && row.due_date_locked && row.system_stage !== "completed";
    return (
      <td className="dg-cell dg-cell-actions" style={baseStyle}>
        <div className="flex items-center gap-1 justify-center">
          {canComplete && (
            <button title={!isAdmin && row.assignee_id === userId ? "Submit for review" : "Complete"} onClick={onComplete} className="dg-icon text-emerald-700" data-testid="dg-row-complete" data-task-id={row.id}><RefreshCw className="w-3.5 h-3.5" /></button>
          )}
          {canRequestDate && (
            <button title="Request due-date change" onClick={onRequestDueDate} className="dg-icon text-amber-700 hover:text-amber-900" data-testid="dg-request-date"><CalendarClock className="w-3.5 h-3.5" /></button>
          )}
          {isSaved && (
            <button title="Activity history" onClick={onActivity} className="dg-icon text-stone-600 hover:text-stone-900" data-testid="dg-activity" data-task-id={row.id}><History className="w-3.5 h-3.5" /></button>
          )}
          {isSaved && (
            <button title="Points breakdown" onClick={onPoints} className="dg-icon text-amber-700 hover:text-amber-900" data-testid="dg-points" data-task-id={row.id}><Coins className="w-3.5 h-3.5" /></button>
          )}
          {canDelete && (
            <button title="Delete" onClick={onDelete} className="dg-icon text-rose-600" data-testid="dg-del"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
          <button title="Row menu" onClick={onRowMenu} className="dg-icon dg-row-menu-trigger" data-testid="dg-row-menu"><MoreHorizontal className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    );
  }
  if (col.type === "points") {
    return <td className="dg-cell dg-cell-points" style={baseStyle}>—</td>;
  }
  if (col.type === "tasktype") {
    const current = ((row as any).task_type ?? "standup") as "recurring_daily" | "standup" | "ad_hoc";
    if (!isAdmin) {
      return (
        <td className={cellClass(active, stickyClass)} style={baseStyle}>
          <div className="px-2">
            <span className={`inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${badgeClassOfTaskType(current)}`}
                  data-testid="dg-tasktype-badge">
              {TASK_TYPE_SHORT[current]}
            </span>
          </div>
        </td>
      );
    }
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <div className="px-2 flex items-center gap-2">
          <span className={`inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${badgeClassOfTaskType(current)}`}
                data-testid="dg-tasktype-badge">
            {TASK_TYPE_SHORT[current]}
          </span>
          <select
            value={current}
            onChange={(e) => { onLocal(e.target.value); void onCommit(e.target.value); }}
            className="dg-input"
            style={{ flex: 1, minWidth: 0 }}
            data-testid="dg-tasktype-select"
          >
            {TASK_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </td>
    );
  }
  if (col.type === "number") {
    return <td className="dg-cell text-center text-stone-700" style={baseStyle}>{(row as any)[col.key] ?? 0}</td>;
  }

  const raw = col.key.startsWith("custom.")
    ? String((row.custom_fields ?? {})[col.key.slice("custom.".length)] ?? "")
    : ((row as any)[col.key] ?? "") + "";

  if (col.type === "taskdoer") {
    // Selected team-member id wins; fall back to a team member matching the
    // legacy auth assignee_id, so existing rows continue to render correctly.
    const tmId = row.assignee_team_member_id ?? null;
    const linkedFromAuth = !tmId && row.assignee_id
      ? (taskDoers.find((d) => d.linked_user_id === row.assignee_id)?.id ?? "")
      : "";
    const value = tmId ?? linkedFromAuth ?? "";
    const editable = isAdmin;
    if (!editable) {
      const name = resolveTaskDoerName(row as any, taskDoers, users as any);
      const isSelf = !!value && taskDoers.find((d) => d.id === value)?.linked_user_id === userId;
      return (
        <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
          <div className="px-1 truncate" data-testid="dg-taskdoer-label">
            <TaskDoerSelfPill name={name === "—" ? "You" : name} subtext={isSelf ? "Assigned to me" : "My task"} />
          </div>
        </td>
      );
    }
    // Admin: saved row without doer → "Task doer needed" (legacy-friendly pill)
    const legacyUnassigned = !row.__draft && !value;
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <div className="px-2 py-0.5">
          <TaskDoerPicker
            value={value}
            doers={taskDoers}
            testId="dg-taskdoer-select"
            legacyUnassigned={legacyUnassigned}
            autoFocus={active}
            onChange={(id) => { onLocal(id); void onCommit(id); }}
          />
        </div>
      </td>
    );
  }


  if (col.type === "user") {

    const value = raw;
    const editable = isAdmin || col.key !== "assignee_id" || row.__draft;
    const listId = `dg-users-${col.key}`;
    const selected = users.find((u) => u.id === value);
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        {editable ? (
          <>
            <input
              className="dg-input"
              list={listId}
              defaultValue={selected?.display_name ?? ""}
              placeholder="Type a name…"
              autoFocus={active}
              onBlur={(e) => {
                const txt = e.target.value.trim().toLowerCase();
                if (!txt) { onLocal(""); void onCommit(""); return; }
                const match = users.find((u) =>
                  (u.display_name || "").toLowerCase() === txt || u.id === txt,
                );
                if (match) { onLocal(match.id); void onCommit(match.id); }
                else { e.target.value = selected?.display_name ?? ""; }
              }}
            />
            <datalist id={listId}>
              {users.map((u) => (
                <option key={u.id} value={u.display_name || u.id}>
                  {(u.roles?.[0] ?? "").replace("_", " ")}
                </option>
              ))}
            </datalist>
          </>
        ) : (
          <span className="px-2 text-stone-700 truncate inline-block w-full">{selected?.display_name ?? "—"}</span>
        )}
      </td>
    );
  }

  if (col.type === "checkbox") {
    const v = raw === "true" || raw === "1";
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox" checked={v}
            onChange={(e) => { const nv = e.target.checked ? "true" : "false"; onLocal(nv); void onCommit(nv); }}
          />
        </div>
      </td>
    );
  }

  if (col.type === "dropdown") {
    const options = col.optionsKey ? optionsFor(col.optionsKey, settings) : (col.options ?? []);
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <select
          value={raw}
          autoFocus={active}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__add__") {
              const nv = prompt("Add new option:");
              if (nv) { onAddOption(nv); onLocal(nv); void onCommit(nv); }
              return;
            }
            onLocal(v); void onCommit(v);
          }}
          className="dg-input"
        >
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          {isAdmin && col.optionsKey && col.optionsKey !== "statuses" && col.optionsKey !== "priorities" && col.optionsKey !== "difficulties" && (
            <option value="__add__">+ Add new…</option>
          )}
        </select>
      </td>
    );
  }

  if (col.type === "date") {
    const locked = col.key === "due_date" && row.due_date_locked && !isAdmin && !row.__draft;
    const overdue =
      col.key === "due_date" &&
      !row.__draft &&
      isDelegationOverdue({
        due_date: (row as any).due_date ?? null,
        system_stage: (row as any).system_stage,
        is_deleted: (row as any).is_deleted ?? false,
      });
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date" value={raw || ""} disabled={locked}
            onChange={(e) => onLocal(e.target.value)}
            onBlur={(e) => { void onCommit(e.target.value); }}
            onKeyDown={cellKeyDown}
            className="dg-input"
            autoFocus={active}
            data-testid={col.key === "due_date" ? "dg-due" : undefined}
          />
          {overdue && (
            <span
              data-testid="dg-overdue"
              title="Overdue"
              className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200"
            >
              Overdue
            </span>
          )}
        </div>
      </td>
    );
  }

  if (col.type === "url") {
    return (
      <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
        <input
          type="url" value={raw}
          onChange={(e) => onLocal(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && !/^https?:\/\//i.test(v)) { alert("URL must start with http:// or https://"); return; }
            void onCommit(v);
          }}
          onKeyDown={cellKeyDown} className="dg-input" placeholder="https://…"
          autoFocus={active}
        />
      </td>
    );
  }

  return (
    <td className={cellClass(active, stickyClass)} style={baseStyle} onClick={onActivate}>
      <input
        value={raw}
        onChange={(e) => onLocal(e.target.value)}
        onBlur={(e) => void onCommit(e.target.value)}
        onKeyDown={cellKeyDown}
        className="dg-input"
        autoFocus={active}
        placeholder={col.key === "title" ? "Enter task name…" : ""}
        data-testid={col.key === "title" ? "dg-title" : undefined}
      />
    </td>
  );
}

function optionsFor(key: NonNullable<ColumnDef["optionsKey"]>, settings: DelegationSettings | null): string[] {
  if (!settings) {
    if (key === "priorities") return PRIORITIES;
    if (key === "difficulties") return DIFFICULTIES;
    return [];
  }
  if (key === "statuses") return settings.statuses.map((s) => s.label);
  if (key === "categories") return settings.categories ?? [];
  if (key === "delay_reasons") return settings.delay_reasons ?? [];
  if (key === "blocked_reasons") return settings.blocked_reasons ?? [];
  if (key === "priorities") return PRIORITIES;
  if (key === "difficulties") return DIFFICULTIES;
  return [];
}

function cellClass(active: boolean, sticky: string) {
  return "dg-cell" + (active ? " dg-cell-active" : "") + (sticky ? " " + sticky : "");
}

function cellKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const target = e.currentTarget;
  const move = (dx: number, dy: number) => {
    const td = target.closest("td");
    const tr = td?.parentElement as HTMLElement | null;
    if (!td || !tr) return;
    const cellIdx = Array.from(tr.children).indexOf(td);
    const trNext = dy === 0 ? tr : (dy > 0 ? tr.nextElementSibling : tr.previousElementSibling);
    if (!trNext) return;
    const targetCell = (trNext.children[cellIdx + dx] as HTMLElement) ?? null;
    const input = targetCell?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
    input?.focus();
  };
  if (e.key === "Enter") { e.preventDefault(); target.blur(); move(0, 1); }
  else if (e.key === "Escape") { e.preventDefault(); target.blur(); }
}

/* ─────────── Complete dialog ─────────── */

function CompleteDialog({ row, userId, isAdmin, onClose, onDone }: { row: Row; userId: string; isAdmin: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [url, setUrl] = useState(row.proof_url ?? "");
  const [note, setNote] = useState(row.proof_note ?? "");
  const [saving, setSaving] = useState(false);
  // Employee assignee → submit for review. Admin/manager → direct complete.
  const isEmployeeSubmit = !isAdmin && row.assignee_id === userId;
  const label = isEmployeeSubmit
    ? (row.system_stage === "revision" ? "Resubmit for review" : "Submit for review")
    : "Mark complete";
  const submit = async () => {
    if (row.proof_required && !url.trim()) { alert("Proof URL is required."); return; }
    if (url && !/^https?:\/\//i.test(url)) { alert("Proof URL must start with http(s)://"); return; }
    setSaving(true);
    try {
      if (isEmployeeSubmit) {
        await submitForReview(row.id, userId, url || undefined, note || undefined);
      } else {
        await markCompleted(row.id, userId, url || undefined, note || undefined);
      }
      await onDone();
    } catch (e) {
      alert((e as Error).message);
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E8E5DE]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E8E5DE]">
          <div className="text-sm uppercase tracking-wide text-stone-500">{label}</div>
          <div className="text-stone-900 font-medium mt-1 truncate">{row.title}</div>
          {isEmployeeSubmit && (
            <div className="text-[11px] text-stone-500 mt-1">
              Points are awarded after a manager approves your submission.
            </div>
          )}
        </div>
        <div className="p-5 space-y-3">
          <label className="text-xs uppercase tracking-wide text-stone-500">Proof URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="dg-modal-input" placeholder="https://…" data-testid="dg-proof-url" />
          <label className="text-xs uppercase tracking-wide text-stone-500">Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="dg-modal-input" />
        </div>
        <div className="p-5 border-t border-[#E8E5DE] flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-stone-900 text-[#C8A84B] px-4 py-2 rounded-lg text-sm" data-testid="dg-complete-submit">
            {saving ? "Saving…" : label}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className={`dg-summary-card${tone ? " " + tone : ""}`}>
      <span className="dg-summary-label">{label}</span>
      <span className="dg-summary-value">{value}</span>
    </div>
  );
}

/* ─────────── Column Wizard ─────────── */

function ColumnWizard({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: { label: string; type: CustomColumn["type"]; options?: string[] }) => void | Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumn["type"]>("text");
  const [optionsText, setOptionsText] = useState("");
  const submit = async () => {
    if (!label.trim()) { alert("Column name is required."); return; }
    const opts = type === "dropdown"
      ? optionsText.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
      : undefined;
    if (type === "dropdown" && (!opts || opts.length === 0)) {
      alert("Dropdown columns need at least one option."); return;
    }
    await onCreate({ label: label.trim(), type, options: opts });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-[#E8E5DE] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#EFE9DA] bg-[#FBF8F1]">
          <div className="text-[11px] uppercase tracking-[0.12em] text-stone-500">Add custom column</div>
          <div className="text-lg font-semibold text-stone-900 mt-1">New column</div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-stone-600">Column name</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="dg-modal-input"
              placeholder="e.g. Client Brief"
              data-testid="dg-col-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-stone-600">Column type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CustomColumn["type"])}
              className="dg-modal-input"
              data-testid="dg-col-type"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="dropdown">Dropdown</option>
              <option value="url">URL</option>
              <option value="checkbox">Checkbox</option>
            </select>
          </div>
          {type === "dropdown" && (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-stone-600">
                Options <span className="text-stone-400 normal-case">(one per line or comma-separated)</span>
              </label>
              <textarea
                rows={4}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className="dg-modal-input"
                placeholder={"Option 1\nOption 2"}
                data-testid="dg-col-options"
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#EFE9DA] bg-[#FBF8F1] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="bg-stone-900 hover:bg-stone-800 text-[#C8A84B] px-5 py-2 rounded-lg text-sm font-medium"
            data-testid="dg-col-create"
          >
            Create column
          </button>
        </div>
      </div>
    </div>
  );
}
