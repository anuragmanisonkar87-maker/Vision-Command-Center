// Employee daily reporting: <60s form for the logged-in Video Editor.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth/useAuth";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { PageHeader, FieldLabel, inputStyle } from "@/components/marketizers/ui";
import {
  getActiveConfig,
  getDaily,
  upsertDaily,
  todayISO,
  computeGoodDay,
  type VeConfig,
  type VeDailyRow,
} from "@/services/videoEditor/videoEditorKpiService";

export default function VideoEditorDailyReportingPage() {
  const { user } = useAuth();
  const { teamMember, isVideoEditor, loading: tmLoading } = useMyTeamMember();
  const [cfg, setCfg] = useState<VeConfig | null>(null);
  const [row, setRow] = useState<Partial<VeDailyRow>>({
    committed_pieces: 0,
    shipped_finished: 0,
    finish_gate_passed: false,
    max_revision_rounds: 0,
    backed_up_eod: false,
    blockers: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = todayISO();

  useEffect(() => { document.title = "Video Editor Daily KPI | IPC | GWV Vision Center"; }, []);

  useEffect(() => {
    if (!teamMember) return;
    (async () => {
      setLoading(true);
      try {
        const [c, existing] = await Promise.all([getActiveConfig(), getDaily(teamMember.id, today)]);
        setCfg(c);
        if (existing) setRow(existing);
      } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [teamMember, today]);

  async function handleSave() {
    if (!teamMember || !user) return;
    setSaving(true); setMsg(null); setErr(null);
    try {
      const saved = await upsertDaily(teamMember.id, user.id, today, {
        committed_pieces: Number(row.committed_pieces) || 0,
        shipped_finished: Number(row.shipped_finished) || 0,
        finish_gate_passed: !!row.finish_gate_passed,
        max_revision_rounds: Number(row.max_revision_rounds) || 0,
        backed_up_eod: !!row.backed_up_eod,
        blockers: row.blockers ?? null,
        extra: (row.extra as any) ?? {},
      });
      setRow(saved);
      setMsg(saved.good_day ? "Saved. 🟢 Good day recorded." : "Saved. 🔴 Not a good day yet — hit committed + finish gate + backup to earn it.");
    } catch (e: any) { setErr(e?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  if (tmLoading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!isVideoEditor) {
    return (
      <div style={{ padding: 40, color: "var(--ink3)" }}>
        This page is only for team members whose position is Video Editor.
      </div>
    );
  }

  const currentGood = computeGoodDay({
    committed_pieces: Number(row.committed_pieces) || 0,
    shipped_finished: Number(row.shipped_finished) || 0,
    finish_gate_passed: !!row.finish_gate_passed,
    backed_up_eod: !!row.backed_up_eod,
  });

  const cnPct = cfg && cfg.cn_target > 0
    ? Math.min(100, Math.round((Number(row.shipped_finished) || 0) / (cfg.daily_commit_target || 1) * 100))
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="IPC / Team Performance / Video Editor"
        title="Today's KPI"
        subtitle={`Log today's editing output in under a minute. ${teamMember?.name ?? ""}`}
        actions={
          <Link to="/brands/ipc/team-performance/video-editor-performance">
            <button className="btn-sm">← Back</button>
          </Link>
        }
      />

      {loading ? <div>Loading…</div> : (
        <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
          {err && <Banner tone="bad">{err}</Banner>}
          {msg && <Banner tone={currentGood ? "good" : "warn"}>{msg}</Banner>}

          <section className="panel" style={{ padding: 20, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <NumField label={`Committed pieces (target ${cfg?.daily_commit_target ?? "—"})`}
                value={Number(row.committed_pieces) || 0}
                onChange={(v) => setRow({ ...row, committed_pieces: v })} />
              <NumField label="Shipped / finished"
                value={Number(row.shipped_finished) || 0}
                onChange={(v) => setRow({ ...row, shipped_finished: v })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <BoolField label="Finish gate passed?" value={!!row.finish_gate_passed}
                onChange={(v) => setRow({ ...row, finish_gate_passed: v })} />
              <BoolField label="Backed up at EOD?" value={!!row.backed_up_eod}
                onChange={(v) => setRow({ ...row, backed_up_eod: v })} />
            </div>
            <NumField label="Max revision rounds" value={Number(row.max_revision_rounds) || 0}
              onChange={(v) => setRow({ ...row, max_revision_rounds: v })} />
            <div>
              <FieldLabel>Blockers</FieldLabel>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={row.blockers ?? ""}
                onChange={(e) => setRow({ ...row, blockers: e.target.value })} />
            </div>
          </section>

          <section className="panel" style={{ padding: 20, display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 999,
                background: currentGood ? "#059669" : "#e11d48",
                boxShadow: `0 0 0 4px ${currentGood ? "#ecfdf5" : "#fff1f2"}`,
              }} />
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)" }}>Good Day</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: currentGood ? "#059669" : "#e11d48" }}>
                  {currentGood ? "Yes" : "Not yet"}
                </div>
              </div>
            </div>
            {cfg && (
              <div style={{ minWidth: 220 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>
                  Critical Number Progress
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 6 }}>{cfg.cn_label}</div>
                <div style={{ height: 8, background: "#eef2ff", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${cnPct}%`, background: cnPct >= cfg.cn_super_green ? "#059669" : cnPct >= cfg.cn_green ? "#22c55e" : cnPct >= cfg.cn_red ? "#f59e0b" : "#e11d48" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 4 }}>Today {cnPct}% of daily commit target</div>
              </div>
            )}
          </section>

          <div>
            <button className="btn-sm" disabled={saving} onClick={handleSave}
              style={{ background: "var(--ink)", color: "var(--parchment)" }}>
              {saving ? "Saving…" : "Save Today's KPI"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type="number" style={inputStyle} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-sm" onClick={() => onChange(true)}
          style={{ background: value ? "#059669" : "transparent", color: value ? "#fff" : "var(--ink)" }}>Yes</button>
        <button className="btn-sm" onClick={() => onChange(false)}
          style={{ background: !value ? "#e11d48" : "transparent", color: !value ? "#fff" : "var(--ink)" }}>No</button>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "good" | "bad" | "warn"; children: React.ReactNode }) {
  const c = tone === "good" ? { bg: "#ecfdf5", fg: "#059669", bd: "#a7f3d0" }
    : tone === "warn" ? { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" }
    : { bg: "#fff1f2", fg: "#9f1239", bd: "#fecdd3" };
  return (
    <div style={{ padding: "10px 14px", background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 8, fontSize: 13 }}>
      {children}
    </div>
  );
}
