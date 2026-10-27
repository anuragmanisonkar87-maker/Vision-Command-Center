// Employee daily KPI logging — driven by their own position's config.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth/useAuth";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import {
  getConfigForPosition, listDefinitions, getDaily, upsertDaily, todayISO, computeGoodDay,
  type KpiPositionConfig, type KpiDefinition,
} from "@/services/kpi/kpiService";

const box: React.CSSProperties = { border: "1px solid var(--edge)", borderRadius: 10, padding: 16, background: "var(--panel)" };
const inp: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--edge)", background: "var(--panel-2)", color: "var(--ink)", fontSize: 13, width: "100%" };
const btnPri: React.CSSProperties = { padding: "8px 16px", borderRadius: 6, border: "1px solid var(--brand)", background: "var(--brand)", color: "white", fontSize: 14, cursor: "pointer", fontWeight: 600 };

export default function KpiDailyReportingPage() {
  const { user } = useAuth();
  const { teamMember, loading: memberLoading } = useMyTeamMember();
  const [config, setConfig] = useState<KpiPositionConfig | null>(null);
  const [defs, setDefs] = useState<KpiDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [committed, setCommitted] = useState<number>(0);
  const [shipped, setShipped] = useState<number>(0);
  const [qualityPassed, setQualityPassed] = useState<boolean>(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [note, setNote] = useState("");
  const [savedGoodDay, setSavedGoodDay] = useState<boolean | null>(null);

  useEffect(() => { document.title = "Daily KPI | GWV Vision Center"; }, []);

  useEffect(() => {
    if (memberLoading) return;
    if (!teamMember?.positionId) { setLoading(false); return; }
    (async () => {
      setLoading(true); setErr(null);
      try {
        const cfg = await getConfigForPosition(teamMember.positionId!);
        setConfig(cfg);
        if (cfg) {
          const [ds, today] = await Promise.all([
            listDefinitions(cfg.id),
            getDaily(teamMember.id, todayISO()),
          ]);
          setDefs(ds.filter((d) => d.is_active));
          if (today) {
            setCommitted(Number(today.committed ?? 0));
            setShipped(Number(today.shipped ?? 0));
            setQualityPassed(!!today.quality_passed);
            setValues((today.values as any) ?? {});
            setNote(today.note ?? "");
            setSavedGoodDay(today.good_day);
          } else {
            setCommitted(cfg.daily_commit_target);
          }
        }
      } catch (e: any) { setErr(e?.message ?? "Load failed"); }
      finally { setLoading(false); }
    })();
  }, [teamMember?.id, teamMember?.positionId, memberLoading]);

  const previewGoodDay = useMemo(() => {
    if (!config) return false;
    return computeGoodDay(config, defs, { committed, shipped, quality_passed: qualityPassed, values });
  }, [config, defs, committed, shipped, qualityPassed, values]);

  async function save() {
    if (!config || !teamMember || !user?.id) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      const res = await upsertDaily({
        teamMemberId: teamMember.id, positionId: teamMember.positionId, dateISO: todayISO(),
        userId: user.id, config, definitions: defs,
        committed, shipped, quality_passed: qualityPassed, values, note,
      });
      setSavedGoodDay(res.good_day);
      setOk(res.good_day ? "Saved — GOOD DAY ✓" : "Saved.");
    } catch (e: any) { setErr(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (memberLoading || loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!teamMember) return <div style={{ padding: 24 }}>No team member profile linked to your account.</div>;
  if (!config) return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Daily KPI</h1>
      <div style={box}>No KPI config exists for your position ({teamMember.positionName ?? "unknown"}). Ask an admin to set one up.</div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Daily KPI · {teamMember.positionName}</h1>
        <Link to="/kpi/history" style={{ fontSize: 13, color: "var(--brand)" }}>History →</Link>
      </div>

      {config.critical_number && (
        <div style={{ ...box, marginBottom: 12, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 12, color: "var(--ink4)" }}>Critical Number {config.quarter_label ? `· ${config.quarter_label}` : ""}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {config.critical_number}
            {config.critical_number_target != null && <span style={{ color: "var(--ink4)", fontWeight: 400 }}> — target {config.critical_number_target} {config.critical_number_unit ?? ""}</span>}
          </div>
        </div>
      )}

      {err && <div style={{ ...box, borderColor: "#c00", color: "#c00", marginBottom: 12 }}>{err}</div>}
      {ok && <div style={{ ...box, borderColor: "#0a0", color: "#0a0", marginBottom: 12 }}>{ok}</div>}

      <div style={{ ...box, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Committed today"><input style={inp} type="number" value={committed} onChange={(e) => setCommitted(Number(e.target.value) || 0)} /></Field>
          <Field label="Shipped (finished)"><input style={inp} type="number" value={shipped} onChange={(e) => setShipped(Number(e.target.value) || 0)} /></Field>
          <Field label="Quality gate passed?">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, paddingTop: 6 }}>
              <input type="checkbox" checked={qualityPassed} onChange={(e) => setQualityPassed(e.target.checked)} /> Passed
            </label>
          </Field>
        </div>

        {defs.length > 0 && (
          <div style={{ borderTop: "1px solid var(--edge)", paddingTop: 12, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Custom KPIs</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {defs.map((d) => (
                <Field key={d.id} label={`${d.label}${d.target != null ? ` (target ${d.direction === "lower_better" ? "≤" : "≥"} ${d.target}${d.unit ? " " + d.unit : ""})` : ""}${d.is_quality_gate ? " · quality gate" : ""}`}>
                  {d.kpi_type === "boolean" || d.kpi_type === "quality_gate" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, paddingTop: 6 }}>
                      <input type="checkbox" checked={!!values[d.kpi_key]} onChange={(e) => setValues({ ...values, [d.kpi_key]: e.target.checked })} /> Yes
                    </label>
                  ) : (
                    <input style={inp} type="number" value={values[d.kpi_key] ?? ""} onChange={(e) => setValues({ ...values, [d.kpi_key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Field label="Notes / blockers">
            <textarea style={{ ...inp, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 14, height: 14, borderRadius: "50%",
            background: previewGoodDay ? "#10b981" : "#e5e7eb",
            border: previewGoodDay ? "none" : "1px solid var(--edge)",
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: previewGoodDay ? "#059669" : "var(--ink4)" }}>
            {savedGoodDay == null ? "Preview: " : "Saved: "}{previewGoodDay ? "Good day" : "Not yet"}
          </span>
        </div>
        <button style={btnPri} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save today's report"}</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 4 }}>{label}</div>{children}</div>;
}
