// Recurring Daily Tasks (Phase 2A).
// Templates live in recurring_daily_tasks; per-day completions in
// recurring_daily_completions. RLS restricts employees to own rows.

import { supabase } from "@/integrations/supabase/client";

export type RecurringDailyTask = {
  id: string;
  title: string;
  description: string | null;
  task_doer_team_member_id: string | null;
  task_doer_user_id: string | null;
  task_doer_name: string;
  task_doer_email: string | null;
  due_time: string | null; // 'HH:MM:SS'
  points_on_completion: number;
  negative_points_if_missed: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringDailyCompletion = {
  id: string;
  template_id: string;
  completion_date: string;
  completed_by_user_id: string | null;
  completed_by_team_member_id: string | null;
  completed_by_name: string | null;
  completed_at: string;
  proof_url: string | null;
  note: string | null;
};

const db = supabase as any;

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function listTemplates(opts?: { activeOnly?: boolean }): Promise<RecurringDailyTask[]> {
  let q = db.from("recurring_daily_tasks").select("*").order("due_time", { ascending: true, nullsFirst: false }).order("title");
  if (opts?.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringDailyTask[];
}

export async function createTemplate(input: {
  title: string;
  description?: string | null;
  task_doer_team_member_id: string | null;
  task_doer_user_id?: string | null;
  task_doer_name: string;
  task_doer_email?: string | null;
  due_time?: string | null;
  points_on_completion?: number;
  negative_points_if_missed?: number;
  active?: boolean;
  created_by?: string | null;
}): Promise<RecurringDailyTask> {
  const { data, error } = await db
    .from("recurring_daily_tasks")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      task_doer_team_member_id: input.task_doer_team_member_id,
      task_doer_user_id: input.task_doer_user_id ?? null,
      task_doer_name: input.task_doer_name,
      task_doer_email: input.task_doer_email ?? null,
      due_time: input.due_time ?? null,
      points_on_completion: input.points_on_completion ?? 2,
      negative_points_if_missed: input.negative_points_if_missed ?? -2,
      active: input.active ?? true,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringDailyTask;
}

export async function updateTemplate(id: string, patch: Partial<RecurringDailyTask>): Promise<void> {
  const { error } = await db.from("recurring_daily_tasks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  await updateTemplate(id, { active });
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await db.from("recurring_daily_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCompletionsForDate(date: string): Promise<RecurringDailyCompletion[]> {
  const { data, error } = await db
    .from("recurring_daily_completions")
    .select("*")
    .eq("completion_date", date);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringDailyCompletion[];
}

export async function markCompleted(input: {
  template_id: string;
  user_id: string;
  team_member_id?: string | null;
  display_name?: string | null;
  proof_url?: string | null;
  note?: string | null;
  date?: string;
}): Promise<RecurringDailyCompletion> {
  const completion_date = input.date ?? todayISO();
  // Insert, conflict means duplicate completion for the day.
  const { data, error } = await db
    .from("recurring_daily_completions")
    .insert({
      template_id: input.template_id,
      completion_date,
      completed_by_user_id: input.user_id,
      completed_by_team_member_id: input.team_member_id ?? null,
      completed_by_name: input.display_name ?? null,
      proof_url: input.proof_url ?? null,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error("Already marked completed for today.");
    }
    throw new Error(error.message);
  }
  return data as RecurringDailyCompletion;
}

/** Build the "today" checklist by joining active templates with today's completions. */
export function buildChecklist(
  templates: RecurringDailyTask[],
  completions: RecurringDailyCompletion[],
): Array<RecurringDailyTask & { completion: RecurringDailyCompletion | null }> {
  const byTpl = new Map(completions.map((c) => [c.template_id, c]));
  return templates
    .filter((t) => t.active)
    .map((t) => ({ ...t, completion: byTpl.get(t.id) ?? null }));
}

/** Returns true if a completion already exists today for that template. */
export function isCompletedToday(
  templateId: string,
  completions: RecurringDailyCompletion[],
  date: string = todayISO(),
): boolean {
  return completions.some((c) => c.template_id === templateId && c.completion_date === date);
}
