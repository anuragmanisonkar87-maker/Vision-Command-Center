// Mobile-first director requirement form. Save the URL to phone home screen.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin, canCreateHiringRequirement } from "@/utils/permissions/rolePermissions";
import { useBrands } from "@/hooks/useBrands";
import { createHiringRequirement } from "@/services/hr/hiringRequirementService";
import { QuickSaveField } from "@/components/hr/QuickSaveField";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { AccessDenied } from "@/components/access-control/AccessDenied";

function DirectorForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeBrands } = useBrands();
  const admin = isAdmin(user);
  const [f, setF] = useState<any>({ openings: 1, sla_days: 4, priority: "normal", source: "director_form" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { document.title = "New Hiring Requirement | GWV"; }, []);

  if (!canCreateHiringRequirement(user)) return <AccessDenied moduleLabel="Hiring Requirement Form" />;

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.position_name) { alert("Position name required"); return; }
    setSaving(true);
    try { const r = await createHiringRequirement(f); setDone(r.id); }
    catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)", padding: 16 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--gold)" }}>HR Command Center</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, margin: "6px 0 4px" }}>New Hiring Requirement</h1>
          <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: 0 }}>Submitting starts the {f.sla_days || 4}-day SLA. HR will be notified.</p>
        </div>

        {done ? (
          <div style={{ background: "var(--ivory)", border: "1px solid var(--gold-border)", borderRadius: 10, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>✓</div>
            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: "8px 0" }}>Requirement saved</h3>
            <p style={{ fontSize: 13, color: "var(--ink4)" }}>HR has been notified. SLA deadline tracking has started.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn-sm" onClick={() => { setDone(null); setF({ openings: 1, sla_days: 4, priority: "normal", source: "director_form" }); }}>+ Another</button>
              <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)" }}
                onClick={() => navigate({ to: "/company-functions/hr-command-center" })}>Open HR Command Center</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "grid", gap: 14 }}>
            <div>
              <FieldLabel>Brand</FieldLabel>
              <select style={inputStyle} value={f.brand_id ?? ""} onChange={(e) => {
                const b = activeBrands.find((x) => x.id === e.target.value);
                set("brand_id", b?.id ?? null); set("brand_name", b?.name ?? null);
              }}>
                <option value="">Parent / cross-brand</option>
                {activeBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <QuickSaveField label="Department" optionType="hr_department" value={f.department ?? ""} onChange={(v) => set("department", v)} />
            <div>
              <FieldLabel>Position Name *</FieldLabel>
              <input required style={inputStyle} value={f.position_name ?? ""} onChange={(e) => set("position_name", e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><FieldLabel>Openings</FieldLabel><input type="number" min={1} style={inputStyle} value={f.openings} onChange={(e) => set("openings", Number(e.target.value))} /></div>
              <QuickSaveField label="Priority" optionType="hr_priority" value={f.priority} onChange={(v) => set("priority", v)} />
            </div>
            <div><FieldLabel>Reporting Manager</FieldLabel><input style={inputStyle} value={f.reporting_manager ?? ""} onChange={(e) => set("reporting_manager", e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <QuickSaveField label="Work Mode" optionType="hr_work_mode" value={f.work_mode ?? ""} onChange={(v) => set("work_mode", v)} />
              <QuickSaveField label="Location" optionType="hr_location" value={f.location ?? ""} onChange={(v) => set("location", v)} />
            </div>
            <div><FieldLabel>Salary Range</FieldLabel><input style={inputStyle} value={f.salary_range ?? ""} onChange={(e) => set("salary_range", e.target.value)} /></div>
            <div>
              <FieldLabel>SLA Days {!admin && "(locked)"}</FieldLabel>
              <input type="number" min={1} max={30} style={inputStyle} disabled={!admin} value={f.sla_days} onChange={(e) => set("sla_days", Number(e.target.value))} />
            </div>
            <div><FieldLabel>Required Skills</FieldLabel><textarea style={{ ...inputStyle, minHeight: 64 }} value={f.skills_required ?? ""} onChange={(e) => set("skills_required", e.target.value)} /></div>
            <div><FieldLabel>Experience</FieldLabel><input style={inputStyle} value={f.experience_required ?? ""} onChange={(e) => set("experience_required", e.target.value)} /></div>
            <div><FieldLabel>Reason for Hiring</FieldLabel><textarea style={{ ...inputStyle, minHeight: 56 }} value={f.reason_for_hiring ?? ""} onChange={(e) => set("reason_for_hiring", e.target.value)} /></div>
            <div><FieldLabel>Special Notes</FieldLabel><textarea style={{ ...inputStyle, minHeight: 56 }} value={f.special_notes ?? ""} onChange={(e) => set("special_notes", e.target.value)} /></div>
            <button type="submit" disabled={saving} style={{ background: "var(--ink)", color: "var(--parchment)", padding: "12px 18px", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              {saving ? "Submitting…" : "Submit Requirement"}
            </button>
            <button type="button" className="btn-sm"
              onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert("Form link copied"))}>Copy Mobile Form Link</button>
            <Link to="/company-functions/hr-command-center" style={{ textAlign: "center", fontSize: 12, color: "var(--gold)" }}>← HR Command Center</Link>
          </form>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/company-functions/hr-command-center/director-requirement-form")({
  component: DirectorForm,
});
