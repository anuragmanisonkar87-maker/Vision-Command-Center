import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  getAttendanceSettings,
  getTodayAttendance,
  checkIn,
  type AttendanceSettings,
  type AttendanceRecord,
} from "@/services/attendance/attendanceService";
import { decideCheckIn } from "@/lib/attendance/geofence";
import { shouldPromptAutoCheckIn } from "@/lib/attendance/autoCheckIn";

type Geo = { lat: number; lng: number; accuracy?: number };

function readPosition(): Promise<{ pos: Geo | null; denied: boolean }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ pos: null, denied: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, denied: false }),
      (err) => resolve({ pos: null, denied: err.code === err.PERMISSION_DENIED }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/**
 * Renders an auto check-in banner on the employee dashboard.
 * - Admins never see it.
 * - Hidden when the admin disabled the auto-prompt setting, or when the
 *   employee has already checked in / checked out today.
 * - Captures GPS only at click time; never tracks in the background.
 */
export default function AutoCheckInPrompt({
  onCheckedIn,
}: {
  onCheckedIn?: (rec: AttendanceRecord) => void;
}) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, a] = await Promise.all([
          getAttendanceSettings(),
          getTodayAttendance(user.id),
        ]);
        if (cancelled) return;
        setSettings(s);
        setAttendance(a);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!ready || dismissed) return null;
  if (!shouldPromptAutoCheckIn(user, attendance, settings)) return null;

  const handleClick = async () => {
    if (!user || !settings) return;
    setBusy(true); setError(null);
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
        setError(decision.reason);
        return;
      }
      const rec = await checkIn({
        userId: user.id,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        accuracy: pos?.accuracy ?? null,
        locationStatus: decision.locationStatus,
      });
      setAttendance(rec);
      setDismissed(true);
      onCheckedIn?.(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="auto-checkin-prompt"
      style={{
        background: "var(--ivory)",
        border: "1px solid var(--gold3, #C9973A)",
        borderRadius: 12,
        padding: "18px 22px",
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ flex: "1 1 280px" }}>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em",
          textTransform: "uppercase", color: "var(--gold2, #b58a2e)", marginBottom: 6,
        }}>
          Attendance · Action Needed
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
          Start Your Work Log
        </div>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          Please allow location access to check in and start your work timer.
        </div>
        {error && (
          <div
            data-testid="auto-checkin-error"
            style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 6, fontSize: 12.5,
              background: "var(--red-bg,#fdecec)", color: "var(--red,#b3271f)",
              border: "1px solid var(--red-b,#f3c8c5)",
            }}
          >
            {error}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={handleClick}
          disabled={busy}
          data-testid="auto-checkin-button"
          style={{
            padding: "11px 22px",
            background: "var(--ink)",
            color: "var(--parchment,#fff)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Checking in…" : "Check In Now"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          disabled={busy}
          style={{
            padding: "11px 14px",
            background: "transparent",
            color: "var(--ink3)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
