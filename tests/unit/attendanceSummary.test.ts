import { describe, it, expect } from "vitest";
import { isLateCheckIn, lateMinutes, computeMonthlySummary, isoDate, isMissedForDate } from "@/lib/attendance/summary";

const cfg = { expectedCheckInTime: "10:00", graceMinutes: 15 };

function at(date: string, hh: number, mm: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

describe("isLateCheckIn", () => {
  it("on-time within grace is not late", () => {
    expect(isLateCheckIn(at("2026-06-01", 10, 14), cfg)).toBe(false);
    expect(isLateCheckIn(at("2026-06-01", 10, 15), cfg)).toBe(false);
  });
  it("after grace period is late", () => {
    expect(isLateCheckIn(at("2026-06-01", 10, 16), cfg)).toBe(true);
    expect(isLateCheckIn(at("2026-06-01", 11, 0), cfg)).toBe(true);
  });
  it("early check-in is not late", () => {
    expect(isLateCheckIn(at("2026-06-01", 9, 0), cfg)).toBe(false);
  });
  it("returns false when expected time not set", () => {
    expect(isLateCheckIn(at("2026-06-01", 23, 0), { expectedCheckInTime: null, graceMinutes: 15 })).toBe(false);
  });
  it("returns false when check_in_at is null", () => {
    expect(isLateCheckIn(null, cfg)).toBe(false);
  });
});

describe("computeMonthlySummary", () => {
  const now = new Date(2026, 5, 10, 19, 0, 0); // June 10, 2026 19:00 local

  it("counts present, late, missed and streak", () => {
    const recs = [
      { date: "2026-06-01", check_in_at: at("2026-06-01", 9, 30) },   // on-time
      { date: "2026-06-02", check_in_at: at("2026-06-02", 10, 30) },  // late
      // 06-03 missed
      { date: "2026-06-04", check_in_at: at("2026-06-04", 10, 0) },
      // 06-05 missed
      { date: "2026-06-08", check_in_at: at("2026-06-08", 10, 14) },  // on-time
      { date: "2026-06-09", check_in_at: at("2026-06-09", 10, 16) },  // late
      { date: "2026-06-10", check_in_at: at("2026-06-10", 9, 0) },    // today on-time
    ];
    const s = computeMonthlySummary(recs, cfg, now);
    expect(s.presentDays).toBe(6);
    expect(s.lateDays).toBe(2);
    // missed: 06-03, 05, 06, 07 = 4
    expect(s.missedDays).toBe(4);
    expect(s.currentStreak).toBe(3); // 06-08, 06-09, 06-10
  });

  it("does not count today as missed before cutoff hour", () => {
    const earlyNow = new Date(2026, 5, 1, 8, 0, 0); // June 1 8am
    const s = computeMonthlySummary([], cfg, earlyNow, 18);
    expect(s.missedDays).toBe(0);
    expect(s.presentDays).toBe(0);
  });

  it("counts today as missed after cutoff", () => {
    const lateNow = new Date(2026, 5, 1, 19, 0, 0);
    const s = computeMonthlySummary([], cfg, lateNow, 18);
    expect(s.missedDays).toBe(1);
  });

  it("streak resets after a gap", () => {
    const recs = [
      { date: "2026-06-08", check_in_at: at("2026-06-08", 10, 0) },
      // gap on 06-09
      { date: "2026-06-10", check_in_at: at("2026-06-10", 10, 0) },
    ];
    const s = computeMonthlySummary(recs, cfg, now);
    expect(s.currentStreak).toBe(1);
  });

  it("isoDate handles zero-padding", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("lateMinutes", () => {
  it("returns 0 when on time or within grace", () => {
    expect(lateMinutes(at("2026-06-01", 10, 0), cfg)).toBe(0);
    expect(lateMinutes(at("2026-06-01", 10, 15), cfg)).toBe(0);
  });
  it("returns minutes past grace", () => {
    expect(lateMinutes(at("2026-06-01", 10, 30), cfg)).toBe(15);
    expect(lateMinutes(at("2026-06-01", 11, 5), cfg)).toBe(50);
  });
  it("returns 0 when no expected time or no check-in", () => {
    expect(lateMinutes(null, cfg)).toBe(0);
    expect(lateMinutes(at("2026-06-01", 12, 0), { expectedCheckInTime: null, graceMinutes: 15 })).toBe(0);
  });
});

describe("isMissedForDate", () => {
  it("missed today when no check-in and past cutoff", () => {
    const now = new Date(2026, 5, 10, 13, 0, 0);
    expect(isMissedForDate(null, now, now, "12:00")).toBe(true);
  });
  it("not missed today before cutoff", () => {
    const now = new Date(2026, 5, 10, 11, 0, 0);
    expect(isMissedForDate(null, now, now, "12:00")).toBe(false);
  });
  it("past day with no record is missed", () => {
    const past = new Date(2026, 5, 1);
    const now = new Date(2026, 5, 10, 9, 0, 0);
    expect(isMissedForDate(null, past, now, "12:00")).toBe(true);
  });
  it("not missed when checked in", () => {
    const now = new Date(2026, 5, 10, 14, 0, 0);
    expect(isMissedForDate({ date: "2026-06-10", check_in_at: at("2026-06-10", 10, 0) }, now, now, "12:00")).toBe(false);
  });
});

describe("computeMonthlySummary with HH:MM cutoff", () => {
  it("uses time-of-day cutoff string", () => {
    const before = new Date(2026, 5, 1, 11, 0, 0);
    const after = new Date(2026, 5, 1, 13, 0, 0);
    expect(computeMonthlySummary([], cfg, before, "12:00").missedDays).toBe(0);
    expect(computeMonthlySummary([], cfg, after, "12:00").missedDays).toBe(1);
  });
});
