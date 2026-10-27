// HiringRequirementDrawer — wizardized. Director/Admin/HR use the same flow.
// Steps: Role · Hiring Details · SLA & Priority · Skills & Notes · Review.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import {
  createHiringRequirement,
  updateHiringRequirement,
  archiveHiringRequirement,
} from "@/services/hr/hiringRequirementService";
import {
  getCompanyPositionsFromHiringBible,
  filterPositionsByBrand,
} from "@/services/hr/hiringBibleIntegrationService";
import { QuickSaveField } from "./QuickSaveField";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { useBrands } from "@/hooks/useBrands";
import {
  WizardStepper,
  WizardStep,
  WizardFooter,
  WizardReviewRow,
  useWizard,
} from "@/components/ui/WizardForm";

type Props = {
  requirementId: string | null;
  existing: any | null;
  canOverrideSla: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const DEFAULTS = {
  priority: "normal",
  openings: 1,
  sla_days: 4,
  source: "director_form",
  status: "new",
};

const STEPS = [
  { key: "role", label: "Role" },
  { key: "details", label: "Hiring Details" },
  { key: "sla", label: "SLA & Priority" },
  { key: "skills", label: "Skills & Notes" },
  { key: "review", label: "Review" },
] as const;

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + (days || 0));
  return d;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function HiringRequirementDrawer({
  requirementId,
  existing,
  canOverrideSla,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const { activeBrands } = useBrands();

  const [f, setF] = useState<any>(existing ?? DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [manualPosition, setManualPosition] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const wiz = useWizard(STEPS.map((s) => s.key) as unknown as string[]);

  useEffect(() => {
    setF(existing ?? DEFAULTS);
  }, [requirementId, existing]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const positionsQ = useQuery({
    queryKey: ["hb-positions"],
    queryFn: getCompanyPositionsFromHiringBible,
    staleTime: 60_000,
  });
  const allPositions = positionsQ.data ?? [];
  const brandPositions = useMemo(
    () =>
      showAllBrands
        ? allPositions
        : filterPositionsByBrand(allPositions, f.brand_name),
    [allPositions, f.brand_name, showAllBrands],
  );
  const hbConnected = !positionsQ.isLoading && allPositions.length > 0;

  // Deadline preview
  const assignedBase = useMemo(
    () => (f.assigned_date ? new Date(f.assigned_date) : new Date()),
    [f.assigned_date],
  );
  const deadlinePreview = useMemo(
    () => fmtDate(addDays(assignedBase, Number(f.sla_days ?? 4))),
    [assignedBase, f.sla_days],
  );

  // Step-level validation
  const step1Valid = Boolean(f.position_name && (f.openings ?? 1) >= 1);
  const step3Valid = Boolean(f.priority && (f.sla_days ?? 0) > 0);

  const submit = async () => {
    if (!f.position_name) {
      alert("Position name is required");
      wiz.jump(0);
      return;
    }
    setSaving(true);
    try {
      if (requirementId) await updateHiringRequirement(requirementId, f);
      else await createHiringRequirement(f);
      onSaved();
    } catch (err: any) {
      alert(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Step renderers ----------------
  const renderStep = () => {
    if (wiz.current === 0) {
      return (
        <WizardStep
          title="Role Requirement"
          description="Which brand and position are we hiring for?"
        >
          <div>
            <FieldLabel>Brand *</FieldLabel>
            <select
              style={inputStyle}
              value={f.brand_id ?? ""}
              onChange={(e) => {
                const b = activeBrands.find((x) => x.id === e.target.value);
                set("brand_id", b?.id ?? null);
                set("brand_name", b?.name ?? null);
              }}
            >
              <option value="">Parent / cross-brand</option>
              {activeBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <FieldLabel>Position Name *</FieldLabel>
              <button
                type="button"
                onClick={() => setManualPosition((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--gold)",
                  fontSize: 11,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {manualPosition ? "Use Hiring Bible list" : "+ Manual entry"}
              </button>
            </div>
            {!manualPosition && hbConnected ? (
              <>
                <select
                  style={inputStyle}
                  value={f.position_name ?? ""}
                  onChange={(e) => {
                    const p = brandPositions.find(
                      (bp) => bp.position_name === e.target.value,
                    );
                    set("position_name", e.target.value);
                    if (p) {
                      if (!f.department && p.department)
                        set("department", p.department);
                      if (!f.reporting_manager && p.reporting_manager)
                        set("reporting_manager", p.reporting_manager);
                      if (!f.work_mode && p.work_mode)
                        set("work_mode", p.work_mode);
                      if (!f.location && p.location) set("location", p.location);
                      if (!f.salary_range && p.salary_range)
                        set("salary_range", p.salary_range);
                      if (!f.experience_required && p.experience_required)
                        set("experience_required", p.experience_required);
                      if (!f.skills_required && p.skills_required)
                        set("skills_required", p.skills_required);
                      if (!f.reason_for_hiring && p.reason_for_hiring)
                        set("reason_for_hiring", p.reason_for_hiring);
                      if (!f.special_notes && p.special_notes)
                        set("special_notes", p.special_notes);
                    }
                  }}
                >
                  <option value="">— Select position —</option>
                  {brandPositions.map((p) => (
                    <option key={p.position_id} value={p.position_name}>
                      {p.position_name}
                      {p.department ? ` · ${p.department}` : ""}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 10.5, color: "var(--ink4)" }}>
                    {brandPositions.length === 0
                      ? `No Hiring Bible positions for ${f.brand_name ?? "this brand"} — toggle "Show all brands" or use Manual entry.`
                      : `${brandPositions.length} position${brandPositions.length !== 1 ? "s" : ""} ${showAllBrands ? "(all brands)" : `for ${f.brand_name ?? "selected brand"}`}.`}
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => positionsQ.refetch()}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--gold)",
                        fontSize: 10.5,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {positionsQ.isFetching
                        ? "Refreshing…"
                        : "Refresh from Hiring Bible"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAllBrands((v) => !v)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--gold)",
                        fontSize: 10.5,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {showAllBrands
                        ? "Filter by brand"
                        : "Show positions across all brands"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <input
                  style={inputStyle}
                  value={f.position_name ?? ""}
                  onChange={(e) => set("position_name", e.target.value)}
                  placeholder="e.g. Media Buyer (Performance Marketing)"
                />
                {!hbConnected && !positionsQ.isLoading && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink4)",
                      marginTop: 4,
                    }}
                  >
                    Hiring Bible positions not connected — using manual entry.
                  </div>
                )}
              </>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <FieldLabel>Number of Openings *</FieldLabel>
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={f.openings ?? 1}
                onChange={(e) => set("openings", Number(e.target.value))}
              />
            </div>
            <QuickSaveField
              label="Requirement Source"
              optionType="hr_requirement_source"
              value={f.source ?? "director_form"}
              onChange={(v) => set("source", v)}
            />
          </div>
        </WizardStep>
      );
    }

    if (wiz.current === 1) {
      return (
        <WizardStep
          title="Hiring Details"
          description="Operational context for the role."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <FieldLabel>Reporting Manager</FieldLabel>
              <input
                style={inputStyle}
                value={f.reporting_manager ?? ""}
                onChange={(e) => set("reporting_manager", e.target.value)}
              />
            </div>
            <QuickSaveField
              label="Department"
              optionType="hr_department"
              value={f.department ?? ""}
              onChange={(v) => set("department", v)}
            />
            <QuickSaveField
              label="Work Mode"
              optionType="hr_work_mode"
              value={f.work_mode ?? ""}
              onChange={(v) => set("work_mode", v)}
            />
            <QuickSaveField
              label="Location"
              optionType="hr_location"
              value={f.location ?? ""}
              onChange={(v) => set("location", v)}
            />
            <div>
              <FieldLabel>Salary Range</FieldLabel>
              <input
                style={inputStyle}
                value={f.salary_range ?? ""}
                onChange={(e) => set("salary_range", e.target.value)}
                placeholder="e.g. ₹40k–60k / month"
              />
            </div>
            <div>
              <FieldLabel>Required Joining Timeline</FieldLabel>
              <input
                style={inputStyle}
                value={f.joining_timeline ?? ""}
                onChange={(e) => set("joining_timeline", e.target.value)}
                placeholder="e.g. Within 2 weeks"
              />
            </div>
          </div>
        </WizardStep>
      );
    }

    if (wiz.current === 2) {
      return (
        <WizardStep
          title="SLA & Priority"
          description="Set urgency and the hiring deadline."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <QuickSaveField
              label="Priority *"
              optionType="hr_priority"
              value={f.priority ?? "normal"}
              onChange={(v) => set("priority", v)}
            />
            <div>
              <FieldLabel>
                SLA Days {!canOverrideSla && "(locked)"}
              </FieldLabel>
              <input
                type="number"
                min={1}
                max={30}
                style={inputStyle}
                disabled={!canOverrideSla}
                value={f.sla_days ?? 4}
                onChange={(e) => set("sla_days", Number(e.target.value))}
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FieldLabel>Reason for Hiring</FieldLabel>
              <textarea
                style={{ ...inputStyle, minHeight: 60 }}
                value={f.reason_for_hiring ?? ""}
                onChange={(e) => set("reason_for_hiring", e.target.value)}
                placeholder="Replacement · New role · Expansion · Urgent gap · Trial · Custom"
              />
            </div>
          </div>
          <div
            style={{
              background: "var(--parchment)",
              border: "1px dashed var(--gold-border)",
              borderRadius: 8,
              padding: 12,
              fontSize: 12.5,
              color: "var(--ink)",
              display: "grid",
              gap: 4,
            }}
          >
            <div>
              <strong>Deadline will be:</strong> {deadlinePreview}
            </div>
            <div style={{ color: "var(--ink4)", fontSize: 11.5 }}>
              Hiring Mode will recalculate after submission.
            </div>
          </div>
        </WizardStep>
      );
    }

    if (wiz.current === 3) {
      return (
        <WizardStep
          title="Skills & Notes"
          description="What the candidate needs and how HR should source."
        >
          <div>
            <FieldLabel>Required Skills</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 70 }}
              value={f.skills_required ?? ""}
              onChange={(e) => set("skills_required", e.target.value)}
            />
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink4)",
                marginTop: 4,
              }}
            >
              Position details are fetched from Hiring Bible. Candidate pool
              will be checked after submission.
            </div>
          </div>
          <div>
            <FieldLabel>Experience Required</FieldLabel>
            <input
              style={inputStyle}
              value={f.experience_required ?? ""}
              onChange={(e) => set("experience_required", e.target.value)}
              placeholder="e.g. 2-4 years"
            />
          </div>
          <div>
            <FieldLabel>Special Notes</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 60 }}
              value={f.special_notes ?? ""}
              onChange={(e) => set("special_notes", e.target.value)}
            />
          </div>
          <QuickSaveField
            label="Candidate Pool Instruction"
            optionType="hr_candidate_pool_instruction"
            value={f.candidate_pool_instruction ?? ""}
            onChange={(v) => set("candidate_pool_instruction", v)}
          />
          {requirementId && (
            <QuickSaveField
              label="Status"
              optionType="hr_requirement_status"
              value={f.status ?? "new"}
              onChange={(v) => set("status", v)}
            />
          )}
        </WizardStep>
      );
    }

    // Review
    const warnings: string[] = [];
    if (!f.brand_id && !f.brand_name) warnings.push("No brand selected (parent / cross-brand).");
    if (!f.position_name) warnings.push("Position is required.");
    if (!hbConnected || manualPosition) warnings.push("Position is not linked to a Hiring Bible record.");
    if (canOverrideSla && f.sla_days && f.sla_days !== 4) warnings.push(`SLA override in use (${f.sla_days} days).`);

    return (
      <WizardStep
        title="Review & Submit"
        description="Confirm before sending to HR."
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
            }}
          >
            Role
          </div>
          <WizardReviewRow label="Brand" value={f.brand_name ?? "Parent / cross-brand"} onEdit={() => wiz.jump(0)} />
          <WizardReviewRow label="Position" value={f.position_name} onEdit={() => wiz.jump(0)} />
          <WizardReviewRow label="Openings" value={String(f.openings ?? 1)} onEdit={() => wiz.jump(0)} />
          <WizardReviewRow label="Source" value={f.source} onEdit={() => wiz.jump(0)} />
        </div>

        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
              marginTop: 8,
            }}
          >
            Hiring Details
          </div>
          <WizardReviewRow label="Reporting Manager" value={f.reporting_manager} onEdit={() => wiz.jump(1)} />
          <WizardReviewRow label="Department" value={f.department} onEdit={() => wiz.jump(1)} />
          <WizardReviewRow label="Work Mode" value={f.work_mode} onEdit={() => wiz.jump(1)} />
          <WizardReviewRow label="Location" value={f.location} onEdit={() => wiz.jump(1)} />
          <WizardReviewRow label="Salary Range" value={f.salary_range} onEdit={() => wiz.jump(1)} />
          <WizardReviewRow label="Joining Timeline" value={f.joining_timeline} onEdit={() => wiz.jump(1)} />
        </div>

        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
              marginTop: 8,
            }}
          >
            SLA
          </div>
          <WizardReviewRow label="Priority" value={f.priority} onEdit={() => wiz.jump(2)} />
          <WizardReviewRow label="SLA Days" value={String(f.sla_days ?? 4)} onEdit={() => wiz.jump(2)} />
          <WizardReviewRow label="Deadline" value={deadlinePreview} onEdit={() => wiz.jump(2)} />
          <WizardReviewRow label="Reason" value={f.reason_for_hiring} onEdit={() => wiz.jump(2)} />
        </div>

        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
              marginTop: 8,
            }}
          >
            Notes
          </div>
          <WizardReviewRow label="Skills" value={f.skills_required} onEdit={() => wiz.jump(3)} />
          <WizardReviewRow label="Experience" value={f.experience_required} onEdit={() => wiz.jump(3)} />
          <WizardReviewRow label="Special Notes" value={f.special_notes} onEdit={() => wiz.jump(3)} />
          <WizardReviewRow label="Pool Instruction" value={f.candidate_pool_instruction} onEdit={() => wiz.jump(3)} />
        </div>

        {warnings.length > 0 && (
          <div
            style={{
              background: "color-mix(in oklab, var(--gold) 10%, transparent)",
              border: "1px solid var(--gold-border)",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: "var(--ink)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Before submitting</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </WizardStep>
    );
  };

  const canAdvance =
    (wiz.current === 0 && step1Valid) ||
    (wiz.current === 2 && step3Valid) ||
    (wiz.current !== 0 && wiz.current !== 2);

  return (
    <Drawer
      onClose={onClose}
      title={requirementId ? "Edit Hiring Requirement" : "New Hiring Requirement"}
      footer={null}
    >
      <WizardStepper
        steps={STEPS as unknown as { key: string; label: string }[]}
        current={wiz.current}
        onJump={wiz.jump}
      />
      {renderStep()}
      <WizardFooter
        onCancel={onClose}
        onPrev={wiz.isFirst ? undefined : wiz.prev}
        onNext={wiz.isLast ? undefined : wiz.next}
        onSave={wiz.isLast ? submit : undefined}
        nextDisabled={!canAdvance}
        isLast={wiz.isLast}
        busy={saving}
        saveLabel={requirementId ? "Save Changes" : "Submit Requirement"}
        extraActions={
          admin && requirementId && wiz.isLast ? (
            <button
              type="button"
              className="btn-sm"
              onClick={async () => {
                if (!confirm("Archive this requirement?")) return;
                await archiveHiringRequirement(requirementId);
                onSaved();
              }}
            >
              Archive
            </button>
          ) : undefined
        }
      />
    </Drawer>
  );
}

export function Drawer({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(23,21,18,.42)",
          zIndex: 50,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(720px, 100vw)",
          background: "var(--ivory)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          boxShadow: "0 18px 50px rgba(27,22,16,.18)",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, margin: 0 }}>
            {title}
          </h3>
          <button onClick={onClose} className="btn-sm" style={{ width: 34, height: 34, padding: 0 }}>
            ×
          </button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
