// Ported from IPC Control Center src/lib/tasks.ts.
// Vision Center adaptation: notifications integration removed (different
// notification system); everything else verbatim.
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "todo" | "inprogress" | "review" | "blocked" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  note: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_initials: string | null;
  created_by: string | null;
  created_by_name: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tag: string;
  due_date: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  created_at: string;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  submitted_by: string;
  submitted_by_name: string | null;
  submission_url: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const m = text.match(URL_RE);
  if (!m) return [];
  return Array.from(new Set(m.map((s) => s.replace(/[.,;:!?)\]]+$/, ""))));
}

export function isValidUrl(s: string): boolean {
  try { const u = new URL(s.trim()); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

export async function fetchSubmissionsForTasks(taskIds: string[]): Promise<Map<string, TaskSubmission[]>> {
  const map = new Map<string, TaskSubmission[]>();
  if (!taskIds.length) return map;
  const { data, error } = await (supabase as any)
    .from("task_submissions").select("*").in("task_id", taskIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const r of (data ?? []) as TaskSubmission[]) {
    const arr = map.get(r.task_id) ?? [];
    arr.push(r); map.set(r.task_id, arr);
  }
  return map;
}

export async function fetchSubmissions(taskId: string): Promise<TaskSubmission[]> {
  const { data, error } = await (supabase as any)
    .from("task_submissions").select("*").eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskSubmission[];
}

export async function createSubmission(
  taskId: string, url: string, note: string | null, me: { id: string; name: string }
): Promise<TaskSubmission> {
  const { data, error } = await (supabase as any).from("task_submissions").insert({
    task_id: taskId, submitted_by: me.id, submitted_by_name: me.name,
    submission_url: url.trim(), note: note?.trim() || null,
  }).select().single();
  if (error) throw error;
  try { await logActivity(taskId, me.id, me.name, "submitted work"); } catch {}
  return data as TaskSubmission;
}

export const STATUSES: { key: TaskStatus; label: string; barClass: string; pillClass: string }[] = [
  { key: "todo",       label: "To Do",       barClass: "bg-[#E5E7EB]", pillClass: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]" },
  { key: "inprogress", label: "In Progress", barClass: "bg-[#2563EB]", pillClass: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]" },
  { key: "review",     label: "Review",      barClass: "bg-[#C8A84B]", pillClass: "bg-[#FBF6E9] text-[#7A5E10] border-[#E8D49A]" },
  { key: "blocked",    label: "Blocked",     barClass: "bg-[#EA580C]", pillClass: "bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]" },
  { key: "done",       label: "Done",        barClass: "bg-[#16A34A]", pillClass: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]" },
];

export const TAGS = ["Operations","Sales","Media Buying","Content","Marketing","Design","HR","Finance","Other"];

export const PRIORITY_PILL: Record<TaskPriority, string> = {
  high:   "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
  medium: "bg-[#FFFBEB] text-[#CA8A04] border-[#FDE68A]",
  low:    "bg-[#F7F6F3] text-[#888]    border-[#E8E5DE]",
};

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || (parts[0]?.[0] ?? "").toUpperCase();
}

export function todayISO(): string {
  const d = new Date(); d.setHours(0,0,0,0);
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export function dueLabel(due: string | null): { label: string; tone: "muted" | "today" | "overdue" } {
  if (!due) return { label: "—", tone: "muted" };
  const t = todayISO();
  if (due === t) return { label: "Today", tone: "today" };
  if (due < t) {
    const d = new Date(due);
    return { label: `Overdue · ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, tone: "overdue" };
  }
  const d = new Date(due);
  return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), tone: "muted" };
}

export function isOverdue(t: Task): boolean {
  return !!t.due_date && t.status !== "done" && t.due_date < todayISO();
}
export function isDueToday(t: Task): boolean {
  return !!t.due_date && t.status !== "done" && t.due_date === todayISO();
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await (supabase as any)
    .from("tasks").select("*").eq("is_archived", false)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchActivity(taskId: string): Promise<TaskActivity[]> {
  const { data, error } = await (supabase as any)
    .from("task_activity").select("*").eq("task_id", taskId)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as TaskActivity[];
}

async function logActivity(taskId: string, userId: string, userName: string, action: string) {
  await (supabase as any).from("task_activity").insert({
    task_id: taskId, user_id: userId, user_name: userName, action,
  });
}

export async function createTask(
  input: Partial<Task>,
  me: { id: string; name: string; isAdmin: boolean }
): Promise<Task> {
  const assigned_to = me.isAdmin ? (input.assigned_to ?? me.id) : me.id;
  const assigned_name = me.isAdmin ? (input.assigned_name ?? me.name) : me.name;
  const payload = {
    title: (input.title ?? "").trim(),
    note: input.note ?? null,
    assigned_to,
    assigned_name,
    assigned_initials: initialsOf(assigned_name),
    created_by: me.id,
    created_by_name: me.name,
    priority: input.priority ?? "medium",
    status: input.status ?? "todo",
    tag: input.tag ?? "Operations",
    due_date: input.due_date ?? todayISO(),
    sort_order: input.sort_order ?? 0,
  };
  const { data, error } = await (supabase as any).from("tasks").insert(payload).select().single();
  if (error) throw error;
  try { await logActivity(data.id, me.id, me.name, "created this task"); } catch {}
  return data as Task;
}

export async function updateTask(
  prev: Task, patch: Partial<Task>, me: { id: string; name: string }
): Promise<Task> {
  const upd: any = { ...patch };
  if (patch.assigned_name !== undefined) upd.assigned_initials = initialsOf(patch.assigned_name);
  const { data, error } = await (supabase as any).from("tasks").update(upd).eq("id", prev.id).select().single();
  if (error) throw error;

  const changes: string[] = [];
  if (patch.status && patch.status !== prev.status) changes.push(`changed status to ${labelOfStatus(patch.status)}`);
  if (patch.priority && patch.priority !== prev.priority) changes.push(`changed priority to ${cap(patch.priority)}`);
  if (patch.due_date !== undefined && patch.due_date !== prev.due_date)
    changes.push(`changed due date to ${patch.due_date ?? "—"}`);
  if (patch.assigned_to !== undefined && patch.assigned_to !== prev.assigned_to)
    changes.push(`reassigned to ${patch.assigned_name ?? "—"}`);
  if (patch.title && patch.title !== prev.title) changes.push("updated the title");
  if (patch.note !== undefined && patch.note !== prev.note) changes.push("updated the note");
  if (changes.length === 0) changes.push("updated this task");
  for (const a of changes) { try { await logActivity(prev.id, me.id, me.name, a); } catch {} }
  return data as Task;
}

export async function archiveTask(t: Task, me: { id: string; name: string }) {
  const { error } = await (supabase as any).from("tasks").update({ is_archived: true }).eq("id", t.id);
  if (error) throw error;
  try { await logActivity(t.id, me.id, me.name, "archived this task"); } catch {}
}

export async function archiveOldDone(): Promise<number> {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const iso = cutoff.toISOString();
  const { data, error } = await (supabase as any)
    .from("tasks").update({ is_archived: true })
    .eq("is_archived", false).eq("status", "done").lt("updated_at", iso).select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export function labelOfStatus(s: TaskStatus): string {
  return STATUSES.find((x) => x.key === s)?.label ?? s;
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function timeAgo(iso: string): string {
  const d = new Date(iso); const now = Date.now(); const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function whatsappText(t: Task): string {
  const dueLabelFull = t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const lines = [
    `📌 *${t.title}*`,
    `👤 Assigned to: ${t.assigned_name ?? "—"}`,
    `🎯 Priority: ${cap(t.priority)}`,
    `📅 Due: ${dueLabelFull}`,
    `📂 ${t.tag}`,
  ];
  if (t.note) lines.push(`📝 ${t.note}`);
  lines.push("—", "_GWV Vision Center_");
  return lines.join("\n");
}
