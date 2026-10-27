// History page: last 30 days good-day rate, avg revisions, on-time trend.
// Own for editor; admin sees all editors.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { PageHeader, MetricCard } from "@/components/marketizers/ui";
import {
  listDailyRange,
  getActiveConfig,
  type VeDailyRow,
  type VeConfig,
} from "@/services/videoEditor/videoEditorKpiService";

export default function VideoEditorHistoryPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const { teamMember, isVideoEditor, loading: tmLoading } = useMyTeamMember();
  const [rows, setRows] = useState<VeDailyRow[]>([]);
  const [cfg, setCfg] = useState<VeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { document.title = "Video Editor KPI History | IPC | GWV Vision Center"; }, []);

  useEffect(() => {
    if (tmLoading) return;
    if (!admin && !isVideoEditor) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const to = new Date();
        const from = new Date(); from.setDate(from.getDate() - 29);
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const scope = admin ? null : teamMember?.id ?? null;
        const [rs, c] = await Promise.all([
          listDailyRange(scope, iso(from), iso(to)),
          getActiveConfig(),
        ]);
        setRows(rs); setCfg(c);
      } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [admin, isVideoEditor, teamMember, tmLoading]);

  if (tmLoading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!admin && !isVideoEditor) return <div style={{ padding: 40, color: "var(--ink3)" }}>Access restricted to admin or Video Editors.</div>;

  const total = rows.length;
  const good = rows.filter((r) => r.good_day).length;
  const goodRate = total ? Math.round((good / total) * 100) : 0;
  const avgRev = total ? (rows.reduce((s, r) => s + (r.max_revision_rounds || 0), 0) / total) : 0;
  const totalCommitted = rows.reduce((s, r) => s + (r.committed_pieces || 0), 0);
  const totalShipped = rows.reduce((s, r) => s + (r.shipped_finished || 0), 0);
  const onTimePct = totalCommitted > 0 ? Math.round((totalShipped / totalCommitted) * 100) : 0;

  const cnTone: "gold" | "green" | "amber" | "red" = cfg
    ? onTimePct >= cfg.cn_green ? "green" : onTimePct >= cfg.cn_red ? "amber" : "red"
    : "gold";

  return (
    <div>
      <PageHeader
        eyebrow="IPC / Team Performance / Video Editor"
        title="KPI History (Last 30 days)"
        subtitle={admin ? "All Video Editors." : `Your last 30 days${teamMember?.name ? ` — ${teamMember.name}` : ""}.`}
        actions={
          <Link to="/brands/ipc/team-performance/video-editor-performance">
            <button className="btn-sm">← Back</button>
          </Link>
        }
      />
      {err && <div style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8, marginBottom: 16 }}>{err}</div>}
      {loading ? <div>Loading…</div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            <MetricCard accent={goodRate >= 80 ? "green" : goodRate >= 50 ? "amber" : "red"} label="Good-Day Rate" value={`${goodRate}%`} helper={`${good} of ${total} days`} />
            <MetricCard accent="gold" label="Avg Revision Rounds" value={avgRev.toFixed(1)} />
            <MetricCard accent={cnTone as any} label="On-Time vs Commit" value={`${onTimePct}%`} helper={`${totalShipped} / ${totalCommitted}`} />
            <MetricCard accent="gold" label="Days Logged" value={String(total)} />
          </div>

          {cfg && (
            <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>
                Critical Number
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 8 }}>{cfg.cn_label}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                Target {cfg.cn_target}% · Super-Green ≥ {cfg.cn_super_green}% · Green ≥ {cfg.cn_green}% · Red &lt; {cfg.cn_red}%
              </div>
            </div>
          )}

          <div className="panel" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--ivory2, #fafaf7)" }}>
                  <Th>Date</Th><Th>Committed</Th><Th>Shipped</Th><Th>Finish Gate</Th><Th>Revisions</Th><Th>Backup</Th><Th>Good Day</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--ink4)" }}>No KPI logs in the last 30 days.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>{r.report_date}</Td>
                    <Td>{r.committed_pieces}</Td>
                    <Td>{r.shipped_finished}</Td>
                    <Td>{r.finish_gate_passed ? "✓" : "✗"}</Td>
                    <Td>{r.max_revision_rounds}</Td>
                    <Td>{r.backed_up_eod ? "✓" : "✗"}</Td>
                    <Td>
                      <span style={{
                        display: "inline-block", width: 10, height: 10, borderRadius: 999,
                        background: r.good_day ? "#059669" : "#e11d48",
                      }} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 14px", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink4)" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{children}</td>;
}
