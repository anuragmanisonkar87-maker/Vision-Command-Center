import { useState } from "react";
import { type Candidate, type PoolHealth, createCandidate, updateCandidate } from "@/services/hr/hrCandidatePoolService";
import { Drawer } from "./HiringRequirementDrawer";
import { FieldLabel, inputStyle, EmptyState, LoadingState } from "@/components/marketizers/ui";
import { QuickSaveField } from "./QuickSaveField";

type Props = {
  candidates: Candidate[];
  health: PoolHealth[];
  loading: boolean;
  onChange: () => void;
};

const TIER_LABEL: Record<string, string> = {
  ready_now: "Ready Now", ready_soon: "Ready Soon", warm: "Warm", cold: "Cold", expired: "Expired",
};

export function CandidatePoolTable({ candidates, health, loading, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<any>({ readiness_tier: "warm", freshness_status: "fresh" });
  const [saving, setSaving] = useState(false);

  if (loading) return <LoadingState />;

  return (
    <div>
      <div style={{
        background: "var(--gold-bg)", border: "1px solid var(--gold-border)",
        borderLeft: "4px solid var(--gold3)", borderRadius: 9, padding: "12px 16px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
            Hiring Bible Integration · Phase 2
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.55, maxWidth: 680 }}>
            Once integrated, candidate details, interview records and ratings will sync from Hiring Bible. HR will mark candidates as <strong>Ready to Join</strong> / <strong>Send to Pool</strong> there, and Vision Center will show pool status by brand and position. Manual entry is a fallback for Director / Admin only.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: 0 }}>Pool Health by Position</h3>
        <button className="btn-sm" onClick={() => setAdding(true)}>+ Manual Candidate Add</button>
      </div>

      {health.length === 0 ? (
        <EmptyState icon="🧑‍💼" title="No candidates yet" message="Add candidates manually or wait for the Hiring Bible sync (Phase 2)." />
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 26 }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Position", "Total", "Ready Now", "Ready Soon", "Warm", "Cold/Expired", "Health"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.position} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{h.position}</td>
                  <td style={{ padding: "10px 8px" }}>{h.total}</td>
                  <td style={{ padding: "10px 8px" }}>{h.readyNow}</td>
                  <td style={{ padding: "10px 8px" }}>{h.readySoon}</td>
                  <td style={{ padding: "10px 8px" }}>{h.warm}</td>
                  <td style={{ padding: "10px 8px" }}>{h.cold}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`status-pill ${h.health === "critical" ? "sp-loss" : h.health === "warning" ? "sp-warn" : "sp-profit"}`}>{h.health}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: "0 0 12px" }}>Candidates</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name", "Position", "Phone", "Tier", "Freshness", "Last Contact"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>{c.candidate_name}</td>
                <td style={{ padding: "10px 8px" }}>{c.position_name}</td>
                <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{c.phone}</td>
                <td style={{ padding: "10px 8px" }}>
                  <select
                    value={c.readiness_tier}
                    onChange={async (e) => { await updateCandidate(c.id, { readiness_tier: e.target.value }); onChange(); }}
                    style={{ ...inputStyle, padding: "4px 8px", minHeight: 0, fontSize: 11 }}>
                    {Object.entries(TIER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td style={{ padding: "10px 8px" }}><span className={`status-pill ${c.freshness_status === "fresh" ? "sp-profit" : c.freshness_status === "warm" ? "sp-warn" : "sp-loss"}`}>{c.freshness_status}</span></td>
                <td style={{ padding: "10px 8px", color: "var(--ink4)", fontSize: 11 }}>{c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {candidates.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink4)" }}>No candidates</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && (
        <Drawer title="Add Candidate" onClose={() => setAdding(false)} footer={
          <>
            <button className="btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-sm" disabled={saving} style={{ background: "var(--ink)", color: "var(--parchment)" }}
              onClick={async () => {
                if (!draft.candidate_name || !draft.phone || !draft.position_name) {
                  alert("Name, phone, position required"); return;
                }
                setSaving(true);
                try { await createCandidate(draft); setAdding(false); setDraft({ readiness_tier: "warm", freshness_status: "fresh" }); onChange(); }
                catch (e: any) { alert(e?.message); }
                finally { setSaving(false); }
              }}>Save</button>
          </>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FieldLabel>Name *</FieldLabel><input style={inputStyle} value={draft.candidate_name ?? ""} onChange={(e) => setDraft({ ...draft, candidate_name: e.target.value })} /></div>
            <div><FieldLabel>Phone *</FieldLabel><input style={inputStyle} value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
            <div><FieldLabel>Email</FieldLabel><input style={inputStyle} value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><FieldLabel>Position *</FieldLabel><input style={inputStyle} value={draft.position_name ?? ""} onChange={(e) => setDraft({ ...draft, position_name: e.target.value })} /></div>
            <QuickSaveField label="Readiness Tier" optionType="hr_readiness_tier" value={draft.readiness_tier} onChange={(v) => setDraft({ ...draft, readiness_tier: v })} />
            <QuickSaveField label="Hiring Source" optionType="hr_hiring_source" value={draft.hiring_source ?? ""} onChange={(v) => setDraft({ ...draft, hiring_source: v })} />
            <div><FieldLabel>Expected Salary</FieldLabel><input style={inputStyle} value={draft.expected_salary ?? ""} onChange={(e) => setDraft({ ...draft, expected_salary: e.target.value })} /></div>
            <div><FieldLabel>Ready to Join From</FieldLabel><input type="date" style={inputStyle} value={draft.ready_to_join_from ?? ""} onChange={(e) => setDraft({ ...draft, ready_to_join_from: e.target.value })} /></div>
            <div style={{ gridColumn: "1/-1" }}><FieldLabel>HR Remarks</FieldLabel><textarea style={{ ...inputStyle, minHeight: 60 }} value={draft.hr_remarks ?? ""} onChange={(e) => setDraft({ ...draft, hr_remarks: e.target.value })} /></div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
