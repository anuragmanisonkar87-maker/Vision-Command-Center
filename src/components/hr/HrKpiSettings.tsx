import { useMemo, useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";

type Props = {
  kpi: Record<string, any>;
  onSave: (key: string, value: any) => Promise<void>;
};

type Field = {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: string[];
  helper?: string;
  tone?: "neutral" | "danger" | "success" | "warn";
  defaultValue?: any;
};

type Group = {
  id: string;
  title: string;
  subtitle: string;
  accent: "ink" | "red" | "amber" | "gold" | "green";
  fields: Field[];
};

const GROUPS: Group[] = [
  {
    id: "mode", title: "Hiring Mode Settings", accent: "ink",
    subtitle: "Control how the system calculates daily HR hiring pressure.",
    fields: [
      { key: "hiring_mode_override", label: "Hiring Mode Control", type: "select",
        options: ["automatic", "high", "normal", "low", "maintenance"],
        helper: "Automatic uses open roles + pool health + SLA to decide." },
      { key: "high_mode_interview_target", label: "High Mode Daily Target", type: "number", defaultValue: 6,
        helper: "Used when open positions or pool gaps are critical." },
      { key: "normal_mode_interview_target", label: "Normal Mode Daily Target", type: "number", defaultValue: 5,
        helper: "Default operational hiring volume." },
      { key: "low_mode_interview_target", label: "Low Mode Daily Target", type: "number", defaultValue: 3,
        helper: "Used when most positions are filled." },
      { key: "maintenance_mode_interview_target", label: "Maintenance Mode Target", type: "number", defaultValue: 1,
        helper: "Pool freshness only — no urgent demand." },
    ],
  },
  {
    id: "sla", title: "Hiring SLA Settings", accent: "amber",
    subtitle: "Deadlines per role type. Penalties and bonuses tied to closing speed.",
    fields: [
      { key: "default_sla_days", label: "Default SLA Days", type: "number", defaultValue: 4, helper: "Standard role hiring deadline." },
      { key: "urgent_sla_days", label: "Urgent Role SLA Days", type: "number", defaultValue: 2, tone: "danger" },
      { key: "specialist_sla_days", label: "Specialist Role SLA Days", type: "number", defaultValue: 7 },
      { key: "leadership_sla_days", label: "Leadership Role SLA Days", type: "number", defaultValue: 10 },
      { key: "missed_sla_penalty", label: "Missed SLA Penalty", type: "number", defaultValue: -15, tone: "danger", helper: "Applied per missed deadline." },
      { key: "bonus_close_before_sla", label: "Close Before SLA Bonus", type: "number", defaultValue: 10, tone: "success" },
    ],
  },
  {
    id: "pool", title: "Candidate Pool Settings", accent: "gold",
    subtitle: "Pool health thresholds influence the hiring mode engine.",
    fields: [
      { key: "pool_target_per_position", label: "Pool Target / Position", type: "number", defaultValue: 20 },
      { key: "minimum_ready_now", label: "Minimum Ready Now", type: "number", defaultValue: 5 },
      { key: "warning_pool_threshold", label: "Warning Pool Threshold", type: "number", defaultValue: 15, tone: "warn" },
      { key: "critical_pool_threshold", label: "Critical Pool Threshold", type: "number", defaultValue: 10, tone: "danger" },
      { key: "fresh_candidate_days", label: "Fresh Candidate (days)", type: "number", defaultValue: 7 },
      { key: "warm_candidate_days", label: "Warm Candidate (days)", type: "number", defaultValue: 15 },
      { key: "expired_candidate_days", label: "Expired Candidate (days)", type: "number", defaultValue: 30 },
    ],
  },
  {
    id: "report", title: "Daily Report Compliance", accent: "red",
    subtitle: "Deadline + penalty/bonus rules for the daily HR report.",
    fields: [
      { key: "report_deadline_hour", label: "Report Deadline (24h)", type: "number", defaultValue: 20, helper: "Hour of day, e.g. 20 = 8:00 PM." },
      { key: "late_report_penalty", label: "Late Report Penalty", type: "number", defaultValue: -10, tone: "danger" },
      { key: "missed_report_penalty", label: "Missed Report Penalty", type: "number", defaultValue: -20, tone: "danger" },
      { key: "report_submission_bonus", label: "Submission Bonus", type: "number", defaultValue: 10, tone: "success" },
      { key: "non_compliant_label", label: "Non-Compliant Status Label", type: "text", defaultValue: "Reporting Non-Compliant" },
    ],
  },
  {
    id: "score", title: "Score Engine Settings", accent: "green",
    subtitle: "Weight distribution must total 100. Bonuses are additive.",
    fields: [
      { key: "score_weight_interviews", label: "Interviews Conducted", type: "number", defaultValue: 20 },
      { key: "score_weight_ready_pool", label: "Ready Pool Addition", type: "number", defaultValue: 20 },
      { key: "score_weight_position_progress", label: "Open Position Progress", type: "number", defaultValue: 20 },
      { key: "score_weight_quality", label: "Quality Outcome", type: "number", defaultValue: 20 },
      { key: "score_weight_checklist", label: "Checklist + Email Discipline", type: "number", defaultValue: 10 },
      { key: "score_weight_report", label: "Daily Report Submitted", type: "number", defaultValue: 10 },
      { key: "bonus_candidate_joined", label: "Bonus: Candidate Joined", type: "number", defaultValue: 15, tone: "success" },
      { key: "bonus_high_quality_candidate", label: "Bonus: High Quality Candidate", type: "number", defaultValue: 5, tone: "success" },
    ],
  },
];

const accentColor = (a: Group["accent"]) =>
  a === "red" ? "var(--red)" : a === "amber" ? "var(--amber)" : a === "gold" ? "var(--gold3)" : a === "green" ? "var(--green)" : "var(--ink)";

export function HrKpiSettings({ kpi, onSave }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, any>>(kpi);

  const persist = async (k: string, v: any) => {
    setSaving(k);
    try { await onSave(k, v); } finally { setSaving(null); }
  };

  const checklist: string[] = Array.isArray(vals.checklist_items)
    ? vals.checklist_items
    : (Array.isArray(kpi.checklist_items) ? kpi.checklist_items : []);
  const [newItem, setNewItem] = useState("");

  // Score engine total
  const scoreKeys = ["score_weight_interviews","score_weight_ready_pool","score_weight_position_progress","score_weight_quality","score_weight_checklist","score_weight_report"];
  const scoreTotal = useMemo(() => scoreKeys.reduce((sum, k) => {
    const f = GROUPS.find((g) => g.id === "score")!.fields.find((f) => f.key === k)!;
    return sum + Number(vals[k] ?? kpi[k] ?? f.defaultValue ?? 0);
  }, 0), [vals, kpi]);

  return (
    <div>
      {/* Director banner */}
      <div style={{
        background: "var(--ink)", color: "var(--parchment)",
        borderRadius: 10, padding: "16px 20px", marginBottom: 22,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", opacity: .65, marginBottom: 4 }}>Director Control Panel</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>HR KPI Settings</div>
          <div style={{ fontSize: 12, opacity: .8, marginTop: 3 }}>
            These settings affect HR scoring, SLA, and hiring mode for the entire workspace. Changes save instantly.
          </div>
        </div>
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
          background: "var(--gold3)", color: "var(--ink)", padding: "6px 12px", borderRadius: 99, fontWeight: 700,
        }}>Admin / Director Only</span>
      </div>

      {GROUPS.map((g) => (
        <SettingsGroup
          key={g.id} group={g} kpi={kpi} vals={vals} saving={saving}
          onChange={(k, v) => setVals({ ...vals, [k]: v })}
          onPersist={persist}
          extra={g.id === "score" ? (
            <div style={{
              padding: "12px 16px", borderRadius: 8, marginTop: 12,
              background: scoreTotal === 100 ? "var(--green-bg)" : "var(--red-bg)",
              border: `1px solid ${scoreTotal === 100 ? "var(--green-b)" : "rgba(139,32,32,.2)"}`,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "var(--ink2)" }}>
                Total Score Weight {scoreTotal === 100 ? "✓ Balanced" : "must total 100"}
              </div>
              <span style={{
                fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700,
                color: scoreTotal === 100 ? "var(--green)" : "var(--red)",
              }}>{scoreTotal} / 100</span>
            </div>
          ) : g.id === "report" ? (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>Status badge preview:</span>
              <span className="status-pill sp-loss" style={{ textTransform: "uppercase", fontWeight: 700 }}>
                {String(vals.non_compliant_label ?? kpi.non_compliant_label ?? "Reporting Non-Compliant")}
              </span>
            </div>
          ) : null}
        />
      ))}

      {/* Checklist Settings */}
      <section style={sectionShell("ink")}>
        <SectionHeader accent="ink" title="Daily Recall Checklist" subtitle="Helps HR remember daily non-negotiables. Not a form-filling pressure tool." />
        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {checklist.length === 0 && (
              <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink4)", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>
                No checklist items yet. Add the first item below.
              </div>
            )}
            {checklist.map((item, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "22px 1fr auto auto", gap: 12, alignItems: "center",
                background: "var(--ivory)", padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--border)", borderLeft: "4px solid var(--gold3)",
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--gold)", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{item}</span>
                <span className="status-pill sp-warn" style={{ fontWeight: 700 }}>Required</span>
                <button className="btn-sm" onClick={() => {
                  const next = checklist.filter((_, idx) => idx !== i);
                  setVals({ ...vals, checklist_items: next }); persist("checklist_items", next);
                }}>Remove</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <input style={inputStyle} value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="New checklist item" />
            <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)", whiteSpace: "nowrap" }}
              onClick={() => {
                if (!newItem.trim()) return;
                const next = [...checklist, newItem.trim()];
                setVals({ ...vals, checklist_items: next }); persist("checklist_items", next); setNewItem("");
              }}>+ Add Item</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function sectionShell(_accent: Group["accent"]) {
  return {
    background: "var(--ivory)", border: "1px solid var(--border)",
    borderRadius: 10, marginBottom: 18, overflow: "hidden",
  } as const;
}

function SectionHeader({ accent, title, subtitle }: { accent: Group["accent"]; title: string; subtitle: string }) {
  const c = accentColor(accent);
  return (
    <div style={{
      padding: "16px 22px", borderBottom: "1px solid var(--border)", borderLeft: `4px solid ${c}`,
      background: "var(--parchment)",
    }}>
      <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{title}</h3>
      <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--ink3)" }}>{subtitle}</p>
    </div>
  );
}

function SettingsGroup({ group, kpi, vals, saving, onChange, onPersist, extra }: {
  group: Group; kpi: Record<string, any>; vals: Record<string, any>; saving: string | null;
  onChange: (k: string, v: any) => void;
  onPersist: (k: string, v: any) => Promise<void>;
  extra?: React.ReactNode;
}) {
  return (
    <section style={sectionShell(group.accent)}>
      <SectionHeader accent={group.accent} title={group.title} subtitle={group.subtitle} />
      <div style={{ padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {group.fields.map((f) => {
            const value = vals[f.key] ?? kpi[f.key] ?? f.defaultValue ?? "";
            const toneColor = f.tone === "danger" ? "var(--red)" : f.tone === "success" ? "var(--green)" : f.tone === "warn" ? "var(--amber)" : undefined;
            return (
              <div key={f.key} style={{
                background: "var(--parchment)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "12px 14px",
                ...(toneColor ? { borderLeft: `3px solid ${toneColor}` } : {}),
              }}>
                <FieldLabel>{f.label}</FieldLabel>
                {f.type === "select" ? (
                  <select style={{ ...inputStyle, fontWeight: 600 }} value={String(value ?? "")}
                    onChange={(e) => { onChange(f.key, e.target.value); onPersist(f.key, e.target.value); }}>
                    {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 700, color: toneColor ?? "var(--ink)" }}
                    value={value ?? ""}
                    onChange={(e) => onChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                    onBlur={(e) => onPersist(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
                {f.helper && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 6, lineHeight: 1.45 }}>{f.helper}</div>}
                {saving === f.key && <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>Saving…</div>}
              </div>
            );
          })}
        </div>
        {extra}
      </div>
    </section>
  );
}
