// DailyHrReportDrawer — low-friction daily report with checklist + score.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { Drawer } from "./HiringRequirementDrawer";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import {
  getOrCreateTodayReport, submitReport, updateReport, buildWhatsappSummary, statusFromScore,
} from "@/services/hr/hrDailyReportService";
import { computeScore } from "@/services/hr/hrScoreService";
import { getDailyInterviewSummaryFromHiringBible } from "@/services/hr/hiringBibleIntegrationService";

type Props = {
  kpi: Record<string, any>;
  interviewTarget: number;
  hiringMode: string;
  openPositions: number;
  slaMissed: number;
  onClose: () => void;
  onSaved: () => void;
};

export function DailyHrReportDrawer({ kpi, interviewTarget, hiringMode, openPositions, slaMissed, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const checklistItems: string[] = Array.isArray(kpi.checklist_items)
    ? kpi.checklist_items
    : ["Hiring dashboard checked", "New requirements reviewed", "Hiring inbox checked", "Candidate follow-ups completed", "Daily report submitted"];

  const [checks, setChecks] = useState<boolean[]>(() => checklistItems.map(() => false));

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setLoadError("You need to be signed in to open the daily report.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const r = await getOrCreateTodayReport((user as any).id, user.display_name ?? user.email);
        let hbSummary: any = null;
        try { hbSummary = await getDailyInterviewSummaryFromHiringBible(); } catch { /* ignore */ }
        if (cancelled) return;
        setReport({
          ...r,
          interview_target: r.interview_target || interviewTarget,
          hiring_mode: r.hiring_mode || hiringMode,
          open_positions_count: openPositions,
          sla_missed_count: slaMissed,
          checklist_total_count: checklistItems.length,
          interviews_conducted: r.interviews_conducted || hbSummary?.total_interviews_conducted || 0,
          shortlisted_count: r.shortlisted_count || hbSummary?.shortlisted_count || 0,
          rejected_count: r.rejected_count || hbSummary?.rejected_count || 0,
          ready_pool_added_count: r.ready_pool_added_count || hbSummary?.ready_pool_added_count || 0,
          _hb_summary: hbSummary,
        });
        setChecks(checklistItems.map((_, i) => i < (r.checklist_completed_count || 0)));
      } catch (e: any) {
        if (cancelled) return;
        console.error("[DailyHrReportDrawer] load failed", e);
        setLoadError(e?.message || "Could not load today's report. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, reloadKey]);

  const set = (k: string, v: any) => setReport((p: any) => ({ ...p, [k]: v }));

  const checklistDone = checks.filter(Boolean).length;

  const live = useMemo(() => {
    if (!report) return null;
    return computeScore({
      interviews_conducted: report.interviews_conducted || 0,
      interview_target: report.interview_target || interviewTarget,
      ready_pool_added: report.ready_pool_added_count || 0,
      shortlisted: report.shortlisted_count || 0,
      joined: 0,
      open_positions: openPositions,
      positions_closed: 0,
      sla_missed: slaMissed,
      checklist_completed: checklistDone,
      checklist_total: checklistItems.length,
      report_submitted: true,
      late_submission: false,
      pool_below_minimum: false,
      kpi,
    });
  }, [report, checklistDone]);

  const saveDraft = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await updateReport(report.id, {
        interviews_conducted: report.interviews_conducted || 0,
        shortlisted_count: report.shortlisted_count || 0,
        rejected_count: report.rejected_count || 0,
        ready_pool_added_count: report.ready_pool_added_count || 0,
        open_positions_count: openPositions,
        sla_missed_count: slaMissed,
        checklist_completed_count: checklistDone,
        checklist_total_count: checklistItems.length,
        key_outcomes: report.key_outcomes,
        blockers: report.blockers,
        tomorrow_focus: report.tomorrow_focus,
        followup_notes: report.followup_notes,
        hiring_mode: hiringMode,
        interview_target: report.interview_target || interviewTarget,
      });
      onSaved();
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await updateReport(report.id, {
        interviews_conducted: report.interviews_conducted || 0,
        shortlisted_count: report.shortlisted_count || 0,
        rejected_count: report.rejected_count || 0,
        ready_pool_added_count: report.ready_pool_added_count || 0,
        open_positions_count: openPositions,
        sla_missed_count: slaMissed,
        checklist_completed_count: checklistDone,
        checklist_total_count: checklistItems.length,
        key_outcomes: report.key_outcomes,
        blockers: report.blockers,
        tomorrow_focus: report.tomorrow_focus,
        followup_notes: report.followup_notes,
        hiring_mode: hiringMode,
        interview_target: report.interview_target || interviewTarget,
      });
      await submitReport(
        { ...report, checklist_completed_count: checklistDone, checklist_total_count: checklistItems.length, sla_missed_count: slaMissed, open_positions_count: openPositions },
        {
          interviews_conducted: report.interviews_conducted || 0,
          interview_target: report.interview_target || interviewTarget,
          ready_pool_added: report.ready_pool_added_count || 0,
          shortlisted: report.shortlisted_count || 0,
          joined: 0, open_positions: openPositions, positions_closed: 0,
          sla_missed: slaMissed,
          checklist_completed: checklistDone, checklist_total: checklistItems.length,
          report_submitted: true, late_submission: false, pool_below_minimum: false, kpi,
        },
      );
      onSaved();
    } catch (e: any) { alert(e?.message || "Submit failed"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <Drawer title="Daily HR Report" onClose={onClose} footer={null}><div style={{ padding: 24 }}>Loading…</div></Drawer>;
  }
  if (loadError || !report) {
    return (
      <Drawer title="Daily HR Report" onClose={onClose} footer={
        <>
          <button className="btn-sm" onClick={onClose}>Close</button>
          <button className="btn-sm" onClick={() => setReloadKey((k) => k + 1)}
            style={{ background: "var(--ink)", color: "var(--parchment)" }}>Retry</button>
        </>
      }>
        <div style={{ padding: 24, color: "var(--red)", fontSize: 13 }}>
          {loadError ?? "Could not load today's report."}
        </div>
      </Drawer>
    );
  }

  const wa = buildWhatsappSummary(
    { ...report, score_total: live?.score_total ?? 0, checklist_completed_count: checklistDone, checklist_total_count: checklistItems.length, sla_missed_count: slaMissed, open_positions_count: openPositions },
    statusFromScore(live?.score_total ?? 0, true),
  );

  return (
    <Drawer title="Daily HR Report" onClose={onClose} footer={
      <>
        <button className="btn-sm" onClick={() => navigator.clipboard.writeText(wa).then(() => alert("Copied"))}>Copy WhatsApp</button>
        <button className="btn-sm" onClick={() => window.print()}>Download PDF</button>
        <button className="btn-sm" onClick={saveDraft} disabled={saving}>Save Draft</button>
        <button className="btn-sm" onClick={submit} disabled={saving}
          style={{ background: "var(--ink)", color: "var(--parchment)" }}>
          {saving ? "Submitting…" : `Submit (${live?.score_total ?? 0}/100)`}
        </button>
      </>
    }>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Stat label="Hiring Mode" value={hiringMode.toUpperCase()} />
        <Stat label="Today's Target" value={String(report.interview_target || interviewTarget)} />
        <Stat label="Open Positions" value={String(openPositions)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <NumField label="Interviews Conducted" value={report.interviews_conducted ?? 0} onChange={(v) => set("interviews_conducted", v)} />
        <NumField label="Shortlisted" value={report.shortlisted_count ?? 0} onChange={(v) => set("shortlisted_count", v)} />
        <NumField label="Rejected" value={report.rejected_count ?? 0} onChange={(v) => set("rejected_count", v)} />
        <NumField label="Ready Pool Added" value={report.ready_pool_added_count ?? 0} onChange={(v) => set("ready_pool_added_count", v)} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Daily Recall Checklist</h4>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink3)" }}>{checklistDone}/{checklistItems.length} done</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>
          Complete the {checklistItems.length} non-negotiable HR checks before submitting today's report.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {checklistItems.map((it, i) => {
            const done = !!checks[i];
            return (
              <label key={it} style={{
                display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 12, alignItems: "center",
                padding: "12px 14px", background: done ? "var(--green-bg)" : "var(--ivory)",
                border: `1px solid ${done ? "var(--green-b)" : "var(--border)"}`,
                borderLeft: `4px solid ${done ? "var(--green)" : "var(--amber)"}`,
                borderRadius: 8, cursor: "pointer",
              }}>
                <input type="checkbox" checked={done} onChange={(e) => {
                  const next = [...checks]; next[i] = e.target.checked; setChecks(next);
                }} style={{ width: 18, height: 18, cursor: "pointer" }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{it}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 2 }}>Required HR daily check</div>
                </div>
                <span className={`status-pill ${done ? "sp-profit" : "sp-warn"}`} style={{ textTransform: "uppercase", fontWeight: 700 }}>
                  {done ? "Done" : "Pending"}
                </span>
              </label>
            );
          })}
        </div>
      </div>


      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <Text label="Key Outcomes Today" value={report.key_outcomes ?? ""} onChange={(v) => set("key_outcomes", v)} />
        <Text label="Blockers (if any)" value={report.blockers ?? ""} onChange={(v) => set("blockers", v)} />
        <Text label="Tomorrow's Focus" value={report.tomorrow_focus ?? ""} onChange={(v) => set("tomorrow_focus", v)} />
        <Text label="Follow-up Notes" value={report.followup_notes ?? ""} onChange={(v) => set("followup_notes", v)} />
      </div>

      <FieldLabel>WhatsApp Preview</FieldLabel>
      <pre style={{
        background: "var(--parchment)", border: "1px dashed var(--border)", borderRadius: 8,
        padding: 12, fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0,
      }}>{wa}</pre>

      {live && (
        <div style={{ marginTop: 14, padding: 12, background: "var(--gold-bg)", border: "1px solid var(--gold-border)", borderRadius: 8, fontSize: 12, color: "var(--ink2)" }}>
          <strong>Live score: {live.score_total}/100</strong> · breakdown: {Object.entries(live.score_breakdown).map(([k, v]) => `${k} ${Math.round(v)}`).join(" · ")}
          {live.penalty_breakdown.length > 0 && <div style={{ marginTop: 6, color: "var(--red)" }}>Penalties: {live.penalty_breakdown.map((p) => `${p.reason} (${p.delta})`).join(", ")}</div>}
          {live.bonus_breakdown.length > 0 && <div style={{ marginTop: 4, color: "var(--green)" }}>Bonuses: {live.bonus_breakdown.map((b) => `${b.reason} (+${b.delta})`).join(", ")}</div>}
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", color: "var(--ink4)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <div><FieldLabel>{label}</FieldLabel><input type="number" min={0} style={inputStyle} value={value} onChange={(e) => onChange(Number(e.target.value || 0))} /></div>;
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><FieldLabel>{label}</FieldLabel><textarea style={{ ...inputStyle, minHeight: 56 }} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
