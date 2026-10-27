import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import {
  getAttendanceSettings,
  getTodayAttendance,
  checkIn,
  checkOut,
  listAttendanceForDateWithIdentity,
  type AttendanceSettings,
  type AttendanceRecord,
  type AttendanceRecordWithIdentity,
  listAttendanceForMonth,
  listAttendanceForRange,
  monthRange,
} from "@/services/attendance/attendanceService";
import { decideCheckIn, formatWorkDuration, workSeconds } from "@/lib/attendance/geofence";
import { isLateCheckIn, computeMonthlySummary, isMissedForDate, lateMinutes } from "@/lib/attendance/summary";

export const Route = createFileRoute("/attendance")({
  component: AttendancePage,
});

type Geo = { lat: number; lng: number; accuracy?: number };

function readPosition(): Promise<{ pos: Geo | null; denied: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ pos: null, denied: false, error: "Geolocation not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, denied: false }),
      (err) =>
        resolve({
          pos: null,
          denied: err.code === err.PERMISSION_DENIED,
          error: err.message,
        }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

function AttendancePage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (!user) return;
    const { from, to } = monthRange(new Date());
    const [s, t, m] = await Promise.all([
      getAttendanceSettings(),
      getTodayAttendance(user.id),
      listAttendanceForRange(user.id, from, to).catch(() => []),
    ]);
    setSettings(s);
    setToday(t);
    setMonthRecords(m);
  }, [user]);

  useEffect(() => {
    document.title = "Attendance | GWV Vision Center";
    (async () => {
      setLoading(true);
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, [refresh]);

  // Tick the live work-log timer
  useEffect(() => {
    if (!today?.check_in_at || today?.check_out_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at]);

  const liveSeconds =
    today?.check_in_at && !today?.check_out_at
      ? Math.max(0, Math.floor((now - new Date(today.check_in_at).getTime()) / 1000))
      : today
        ? today.total_work_seconds || workSeconds(today.check_in_at, today.check_out_at)
        : 0;

  const handleCheckIn = async () => {
    if (!user || !settings) return;
    setBusy(true);
    setMessage(null);
    try {
      const { pos, denied } = await readPosition();
      const decision = decideCheckIn({
        position: pos,
        permissionDenied: denied,
        settings: {
          office_lat: settings.office_lat,
          office_lng: settings.office_lng,
          allowed_radius_meters: settings.allowed_radius_meters,
          enable_location_required: settings.enable_location_required,
        },
      });
      if (!decision.allowed) {
        setMessage({ tone: "err", text: decision.reason });
        return;
      }
      await checkIn({
        userId: user.id,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        accuracy: pos?.accuracy ?? null,
        locationStatus: decision.locationStatus,
      });
      await refresh();
      setMessage({ tone: "ok", text: "Checked in. Have a productive day." });
    } catch (e) {
      setMessage({ tone: "err", text: e instanceof Error ? e.message : "Check-in failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!today?.id || !today?.check_in_at) return;
    setBusy(true);
    setMessage(null);
    try {
      const { pos } = await readPosition();
      await checkOut({
        recordId: today.id,
        checkInAt: today.check_in_at,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        accuracy: pos?.accuracy ?? null,
      });
      await refresh();
      setMessage({ tone: "ok", text: "Checked out. Work log saved." });
    } catch (e) {
      setMessage({ tone: "err", text: e instanceof Error ? e.message : "Check-out failed" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading attendance…</div>;

  const isCheckedIn = !!today?.check_in_at && !today?.check_out_at;
  const isCheckedOut = !!today?.check_out_at;
  const lateCfg = {
    expectedCheckInTime: settings?.expected_check_in_time ?? null,
    graceMinutes: settings?.late_grace_minutes ?? 15,
  };
  const missedCutoff = settings?.missed_cutoff_time ?? "12:00";
  const missedToday = isMissedForDate(
    today ? { date: today.date, check_in_at: today.check_in_at } : null,
    new Date(),
    new Date(),
    missedCutoff,
  );
  const lateMins = lateMinutes(today?.check_in_at ?? null, lateCfg);
  const isLate = lateMins > 0;
  const statusLabel = isCheckedOut
    ? "Checked Out"
    : isCheckedIn
      ? (isLate ? "Checked In (Late)" : "Checked In")
      : missedToday ? "Missed" : "Not Checked In";
  const statusColor = isCheckedOut
    ? "var(--ink4)"
    : isCheckedIn
      ? (isLate ? "var(--red, #b3271f)" : "var(--green)")
      : missedToday ? "var(--red, #b3271f)" : "var(--amber)";

  const monthly = computeMonthlySummary(
    monthRecords.map((r) => ({ date: r.date, check_in_at: r.check_in_at })),
    lateCfg,
    new Date(),
    missedCutoff,
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Daily Accountability</div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(28px,3vw,40px)",
          fontWeight: 700, color: "var(--ink)", margin: 0,
        }}>
          Attendance
        </h1>
        <p style={{ color: "var(--ink3)", marginTop: 6, fontSize: 14 }}>
          Check in to start your work log. Your location is captured only at check-in and check-out.
        </p>
      </div>

      <div style={{
        background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 12,
        padding: 28, marginBottom: 20,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em",
              textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6,
            }}>
              Today · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                background: statusColor,
              }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{statusLabel}</span>
              {isLate && (
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".08em",
                  textTransform: "uppercase", padding: "2px 8px", borderRadius: 4,
                  background: "var(--red-bg,#fdecec)", color: "var(--red,#b3271f)",
                  border: "1px solid var(--red-b,#f3c8c5)",
                }}>Late · {lateMins}m</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink3)" }}>
              {today?.check_in_at && `Checked in at ${new Date(today.check_in_at).toLocaleTimeString()}`}
              {today?.check_out_at && ` · Checked out at ${new Date(today.check_out_at).toLocaleTimeString()}`}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em",
              textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6,
            }}>
              Work Log
            </div>
            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 600,
              color: "var(--ink)", letterSpacing: ".02em",
            }}>
              {formatWorkDuration(liveSeconds)}
            </div>
          </div>
          <div>
            {!isCheckedIn && !isCheckedOut && (
              <button onClick={handleCheckIn} disabled={busy} style={primaryBtn}>
                {busy ? "Checking in…" : "Check In"}
              </button>
            )}
            {isCheckedIn && (
              <button onClick={handleCheckOut} disabled={busy} style={primaryBtn}>
                {busy ? "Checking out…" : "Check Out"}
              </button>
            )}
            {isCheckedOut && (
              <div style={{ padding: "10px 20px", color: "var(--ink3)", fontSize: 13 }}>
                You're done for today. Rest well.
              </div>
            )}
          </div>
        </div>

        {message && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: message.tone === "err" ? "var(--red-bg, #fdecec)" : "var(--green-bg, #eaf5ed)",
            color: message.tone === "err" ? "var(--red, #b3271f)" : "var(--green, #2c7a3e)",
            border: `1px solid ${message.tone === "err" ? "var(--red-b, #f3c8c5)" : "var(--green-b, #c4e0cd)"}`,
          }}>
            {message.text}
          </div>
        )}

        <div style={{
          marginTop: 18, padding: "12px 14px", borderRadius: 8, background: "var(--parchment, #faf6ee)",
          fontSize: 12, color: "var(--ink3)", display: "flex", gap: 18, flexWrap: "wrap",
        }}>
          <div><strong style={{ color: "var(--ink)" }}>Office:</strong> {settings?.office_name ?? "—"}</div>
          <div><strong style={{ color: "var(--ink)" }}>Radius:</strong> {settings?.allowed_radius_meters ?? "—"} m</div>
          <div><strong style={{ color: "var(--ink)" }}>Location required:</strong> {settings?.enable_location_required ? "Yes" : "No"}</div>
          {settings && (settings.office_lat == null || settings.office_lng == null) && (
            <div style={{ color: "var(--amber)" }}>
              Office coordinates not set — geofence inactive.
            </div>
          )}
        </div>
      </div>

      <div data-testid="employee-attendance-summary" style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12, marginBottom: 20,
      }}>
        <SummaryTile label="Current Streak" value={monthly.currentStreak} suffix=" days" tone={monthly.currentStreak > 0 ? "good" : "neutral"} />
        <SummaryTile label="Present (Month)" value={monthly.presentDays} tone="good" />
        <SummaryTile label="Late (Month)" value={monthly.lateDays} tone={monthly.lateDays > 0 ? "bad" : "neutral"} />
        <SummaryTile label="Missed (Month)" value={monthly.missedDays} tone={monthly.missedDays > 0 ? "bad" : "neutral"} />
      </div>

      {admin && <AdminTodayPanel />}
    </div>
  );
}

function SummaryTile({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red, #b3271f)" : "var(--ink)";
  return (
    <div style={{
      background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>
        {value}{suffix && <span style={{ fontSize: 14, color: "var(--ink4)", fontWeight: 400 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function AdminTodayPanel() {
  const [rows, setRows] = useState<AttendanceRecordWithIdentity[] | null>(null);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [monthRows, setMonthRows] = useState<AttendanceRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const ym = today.slice(0, 7);
        const [r, s, mr] = await Promise.all([
          listAttendanceForDateWithIdentity(today),
          getAttendanceSettings(),
          listAttendanceForMonth(ym),
        ]);
        setRows(r);
        setSettings(s);
        setMonthRows(mr);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  const lateCfg = {
    expectedCheckInTime: settings?.expected_check_in_time ?? null,
    graceMinutes: settings?.late_grace_minutes ?? 15,
  };

  const statusLabel = (r: AttendanceRecord) =>
    r.check_out_at ? "Checked Out" : r.check_in_at ? "Checked In" : "—";

  const todayCheckedIn = rows?.filter((r) => !!r.check_in_at).length ?? 0;
  const todayLate = rows?.filter((r) => isLateCheckIn(r.check_in_at, lateCfg)).length ?? 0;
  const missedCutoff = settings?.missed_cutoff_time ?? "12:00";
  const todayNotCheckedIn = rows?.filter((r) => !r.check_in_at).length ?? 0;

  // Build per-employee monthly summary from rows we already loaded.
  const idToName = new Map<string, string>();
  for (const r of rows ?? []) idToName.set(r.user_id, r.employee_name);
  const byUser = new Map<string, AttendanceRecord[]>();
  for (const r of monthRows ?? []) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <div className="panel-title">Team Attendance — Today</div>
          <div className="panel-sub">Admin view of all check-ins</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, padding: "8px 26px 0", flexWrap: "wrap" }}>
        <AdminStat label="Checked In" value={todayCheckedIn} />
        <AdminStat label="Not Checked In" value={todayNotCheckedIn} tone={todayNotCheckedIn > 0 ? "bad" : "neutral"} />
        <AdminStat label="Late Today" value={todayLate} tone={todayLate > 0 ? "bad" : "neutral"} />
      </div>

      <div style={{ padding: "8px 26px 24px", overflowX: "auto" }}>
        {err && <div style={{ color: "var(--red)", fontSize: 13 }}>{err}</div>}
        {!rows && !err && <div style={{ color: "var(--ink4)", fontSize: 13, padding: 12 }}>Loading…</div>}
        {rows && rows.length === 0 && (
          <div style={{ color: "var(--ink4)", fontSize: 13, padding: 12 }}>No check-ins yet today.</div>
        )}
        {rows && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink4)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>
                <th style={{ padding: "8px 8px 8px 0" }}>Employee</th>
                <th style={{ padding: "8px" }}>Email</th>
                <th style={{ padding: "8px" }}>Position</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px" }}>Check In</th>
                <th style={{ padding: "8px" }}>Check Out</th>
                <th style={{ padding: "8px" }}>Worked</th>
                <th style={{ padding: "8px" }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 8px 10px 0", color: "var(--ink)", fontWeight: 500 }}>
                    {r.employee_name}
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{r.employee_email ?? "—"}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{r.employee_position ?? "—"}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>
                    {statusLabel(r)}
                    {isLateCheckIn(r.check_in_at, lateCfg) && (
                      <span style={{
                        marginLeft: 6, fontFamily: "'DM Mono',monospace", fontSize: 9,
                        padding: "1px 6px", borderRadius: 3,
                        background: "var(--red-bg,#fdecec)", color: "var(--red,#b3271f)",
                        border: "1px solid var(--red-b,#f3c8c5)",
                      }}>LATE</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : "—"}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace" }}>
                    {formatWorkDuration(r.total_work_seconds || workSeconds(r.check_in_at, r.check_out_at))}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`status-pill ${r.location_status === "inside" ? "sp-profit" : r.location_status === "outside" ? "sp-loss" : "sp-muted"}`}>
                      {r.location_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {monthRows && byUser.size > 0 && (
        <>
          <div className="ph" style={{ marginTop: 8 }}>
            <div>
              <div className="panel-title">Monthly Summary</div>
              <div className="panel-sub">Present / Late / Missed this month</div>
            </div>
          </div>
          <div style={{ padding: "8px 26px 24px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink4)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  <th style={{ padding: "8px 8px 8px 0" }}>Employee</th>
                  <th style={{ padding: "8px" }}>Present</th>
                  <th style={{ padding: "8px" }}>Late</th>
                  <th style={{ padding: "8px" }}>Missed</th>
                  <th style={{ padding: "8px" }}>Streak</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byUser.entries()).map(([uid, recs]) => {
                  const s = computeMonthlySummary(
                    recs.map((r) => ({ date: r.date, check_in_at: r.check_in_at })),
                    lateCfg,
                    new Date(),
                    missedCutoff,
                  );
                  return (
                    <tr key={uid} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px 10px 0", color: "var(--ink)", fontWeight: 500 }}>
                        {idToName.get(uid) ?? `User ${uid.slice(0, 8)}…`}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{s.presentDays}</td>
                      <td style={{ padding: "10px 8px", color: s.lateDays > 0 ? "var(--red)" : undefined }}>{s.lateDays}</td>
                      <td style={{ padding: "10px 8px", color: s.missedDays > 0 ? "var(--red)" : undefined }}>{s.missedDays}</td>
                      <td style={{ padding: "10px 8px" }}>{s.currentStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AdminStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "good"|"bad"|"neutral" }) {
  const color = tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red)" : "var(--ink)";
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px",
      background: "var(--ivory)", minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 28px",
  borderRadius: 8,
  background: "var(--ink)",
  color: "var(--parchment, #fff)",
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "'Figtree',sans-serif",
  cursor: "pointer",
  letterSpacing: ".01em",
};
