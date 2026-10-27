// Personal KPI history — own rows only (admins also see own via team-member id).
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { listDailyRange, type KpiDailyEntry } from "@/services/kpi/kpiService";

const box: React.CSSProperties = { border: "1px solid var(--edge)", borderRadius: 10, padding: 16, background: "var(--panel)" };

function isoDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function KpiHistoryPage() {
  const { teamMember, loading: memberLoading } = useMyTeamMember();
  const [rows, setRows] = useState<KpiDailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => { document.title = "KPI History | GWV Vision Center"; }, []);

  useEffect(() => {
    if (memberLoading || !teamMember) return;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const r = await listDailyRange(teamMember.id, isoDaysAgo(days - 1), isoDaysAgo(0));
        setRows(r);
      } catch (e: any) { setErr(e?.message ?? "Load failed"); }
      finally { setLoading(false); }
    })();
  }, [teamMember?.id, memberLoading, days]);

  const streak = useMemo(() => {
    // Count consecutive good days from most recent backwards
    let s = 0;
    for (const r of rows) { if (r.good_day) s++; else break; }
    return s;
  }, [rows]);

  const goodCount = rows.filter((r) => r.good_day).length;

  if (memberLoading || loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!teamMember) return <div style={{ padding: 24 }}>No team member profile linked to your account.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>KPI History</h1>
        <Link to="/kpi/daily" style={{ fontSize: 13, color: "var(--brand)" }}>Log today →</Link>
      </div>
      {err && <div style={{ ...box, borderColor: "#c00", color: "#c00", marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ ...box, flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--ink4)" }}>Current good-day streak</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: streak > 0 ? "#059669" : "var(--ink)" }}>{streak}</div>
        </div>
        <div style={{ ...box, flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--ink4)" }}>Good days (last {days})</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{goodCount} / {rows.length}</div>
        </div>
        <div style={{ ...box, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--ink4)" }}>Range:</span>
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setDays(n)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--edge)", background: days === n ? "var(--brand)" : "var(--panel-2)", color: days === n ? "white" : "var(--ink)", cursor: "pointer", fontSize: 12 }}>{n}d</button>
          ))}
        </div>
      </div>

      <div style={box}>
        {rows.length === 0 ? <div style={{ color: "var(--ink4)" }}>No entries in this range.</div> : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink4)" }}>
                <th style={{ padding: "6px 4px" }}>Date</th><th>Committed</th><th>Shipped</th><th>Quality</th><th>Good day</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--edge)" }}>
                  <td style={{ padding: "6px 4px" }}>{r.entry_date}</td>
                  <td>{r.committed ?? "—"}</td>
                  <td>{r.shipped ?? "—"}</td>
                  <td>{r.quality_passed ? "✓" : "—"}</td>
                  <td>{r.good_day ? <span style={{ color: "#059669", fontWeight: 600 }}>● Good</span> : <span style={{ color: "var(--ink4)" }}>—</span>}</td>
                  <td style={{ color: "var(--ink4)" }}>{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
