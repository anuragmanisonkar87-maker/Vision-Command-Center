// Attendance service. Wraps Supabase queries for the Attendance MVP.
// RLS does the real enforcement; these helpers just provide typed access.

import { supabase } from "@/integrations/supabase/client";
import { workSeconds } from "@/lib/attendance/geofence";
import { lateMinutes as computeLateMinutes } from "@/lib/attendance/summary";

export type AttendanceSettings = {
  id: string;
  office_name: string;
  office_lat: number | null;
  office_lng: number | null;
  allowed_radius_meters: number;
  allowed_check_in_start_time: string | null;
  expected_check_in_time: string | null;
  expected_check_out_time: string | null;
  timezone: string;
  enable_location_required: boolean;
  enable_auto_checkin_prompt: boolean;
  late_grace_minutes: number;
  missed_cutoff_time: string;
};

export type AttendanceRecord = {
  id: string;
  user_id: string;
  team_member_id: string | null;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_seconds: number;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_in_accuracy: number | null;
  check_out_accuracy: number | null;
  check_in_status: string;
  check_out_status: string;
  location_status: string;
  notes: string | null;
  is_late: boolean;
  late_minutes: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAttendanceSettings(): Promise<AttendanceSettings | null> {
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttendanceSettings | null) ?? null;
}

export async function upsertAttendanceSettings(
  patch: Partial<Omit<AttendanceSettings, "id">> & { id?: string },
): Promise<AttendanceSettings> {
  const existing = await getAttendanceSettings();
  if (existing) {
    const { data, error } = await (supabase as any)
      .from("gwv_attendance_settings")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as AttendanceSettings;
  }
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_settings")
    .insert(patch)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceSettings;
}

export async function getTodayAttendance(userId: string): Promise<AttendanceRecord | null> {
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttendanceRecord | null) ?? null;
}

export async function checkIn(params: {
  userId: string;
  teamMemberId?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  locationStatus: string;
}): Promise<AttendanceRecord> {
  const now = new Date().toISOString();
  // Compute late status against current settings so it is persisted on the row.
  const settings = await getAttendanceSettings().catch(() => null);
  const late = computeLateMinutes(now, {
    expectedCheckInTime: settings?.expected_check_in_time ?? null,
    graceMinutes: settings?.late_grace_minutes ?? 15,
  });
  const row = {
    user_id: params.userId,
    team_member_id: params.teamMemberId ?? null,
    date: today(),
    check_in_at: now,
    check_in_lat: params.lat ?? null,
    check_in_lng: params.lng ?? null,
    check_in_accuracy: params.accuracy ?? null,
    check_in_status: "checked_in",
    check_out_status: "not_checked_in",
    location_status: params.locationStatus,
    is_late: late > 0,
    late_minutes: late,
  };
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .upsert(row, { onConflict: "user_id,date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceRecord;
}

export async function checkOut(params: {
  recordId: string;
  checkInAt: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
}): Promise<AttendanceRecord> {
  const now = new Date().toISOString();
  const seconds = workSeconds(params.checkInAt, now);
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .update({
      check_out_at: now,
      check_out_lat: params.lat ?? null,
      check_out_lng: params.lng ?? null,
      check_out_accuracy: params.accuracy ?? null,
      check_out_status: "checked_out",
      total_work_seconds: seconds,
    })
    .eq("id", params.recordId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AttendanceRecord;
}

export async function listAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .select("*")
    .eq("date", date)
    .order("check_in_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRecord[];
}

export type AttendanceRecordWithIdentity = AttendanceRecord & {
  employee_name: string;
  employee_email: string | null;
  employee_position: string | null;
};

/**
 * Admin-only: today's attendance joined with identity from gwv_team_members
 * (preferred) or profiles (fallback). RLS still gates the underlying read.
 */
export async function listAttendanceForDateWithIdentity(
  date: string,
): Promise<AttendanceRecordWithIdentity[]> {
  const records = await listAttendanceForDate(date);
  if (records.length === 0) return [];

  const userIds = Array.from(new Set(records.map((r) => r.user_id)));
  const teamMemberIds = Array.from(
    new Set(records.map((r) => r.team_member_id).filter((x): x is string => !!x)),
  );

  const [tmByUserRes, tmByIdRes, profilesRes] = await Promise.all([
    (supabase as any)
      .from("gwv_team_members")
      .select("id, name, email, linked_user_id, position_id, gwv_positions(name)")
      .in("linked_user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    teamMemberIds.length
      ? (supabase as any)
          .from("gwv_team_members")
          .select("id, name, email, linked_user_id, position_id, gwv_positions(name)")
          .in("id", teamMemberIds)
      : Promise.resolve({ data: [] }),
    (supabase as any).from("profiles").select("id, display_name").in("id", userIds),
  ]);

  const tmByUser = new Map<string, any>();
  for (const t of (tmByUserRes.data ?? []) as any[]) {
    if (t.linked_user_id) tmByUser.set(t.linked_user_id, t);
  }
  const tmById = new Map<string, any>();
  for (const t of (tmByIdRes.data ?? []) as any[]) tmById.set(t.id, t);
  const profileById = new Map<string, any>();
  for (const p of (profilesRes.data ?? []) as any[]) profileById.set(p.id, p);

  return records.map((r) => {
    const tm = (r.team_member_id && tmById.get(r.team_member_id)) || tmByUser.get(r.user_id);
    const profile = profileById.get(r.user_id);
    return {
      ...r,
      employee_name:
        tm?.name || profile?.display_name || `User ${r.user_id.slice(0, 8)}…`,
      employee_email: tm?.email ?? null,
      employee_position: tm?.gwv_positions?.name ?? null,
    } as AttendanceRecordWithIdentity;
  });
}

/** Records for a user in [fromDate, toDate] inclusive (YYYY-MM-DD strings). */
export async function listAttendanceForRange(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .select("*")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRecord[];
}

/** Returns YYYY-MM-01 .. last day of current month for `now`. */
export function monthRange(now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

/** Admin-only: monthly summary rows for the team (RLS enforces admin scope). */
export async function listAttendanceForMonth(
  yearMonth: string, // YYYY-MM
): Promise<AttendanceRecord[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const { data, error } = await (supabase as any)
    .from("gwv_attendance_records")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRecord[];
}
