import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import {
  getAttendanceSettings,
  upsertAttendanceSettings,
  type AttendanceSettings,
} from "@/services/attendance/attendanceService";

export const Route = createFileRoute("/settings/attendance")({
  component: AttendanceSettingsPage,
});

function AttendanceSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState<AttendanceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Attendance Settings | GWV Vision Center";
    getAttendanceSettings().then(setS).catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (!authLoading && user && !isAdmin(user)) {
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, user, navigate]);

  if (!s) return <div style={{ padding: 24 }}>Loading…</div>;

  const handleSave = async () => {
    setBusy(true); setMsg(null);
    try {
      const updated = await upsertAttendanceSettings({
        office_name: s.office_name,
        office_lat: s.office_lat,
        office_lng: s.office_lng,
        allowed_radius_meters: s.allowed_radius_meters,
        allowed_check_in_start_time: s.allowed_check_in_start_time,
        expected_check_in_time: s.expected_check_in_time,
        expected_check_out_time: s.expected_check_out_time,
        timezone: s.timezone,
        enable_location_required: s.enable_location_required,
        enable_auto_checkin_prompt: s.enable_auto_checkin_prompt,
        late_grace_minutes: s.late_grace_minutes,
        missed_cutoff_time: s.missed_cutoff_time,
      });
      setS(updated);
      setMsg("Settings saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setS({ ...s, office_lat: p.coords.latitude, office_lng: p.coords.longitude }),
      (err) => setMsg(`Couldn't read location: ${err.message}`),
    );
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const input: React.CSSProperties = {
    padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6,
    fontSize: 13, fontFamily: "inherit", background: "var(--ivory, #fff)", color: "var(--ink)",
  };
  const label: React.CSSProperties = { fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".08em" };

  return (
    <div>
      <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, margin: 0, color: "var(--ink)" }}>
        Attendance Settings
      </h1>
      <p style={{ color: "var(--ink3)", marginTop: 6, marginBottom: 24, fontSize: 14 }}>
        Configure the office location and geofence radius. Employees will only be allowed to check in when location is required and they're inside this radius.
      </p>

      <div style={{
        background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10,
        padding: 24, maxWidth: 720, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        <div style={{ ...field, gridColumn: "span 2" }}>
          <label style={label}>Office Name</label>
          <input style={input} value={s.office_name} onChange={(e) => setS({ ...s, office_name: e.target.value })} />
        </div>
        <div style={field}>
          <label style={label}>Office Latitude</label>
          <input style={input} type="number" step="any" value={s.office_lat ?? ""}
            onChange={(e) => setS({ ...s, office_lat: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
        <div style={field}>
          <label style={label}>Office Longitude</label>
          <input style={input} type="number" step="any" value={s.office_lng ?? ""}
            onChange={(e) => setS({ ...s, office_lng: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <button onClick={useMyLocation} style={{
            padding: "6px 12px", fontSize: 12, border: "1px solid var(--border)",
            background: "transparent", borderRadius: 6, cursor: "pointer", color: "var(--ink)",
          }}>
            Use my current location
          </button>
        </div>
        <div style={field}>
          <label style={label}>Allowed Radius (meters)</label>
          <select style={input} value={s.allowed_radius_meters}
            onChange={(e) => setS({ ...s, allowed_radius_meters: Number(e.target.value) })}>
            <option value={50}>50 m</option>
            <option value={100}>100 m</option>
            <option value={200}>200 m</option>
          </select>
        </div>
        <div style={field}>
          <label style={label}>Timezone</label>
          <input style={input} value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} />
        </div>
        <div style={field}>
          <label style={label}>Allowed Check-in Start</label>
          <input style={input} type="time" value={s.allowed_check_in_start_time ?? ""}
            onChange={(e) => setS({ ...s, allowed_check_in_start_time: e.target.value || null })} />
        </div>
        <div style={field}>
          <label style={label}>Expected Check-in</label>
          <input style={input} type="time" value={s.expected_check_in_time ?? ""}
            onChange={(e) => setS({ ...s, expected_check_in_time: e.target.value || null })} />
        </div>
        <div style={field}>
          <label style={label}>Expected Check-out</label>
          <input style={input} type="time" value={s.expected_check_out_time ?? ""}
            onChange={(e) => setS({ ...s, expected_check_out_time: e.target.value || null })} />
        </div>
        <div style={field}>
          <label style={label}>Late Grace Period (minutes)</label>
          <input style={input} type="number" min={0} max={120} value={s.late_grace_minutes ?? 15}
            onChange={(e) => setS({ ...s, late_grace_minutes: Number(e.target.value) || 0 })} />
        </div>
        <div style={field}>
          <label style={label}>Missed Check-in Cutoff</label>
          <input style={input} type="time" value={s.missed_cutoff_time ?? "12:00"}
            onChange={(e) => setS({ ...s, missed_cutoff_time: e.target.value || "12:00" })} />
        </div>
        <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 10 }}>
          <input id="locreq" type="checkbox" checked={s.enable_location_required}
            onChange={(e) => setS({ ...s, enable_location_required: e.target.checked })} />
          <label htmlFor="locreq" style={{ fontSize: 13, color: "var(--ink)" }}>
            Require location for check-in (enforces geofence)
          </label>
        </div>
        <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 10 }}>
          <input id="autoprompt" type="checkbox" checked={s.enable_auto_checkin_prompt}
            onChange={(e) => setS({ ...s, enable_auto_checkin_prompt: e.target.checked })} />
          <label htmlFor="autoprompt" style={{ fontSize: 13, color: "var(--ink)" }}>
            Enable Auto Check-in Prompt on Employee Login
          </label>
        </div>
        <div style={{ gridColumn: "span 2", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleSave} disabled={busy} style={{
            padding: "10px 22px", background: "var(--ink)", color: "var(--parchment,#fff)",
            border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {busy ? "Saving…" : "Save Settings"}
          </button>
          {msg && <span style={{ fontSize: 12, color: "var(--ink3)" }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
