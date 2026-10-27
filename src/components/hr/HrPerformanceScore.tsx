import { useMemo } from "react";
import { EmptyState } from "@/components/marketizers/ui";

type Report = {
  id: string; report_date: string; hr_user_id: string | null; hr_name: string | null;
  report_status: string; score_total: number;
  score_breakdown: Record<string, number>;
  penalty_breakdown: any[]; bonus_breakdown: any[];
};

export function HrPerformanceScore({ reports, userId, adminView }: {
  reports: Report[]; userId: string | null; adminView: boolean;
}) {
  const own = useMemo(
    () => reports.filter((r) => adminView || r.hr_user_id === userId),
    [reports, userId, adminView],
  );
  if (own.length === 0) return <EmptyState icon="📈" title="No performance data yet" message="Submit your first daily report." />;

  const today = own[0];
  const last7 = own.slice(0, 7);
  const avg7 = Math.round(last7.reduce((s, r) => s + Number(r.score_total || 0), 0) / Math.max(1, last7.length));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, marginBottom: 22 }}>
        <ScoreRing score={Math.round(today.score_total)} />
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>Today's Score Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
            {Object.entries(today.score_breakdown || {}).map(([k, v]) => (
              <div key={k} style={{ background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>{k}</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>{Math.round(Number(v))}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 13 }}>
            7-day average: <strong>{avg7}/100</strong>
          </div>
        </div>
      </div>

      <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, margin: "0 0 10px" }}>Score Ledger (last {own.length})</h4>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Date", "Status", "Score", "Penalties", "Bonuses"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {own.slice(0, 30).map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                <td style={{ padding: "10px 8px" }}>{r.report_date}</td>
                <td style={{ padding: "10px 8px" }}>
                  <span className={`status-pill ${r.report_status === "submitted" ? "sp-profit" : r.report_status === "reporting_non_compliant" ? "sp-loss" : "sp-warn"}`}>{r.report_status}</span>
                </td>
                <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace" }}>{Math.round(Number(r.score_total))}</td>
                <td style={{ padding: "10px 8px", fontSize: 11, color: "var(--red)" }}>{(r.penalty_breakdown || []).map((p: any) => `${p.reason} (${p.delta})`).join(", ") || "—"}</td>
                <td style={{ padding: "10px 8px", fontSize: 11, color: "var(--green)" }}>{(r.bonus_breakdown || []).map((b: any) => `${b.reason} (+${b.delta})`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const safe = isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const color = safe >= 75 ? "var(--green)" : safe >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{
      width: 200, height: 200, borderRadius: "50%", display: "grid", placeItems: "center", margin: "auto",
      background: `conic-gradient(${color} 0 ${safe}%, var(--parchment2) ${safe}% 100%)`, position: "relative",
    }}>
      <div style={{ position: "absolute", inset: 18, background: "var(--ivory)", borderRadius: "50%" }} />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{safe}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", color: "var(--ink4)", textTransform: "uppercase", marginTop: 4 }}>Today's Score</div>
      </div>
    </div>
  );
}
