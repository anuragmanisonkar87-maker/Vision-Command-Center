// Delegation Command Center service layer.
// Handles tasks, activity log, scoring ledger, and settings.
import { supabase } from "@/integrations/supabase/client";

export type Priority = "low" | "medium" | "high" | "critical";
export type Difficulty = "easy" | "medium" | "hard";
export type SystemStage =
  | "planned"
  | "in_progress"
  | "submitted"
  | "completed"
  | "revision"
  | "blocked"
  | "shifted"
  | "cancelled";

export interface DelegationTask {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  /** New: link to gwv_team_members for the Task Doer (preferred over assignee_id). */
  assignee_team_member_id?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  /** Auto-captured from the logged-in creator. */
  assigned_by_user_id?: string | null;
  assigned_by_name?: string | null;
  assigned_by_email?: string | null;
  created_by: string;
  brand_id: string | null;
  department: string | null;
  category: string | null;
  priority: Priority;
  difficulty: Difficulty;
  status: string;
  system_stage: SystemStage;
  due_date: string | null;
  /** Phase 3D — optional HH:MM time-of-day deadline for stand-up / ad hoc tasks. */
  due_time?: string | null;
  due_date_locked: boolean;
  completed_at: string | null;
  proof_url: string | null;
  proof_note: string | null;
  proof_required: boolean;
  revision_count: number;
  delay_reason: string | null;
  blocked_reason: string | null;
  waiting_on_user_id: string | null;
  revision_1_date: string | null;
  revision_2_date: string | null;
  final_date: string | null;
  follow_up_reminder: string | null;
  custom_fields: Record<string, unknown>;
  is_deleted: boolean;
  /** Phase 2A task classification — defaults to 'standup' server-side. */
  task_type?: "recurring_daily" | "standup" | "ad_hoc";
  created_at: string;
  updated_at: string;
}


export interface CustomColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "url" | "dropdown" | "checkbox";
  width?: number;
  hidden?: boolean;
  options?: string[];
}

export interface DelegationSettings {
  statuses: { label: string; stage: SystemStage }[];
  categories: string[];
  delay_reasons: string[];
  blocked_reasons?: string[];
  scoring_rules: {
    on_time_low: number;
    on_time_medium: number;
    on_time_high: number;
    on_time_critical: number;
    zero_revision_bonus: number;
    late_penalty: number;
    revision_penalty: number;
    shifted_penalty: number;
  };
  badge_rules: Record<string, number>;
  custom_columns?: CustomColumn[];
}


const db = supabase as any;

export async function getSettings(): Promise<DelegationSettings> {
  const { data, error } = await db.from("delegation_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.settings as DelegationSettings;
}

export async function updateSettings(settings: DelegationSettings): Promise<void> {
  const { error } = await db
    .from("delegation_settings")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function listMyTasks(userId: string): Promise<DelegationTask[]> {
  const { data, error } = await db
    .from("delegation_tasks")
    .select("*")
    .eq("is_deleted", false)
    .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DelegationTask[];
}

export interface TeamFilters {
  user_id?: string;
  stage?: SystemStage;
  priority?: Priority;
  from?: string;
  to?: string;
}

export async function listAllTasks(filters: TeamFilters = {}): Promise<DelegationTask[]> {
  let q = db.from("delegation_tasks").select("*").eq("is_deleted", false);
  if (filters.user_id) q = q.eq("assignee_id", filters.user_id);
  if (filters.stage) q = q.eq("system_stage", filters.stage);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.from) q = q.gte("due_date", filters.from);
  if (filters.to) q = q.lte("due_date", filters.to);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DelegationTask[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  /** Optional auth user id (legacy). Use task-doer fields for new rows. */
  assignee_id?: string | null;
  /** Preferred: link to a gwv_team_members record. */
  assignee_team_member_id?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  category?: string;
  priority: Priority;
  difficulty: Difficulty;
  due_date?: string;
  proof_required?: boolean;
  brand_id?: string | null;
  department?: string | null;
  /** Auto-captured at call sites from the logged-in user. */
  assigned_by_user_id?: string | null;
  assigned_by_name?: string | null;
  assigned_by_email?: string | null;
}


export async function createTask(input: CreateTaskInput, createdBy: string): Promise<DelegationTask> {
  const row = {
    ...input,
    created_by: createdBy,
    status: "Planned",
    system_stage: "planned" as const,
    due_date_locked: true,
  };
  const { data, error } = await db.from("delegation_tasks").insert(row).select().single();
  if (error) throw new Error(error.message);
  await logActivity(data.id, createdBy, "created", null, row, null);
  return data as DelegationTask;
}

export async function updateTaskFields(
  taskId: string,
  actorId: string,
  patch: Partial<DelegationTask>,
  note?: string,
): Promise<DelegationTask> {
  const { data: before } = await db.from("delegation_tasks").select("*").eq("id", taskId).single();
  const { data, error } = await db.from("delegation_tasks").update(patch).eq("id", taskId).select().single();
  if (error) throw new Error(error.message);
  await logActivity(taskId, actorId, "updated", before, data, note);
  return data as DelegationTask;
}

export async function changeDueDate(taskId: string, actorId: string, newDate: string, note?: string) {
  return updateTaskFields(taskId, actorId, { due_date: newDate }, note ?? "due date changed");
}

export async function softDeleteTask(taskId: string, actorId: string) {
  return updateTaskFields(taskId, actorId, { is_deleted: true }, "soft deleted");
}

export async function markRevision(taskId: string, actorId: string, note?: string) {
  const { data: t } = await db.from("delegation_tasks").select("*").eq("id", taskId).single();
  const nextCount = (t?.revision_count ?? 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const patch: Partial<DelegationTask> = {
    system_stage: "revision",
    status: "Revision Required",
    revision_count: nextCount,
  };
  if (nextCount === 1 && !t?.revision_1_date) patch.revision_1_date = today;
  else if (nextCount === 2 && !t?.revision_2_date) patch.revision_2_date = today;
  const updated = await updateTaskFields(taskId, actorId, patch, note ?? "revision requested");
  await logActivity(taskId, actorId, "revision_requested", { revision_count: t?.revision_count ?? 0 }, { revision_count: nextCount }, note ?? null);
  const settings = await getSettings();
  await insertLedger(taskId, updated.assignee_id, settings.scoring_rules.revision_penalty, `revision_penalty_${nextCount}`);
  return updated;
}

/** Employee submit for admin review — no points awarded, no completed_at set. */
export async function submitForReview(taskId: string, actorId: string, proofUrl?: string, proofNote?: string) {
  const { data: t } = await db.from("delegation_tasks").select("*").eq("id", taskId).single();
  const isResubmit = (t?.system_stage === "revision");
  const updated = await updateTaskFields(
    taskId, actorId,
    {
      system_stage: "submitted",
      status: "Submitted",
      proof_url: proofUrl ?? null,
      proof_note: proofNote ?? null,
    },
    isResubmit ? "resubmitted for review" : "submitted for review",
  );
  await logActivity(
    taskId, actorId,
    isResubmit ? "resubmitted_for_review" : "submitted_for_review",
    { stage: t?.system_stage }, { stage: "submitted", proof_url: proofUrl ?? null },
    proofNote ?? null,
  );
  return updated;
}

/** Admin approve a submitted task — runs scoring once, sets completed_at + final_date. */
export async function approveCompletion(taskId: string, actorId: string) {
  const { data: t } = await db.from("delegation_tasks").select("*").eq("id", taskId).single();
  if (!t) throw new Error("Task not found");
  if (t.assignee_id === actorId) throw new Error("Cannot approve your own task");
  const completedAt = new Date().toISOString();
  const today = completedAt.slice(0, 10);
  const updated = await updateTaskFields(
    taskId, actorId,
    {
      system_stage: "completed",
      status: "Completed",
      completed_at: completedAt,
      final_date: today,
    },
    "approved completed",
  );
  await logActivity(taskId, actorId, "approved_completed", null, { completed_at: completedAt }, null);
  await awardPointsForCompletion(updated, t);
  return updated;
}

/** Direct admin completion (bypass submit/approve), used when admin completes on behalf. */
export async function markCompleted(taskId: string, actorId: string, proofUrl?: string, proofNote?: string) {
  const { data: t } = await db.from("delegation_tasks").select("*").eq("id", taskId).single();
  const completedAt = new Date().toISOString();
  const updated = await updateTaskFields(
    taskId,
    actorId,
    {
      system_stage: "completed",
      status: "Completed",
      completed_at: completedAt,
      final_date: completedAt.slice(0, 10),
      proof_url: proofUrl ?? null,
      proof_note: proofNote ?? null,
    },
    "marked completed",
  );
  await logActivity(taskId, actorId, "approved_completed", null, { completed_at: completedAt }, "direct admin complete");
  await awardPointsForCompletion(updated, t);
  return updated;
}

async function awardPointsForCompletion(task: DelegationTask, previous: DelegationTask | null) {
  const settings = await getSettings();
  const rules = settings.scoring_rules;
  // on-time vs late
  const onTime = task.due_date ? new Date(task.completed_at!).toISOString().slice(0, 10) <= task.due_date : true;
  const base =
    task.priority === "critical"
      ? rules.on_time_critical
      : task.priority === "high"
        ? rules.on_time_high
        : task.priority === "medium"
          ? rules.on_time_medium
          : rules.on_time_low;
  await insertLedger(task.id, task.assignee_id, base, "completion_base");
  if (!onTime) await insertLedger(task.id, task.assignee_id, rules.late_penalty, "late_penalty");
  if ((previous?.revision_count ?? 0) === 0) {
    await insertLedger(task.id, task.assignee_id, rules.zero_revision_bonus, "zero_revision_bonus");
  }
}

async function insertLedger(taskId: string, userId: string | null, points: number, reason: string) {
  if (!userId) return;
  // unique(task_id, reason) prevents duplicates
  await db.from("delegation_points_ledger").insert({
    task_id: taskId,
    user_id: userId,
    points,
    reason,
    period_date: new Date().toISOString().slice(0, 10),
  });
}


export async function logActivity(
  taskId: string,
  actorId: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  note?: string | null,
) {
  await db.from("delegation_activity").insert({
    task_id: taskId,
    actor_id: actorId,
    action,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    note: note ?? null,
  });
}

export interface ActivityEntry {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  old_value: any;
  new_value: any;
  note: string | null;
  created_at: string;
}

export async function listTaskActivity(taskId: string): Promise<ActivityEntry[]> {
  const { data, error } = await db
    .from("delegation_activity")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityEntry[];
}

export interface PointsLedgerEntry {
  id: string;
  task_id: string;
  user_id: string;
  points: number;
  reason: string;
  period_date: string;
  created_at: string;
  task_title?: string | null;
}

export async function listTaskPoints(taskId: string): Promise<PointsLedgerEntry[]> {
  const { data, error } = await db
    .from("delegation_points_ledger")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PointsLedgerEntry[];
}

export async function listUserPoints(userId: string): Promise<PointsLedgerEntry[]> {
  const { data, error } = await db
    .from("delegation_points_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PointsLedgerEntry[];
  const taskIds = Array.from(new Set(rows.map((r) => r.task_id).filter(Boolean)));
  if (taskIds.length > 0) {
    const { data: tasks } = await db
      .from("delegation_tasks")
      .select("id, title")
      .in("id", taskIds);
    const map = new Map<string, string>(((tasks ?? []) as any[]).map((t) => [t.id, t.title]));
    rows.forEach((r) => { r.task_title = map.get(r.task_id) ?? null; });
  }
  return rows;
}

export interface LeaderboardRow {
  user_id: string;
  points: number;
  completed: number;
  on_time: number;
  on_time_pct: number;
  badges: string[];
}

export async function getLeaderboard(range: "week" | "month"): Promise<LeaderboardRow[]> {
  const start = new Date();
  if (range === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  const from = start.toISOString().slice(0, 10);

  const [{ data: ledger }, { data: tasks }] = await Promise.all([
    db.from("delegation_points_ledger").select("user_id, points, reason, period_date").gte("period_date", from),
    db
      .from("delegation_tasks")
      .select("assignee_id, completed_at, due_date, revision_count, priority, system_stage")
      .eq("is_deleted", false)
      .eq("system_stage", "completed")
      .gte("completed_at", `${from}T00:00:00Z`),
  ]);

  const byUser = new Map<string, LeaderboardRow>();
  ((ledger ?? []) as any[]).forEach((r) => {
    const row = byUser.get(r.user_id) ?? { user_id: r.user_id, points: 0, completed: 0, on_time: 0, on_time_pct: 0, badges: [] };
    row.points += r.points;
    byUser.set(r.user_id, row);
  });
  ((tasks ?? []) as any[]).forEach((t) => {
    const row = byUser.get(t.assignee_id) ?? { user_id: t.assignee_id, points: 0, completed: 0, on_time: 0, on_time_pct: 0, badges: [] };
    row.completed += 1;
    const onTime = t.due_date ? (t.completed_at ?? "").slice(0, 10) <= t.due_date : true;
    if (onTime) row.on_time += 1;
    byUser.set(t.assignee_id, row);
  });

  const settings = await getSettings().catch(() => null);
  const br = settings?.badge_rules ?? {};

  const rows = Array.from(byUser.values()).map((r) => {
    r.on_time_pct = r.completed ? Math.round((r.on_time / r.completed) * 100) : 0;
    const badges: string[] = [];
    if (r.completed >= (br.on_time_machine_min ?? 10) && r.on_time_pct >= 90) badges.push("On-Time Machine");
    if (r.completed >= (br.zero_revision_min ?? 8)) badges.push("Zero Revision Pro");
    if (r.completed >= 1) badges.push("Deadline Warrior");
    r.badges = badges;
    return r;
  });
  rows.sort((a, b) => b.points - a.points);
  return rows;
}

/* ──────────────────────── Grid extensions ──────────────────────── */

export async function bulkCreateTasks(
  rows: CreateTaskInput[],
  createdBy: string,
): Promise<DelegationTask[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((r) => ({
    ...r,
    created_by: createdBy,
    status: "Planned",
    system_stage: "planned" as const,
    due_date_locked: true,
  }));
  const { data, error } = await db.from("delegation_tasks").insert(payload).select();
  if (error) throw new Error(error.message);
  const created = (data ?? []) as DelegationTask[];
  await Promise.all(
    created.map((t) => logActivity(t.id, createdBy, "created", null, t, "grid create")),
  );
  return created;
}

export async function addMasterOption(
  key: "categories" | "delay_reasons" | "blocked_reasons",
  value: string,
): Promise<DelegationSettings> {
  const s = await getSettings();
  const list = ((s as any)[key] ?? []) as string[];
  if (list.includes(value)) return s;
  const next = { ...s, [key]: [...list, value] };
  await updateSettings(next);
  return next;
}

export async function getCustomColumns(): Promise<CustomColumn[]> {
  const s = await getSettings();
  return (s.custom_columns ?? []) as CustomColumn[];
}

export async function setCustomColumns(cols: CustomColumn[]): Promise<void> {
  const s = await getSettings();
  await updateSettings({ ...s, custom_columns: cols });
}

/* ──────────────────────── Due-date change requests ──────────────────────── */

export interface DueDateRequest {
  id: string;
  task_id: string;
  requested_by: string;
  current_due_date: string | null;
  requested_due_date: string;
  delay_reason: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDueDateRequests(opts: { status?: "pending" | "approved" | "rejected"; task_id?: string } = {}): Promise<DueDateRequest[]> {
  let q = db.from("delegation_due_date_requests").select("*");
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.task_id) q = q.eq("task_id", opts.task_id);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DueDateRequest[];
}

export async function createDueDateRequest(input: {
  task_id: string;
  requested_by: string;
  current_due_date: string | null;
  requested_due_date: string;
  delay_reason?: string;
  note?: string;
}): Promise<DueDateRequest> {
  const { data, error } = await db
    .from("delegation_due_date_requests")
    .insert({
      task_id: input.task_id,
      requested_by: input.requested_by,
      current_due_date: input.current_due_date,
      requested_due_date: input.requested_due_date,
      delay_reason: input.delay_reason ?? null,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(
    input.task_id,
    input.requested_by,
    "due_date_change_requested",
    { due_date: input.current_due_date },
    { requested_due_date: input.requested_due_date },
    input.note ?? input.delay_reason ?? null,
  );
  return data as DueDateRequest;
}

export async function approveDueDateRequest(reqId: string, actorId: string, note?: string): Promise<void> {
  const { data: req, error } = await db.from("delegation_due_date_requests").select("*").eq("id", reqId).single();
  if (error || !req) throw new Error(error?.message ?? "Request not found");
  await db
    .from("delegation_due_date_requests")
    .update({ status: "approved", decided_by: actorId, decided_at: new Date().toISOString(), decision_note: note ?? null })
    .eq("id", reqId);
  await changeDueDate(req.task_id, actorId, req.requested_due_date, "due date change approved");
  await logActivity(
    req.task_id,
    actorId,
    "due_date_change_approved",
    { due_date: req.current_due_date },
    { due_date: req.requested_due_date },
    note ?? null,
  );
}

export async function rejectDueDateRequest(reqId: string, actorId: string, note?: string): Promise<void> {
  const { data: req, error } = await db.from("delegation_due_date_requests").select("*").eq("id", reqId).single();
  if (error || !req) throw new Error(error?.message ?? "Request not found");
  await db
    .from("delegation_due_date_requests")
    .update({ status: "rejected", decided_by: actorId, decided_at: new Date().toISOString(), decision_note: note ?? null })
    .eq("id", reqId);
  await logActivity(
    req.task_id,
    actorId,
    "due_date_change_rejected",
    { requested_due_date: req.requested_due_date },
    null,
    note ?? null,
  );
}
