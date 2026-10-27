// Pure helpers for attendance streaks + late/missed summaries.
// No DB imports — easy to unit test.

export type AttendanceLite = {
  date: string; // YYYY-MM-DD
  check_in_at: string | null;
};

export type LateConfig = {
  expectedCheckInTime: string | null; // "HH:MM" or "HH:MM:SS"
  graceMinutes: number;
};

/** Returns true if check_in_at is later than expected + grace. */
export function isLateCheckIn(checkInIso: string | null, cfg: LateConfig): boolean {
  return lateMinutes(checkInIso, cfg) > 0;
}

/** Minutes the check-in is past (expected + grace). 0 if on-time or missing. */
export function lateMinutes(checkInIso: string | null, cfg: LateConfig): number {
  if (!checkInIso || !cfg.expectedCheckInTime) return 0;
  const d = new Date(checkInIso);
  if (!Number.isFinite(d.getTime())) return 0;
  const [hh, mm = "0"] = cfg.expectedCheckInTime.split(":");
  const expectedMin = Number(hh) * 60 + Number(mm) + Math.max(0, cfg.graceMinutes || 0);
  const actualMin = d.getHours() * 60 + d.getMinutes();
  return Math.max(0, actualMin - expectedMin);
}

/** YYYY-MM-DD for a local Date. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export type MonthlySummary = {
  presentDays: number;
  lateDays: number;
  missedDays: number;
  currentStreak: number;
};

/**
 * Compute monthly summary + current streak from a list of attendance records
 * for a single user. `now` is the reference instant; `pastCutoffHour` decides
 * whether today counts as missed when there's no check-in.
 */
export function computeMonthlySummary(
  records: AttendanceLite[],
  cfg: LateConfig,
  now: Date = new Date(),
  cutoff: number | string = 18,
): MonthlySummary {
  const byDate = new Map<string, AttendanceLite>();
  for (const r of records) byDate.set(r.date, r);

  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1);
  const todayStr = isoDate(now);

  // Resolve cutoff: a string "HH:MM" or a numeric hour-of-day.
  let cutoffMinutes: number;
  if (typeof cutoff === "string") {
    const [hh, mm = "0"] = cutoff.split(":");
    cutoffMinutes = Number(hh) * 60 + Number(mm);
  } else {
    cutoffMinutes = cutoff * 60;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayPastCutoff = nowMinutes >= cutoffMinutes;

  let present = 0;
  let late = 0;
  let missed = 0;

  for (let d = new Date(monthStart); d <= now; d = addDays(d, 1)) {
    const ds = isoDate(d);
    const rec = byDate.get(ds);
    const present_ = !!rec?.check_in_at;
    if (present_) {
      present += 1;
      if (isLateCheckIn(rec!.check_in_at, cfg)) late += 1;
    } else if (ds !== todayStr || todayPastCutoff) {
      missed += 1;
    }
  }

  // Streak: walk back from today (if present) else yesterday, count consecutive.
  let streak = 0;
  let cursor = new Date(now);
  if (!byDate.get(isoDate(cursor))?.check_in_at) cursor = addDays(cursor, -1);
  while (true) {
    const rec = byDate.get(isoDate(cursor));
    if (!rec?.check_in_at) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return { presentDays: present, lateDays: late, missedDays: missed, currentStreak: streak };
}

/** True when no check-in by missed cutoff time for the given date. */
export function isMissedForDate(
  record: AttendanceLite | null | undefined,
  date: Date,
  now: Date,
  missedCutoffTime: string,
): boolean {
  if (record?.check_in_at) return false;
  const ds = isoDate(date);
  if (ds === isoDate(now)) {
    const [hh, mm = "0"] = missedCutoffTime.split(":");
    const cutoffMin = Number(hh) * 60 + Number(mm);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= cutoffMin;
  }
  return date < now;
}
