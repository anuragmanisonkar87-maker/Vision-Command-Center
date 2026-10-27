// @ts-nocheck
// Add / Edit Team Member — step-by-step wizard.
// Five steps: Basic → Work → Compensation → Access → Review.
// Save logic, table writes, and salary auto-sync are unchanged from the
// previous one-screen drawer; only the rendering is chunked into steps.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { QuickSaveSelect } from "./QuickSaveSelect";
import { BrandAccessSelector } from "./BrandAccessSelector";
import { ModuleAccessSelector } from "./ModuleAccessSelector";
import { PermissionToggleList, emptyPermissions, type PermissionState } from "./PermissionToggleList";
import { useMasterOptions, usePositions } from "@/hooks/useAccessControl";
import {
  createTeamMember, updateTeamMember, getBrandAccessForMember, getModuleAccessForMember,
  saveBrandAccess, saveModuleAccess, createPosition, type TeamMember,
} from "@/services/accessControl/accessControlService";
import {
  getBrandAllocations, saveBrandAllocations, syncMemberSalaryToMarketizersExpenses,
  pauseMemberSalaryTemplate,
  currentMonthKey, type BrandAllocation,
} from "@/services/accessControl/teamCompensationService";
import { TeamBrandAllocationEditor } from "./TeamBrandAllocationEditor";
import { useBrands } from "@/hooks/useBrands";

const STEPS = [
  { n: 1, label: "Basic" },
  { n: 2, label: "Work" },
  { n: 3, label: "Compensation" },
  { n: 4, label: "Access" },
  { n: 5, label: "Review" },
] as const;

export function TeamMemberDrawer({
  member, onClose, onSaved,
}: { member: TeamMember | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !member;
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1 — Basic
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [status, setStatus] = useState(member?.status ?? "active");
  const [sendInvite, setSendInvite] = useState(false);

  // Step 2 — Work
  const [positionId, setPositionId] = useState<string>(member?.position_id ?? "");
  const [department, setDepartment] = useState(member?.department ?? "");
  const [reportingManager, setReportingManager] = useState((member as any)?.reporting_manager ?? "");
  const [employmentType, setEmploymentType] = useState((member as any)?.employment_type ?? "");
  const [joiningDate, setJoiningDate] = useState(member?.joining_date ?? "");
  const [workMode, setWorkMode] = useState((member as any)?.work_mode ?? "");

  // Step 3 — Compensation
  const [salaryAmount, setSalaryAmount] = useState<string>(member?.salary_amount != null ? String(member.salary_amount) : "");
  const [salaryCurrency, setSalaryCurrency] = useState(member?.salary_currency ?? "INR");
  const [salaryType, setSalaryType] = useState((member as any)?.salary_type ?? "");
  const [paymentCycle, setPaymentCycle] = useState(member?.payment_cycle ?? "monthly");
  const [paymentDate, setPaymentDate] = useState((member as any)?.payment_date ?? "");
  const [expenseCategory, setExpenseCategory] = useState(member?.expense_category ?? "");
  const [autoAdd, setAutoAdd] = useState<boolean>(member?.auto_add_to_expenses ?? false);
  const [allocations, setAllocations] = useState<BrandAllocation[]>([]);

  // Step 4 — Access
  const [accessLevel, setAccessLevel] = useState(member?.access_level ?? "viewer");
  const [accessPreset, setAccessPreset] = useState((member as any)?.access_preset ?? "");
  const [brandIds, setBrandIds] = useState<Set<string>>(new Set());
  const [moduleIds, setModuleIds] = useState<Set<string>>(new Set());
  const [perms, setPerms] = useState<PermissionState>(emptyPermissions());
  const [showAdvancedPerms, setShowAdvancedPerms] = useState(false);

  // Misc
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const { data: positions, refetch: refPositions } = usePositions();
  const { data: statuses, refetch: refStatus } = useMasterOptions("team_member_status");
  const { data: levels, refetch: refLevel } = useMasterOptions("access_level");
  const { data: departments, refetch: refDept } = useMasterOptions("department");
  const { data: managers, refetch: refMgr } = useMasterOptions("reporting_manager");
  const { data: empTypes, refetch: refEmp } = useMasterOptions("employment_type");
  const { data: workModes, refetch: refWm } = useMasterOptions("work_mode");
  const { data: salaryTypes, refetch: refStype } = useMasterOptions("salary_type");
  const { data: payCycles, refetch: refPc } = useMasterOptions("payment_cycle");
  const { data: payDates, refetch: refPd } = useMasterOptions("payment_date");
  const { data: expCats, refetch: refExp } = useMasterOptions("expense_category");
  const { data: presets, refetch: refPreset } = useMasterOptions("access_preset");
  const { activeBrands, allocationBrands } = useBrands();

  useEffect(() => {
    if (!member) return;
    (async () => {
      const [ba, ma, alloc] = await Promise.all([
        getBrandAccessForMember(member.id),
        getModuleAccessForMember(member.id),
        getBrandAllocations(member.id),
      ]);
      setBrandIds(new Set(ba.map((r) => r.brand_id)));
      setModuleIds(new Set(ma.map((r) => r.module_id)));
      setAllocations(alloc);
      const first = ma[0];
      if (first) {
        setPerms({
          view: first.can_view, create: first.can_create, edit: first.can_edit,
          delete: first.can_delete, export: first.can_export,
          finance: first.can_view_finance, manage_access: first.can_manage,
        });
      }
    })();
  }, [member]);

  // Allocation total — used for compensation gating warning.
  const allocTotal = useMemo(
    () => allocations.reduce((s, a) => s + (Number(a.percentage) || 0), 0),
    [allocations],
  );

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!name.trim()) return "Full Name is required.";
      if (!email.trim()) return "Email is required.";
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Email format looks invalid.";
    }
    if (n === 3 && autoAdd) {
      if (!salaryAmount) return "Enter salary amount before enabling auto-sync.";
      if (Math.round(allocTotal) !== 100) return "Brand allocation must total 100% before salary can sync into expenses.";
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) { setStepError(err); return; }
    setStepError(null);
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function goPrev() { setStepError(null); setStep((s) => Math.max(1, s - 1)); }

  async function handleSave(thenPreview: boolean) {
    for (let i = 1; i <= STEPS.length; i++) {
      const err = validateStep(i);
      if (err) { setStep(i); setStepError(err); return; }
    }
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(), email: email.trim(), phone: phone.trim() || null,
        position_id: positionId || null, status, access_level: accessLevel, notes: notes || null,
        department: department || null,
        joining_date: joiningDate || null,
        salary_amount: salaryAmount ? Number(salaryAmount) : null,
        salary_currency: salaryCurrency || "INR",
        payment_cycle: paymentCycle || "monthly",
        expense_category: expenseCategory || null,
        auto_add_to_expenses: autoAdd,
        // New optional columns added by the wizard migration.
        employment_type: employmentType || null,
        work_mode: workMode || null,
        salary_type: salaryType || null,
        payment_date: paymentDate || null,
        reporting_manager: reportingManager || null,
        access_preset: accessPreset || null,
      };
      const saved = isNew ? await createTeamMember(payload) : await updateTeamMember(member!.id, payload);

      const memberId = saved.id;
      const linkedUserId = saved.linked_user_id;

      const brandRows = Array.from(brandIds).map((bid) => ({
        team_member_id: memberId, brand_id: bid, access_level: accessLevel,
        can_view: perms.view, can_create: perms.create, can_edit: perms.edit,
        can_delete: perms.delete, can_export: perms.export, can_manage: perms.manage_access,
      }));
      const moduleRows = Array.from(moduleIds).map((mid) => ({
        team_member_id: memberId, module_id: mid, access_level: accessLevel, scope: "assigned",
        can_view: perms.view, can_create: perms.create, can_edit: perms.edit,
        can_delete: perms.delete, can_export: perms.export, can_manage: perms.manage_access,
        can_view_finance: perms.finance,
      }));
      await Promise.all([
        saveBrandAccess(memberId, brandRows as any, linkedUserId),
        saveModuleAccess(memberId, moduleRows as any, linkedUserId),
        saveBrandAllocations(memberId, allocations.map((a) => ({ ...a, team_member_id: memberId }))),
      ]);

      // Salary sync: ON+allocation → upsert; OFF or 0% → pause existing template.
      try {
        const mzBrand = allocationBrands.find((b) => /marketizer/i.test(b.name));
        const mzPct = mzBrand
          ? Number(allocations.find((a) => a.brand_id === mzBrand.id)?.percentage ?? 0)
          : 0;
        if (autoAdd && salaryAmount && mzPct > 0) {
          const payDay = Number(String(paymentDate ?? "").replace(/[^\d]/g, "")) || null;
          await syncMemberSalaryToMarketizersExpenses({
            memberId, memberName: name.trim(),
            role: positions.find((p) => p.id === positionId)?.name ?? null,
            department: department || null,
            salaryAmount: Number(salaryAmount), marketizersPercentage: mzPct,
            paymentDay: payDay,
            month: currentMonthKey(),
          });
        } else {
          // Auto-sync turned off, salary cleared, or allocation removed → pause any
          // existing synced template so future Generate calls skip it.
          await pauseMemberSalaryTemplate(memberId);
        }
      } catch (e: any) {
        toast.warning(`Saved, but salary sync failed: ${e?.message ?? e}`);
      }

      toast.success(isNew ? "Team member added." : "Team member updated.");
      onSaved();
      if (thenPreview) toast.info("Preview-as-User: switch to Team Access Control → Preview tab.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    } finally { setBusy(false); }
  }

  const positionName = positions.find((p) => p.id === positionId)?.name;
  const selectedBrandNames = activeBrands.filter((b) => brandIds.has(b.id)).map((b) => b.name);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--parchment)", width: "min(740px, 96vw)", height: "100vh",
          display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Team Access Control</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
              {isNew ? "Add Team Member" : "Edit Team Member"}
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 4, maxWidth: 480, lineHeight: 1.5 }}>
              Create a team profile, assign access, and connect compensation to expenses.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--ink3)" }}>✕</button>
        </div>

        {/* Stepper */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--ivory)", display: "flex", gap: 8, overflowX: "auto" }}>
          {STEPS.map((s) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <button
                key={s.n}
                onClick={() => { setStepError(null); setStep(s.n); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                  borderRadius: 999, border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
                  background: active ? "var(--ink)" : done ? "var(--gold-bg)" : "var(--parchment)",
                  color: active ? "var(--parchment)" : "var(--ink)",
                  fontSize: 12, fontFamily: "'Figtree',sans-serif", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: active ? "var(--gold3)" : done ? "var(--green)" : "var(--parchment2)",
                  color: active ? "var(--ink)" : done ? "var(--parchment)" : "var(--ink4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                }}>{done ? "✓" : s.n}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
          {stepError && (
            <div style={{ padding: "10px 14px", marginBottom: 16, background: "var(--red-bg)", border: "1px solid rgba(139,32,32,.18)", borderRadius: 8, color: "var(--red)", fontSize: 12.5 }}>
              {stepError}
            </div>
          )}

          {step === 1 && (
            <StepShell title="Basic Details" helper="Identity and contact details. Login access can be enabled later.">
              <Grid>
                <div>
                  <FieldLabel>Full Name *</FieldLabel>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Full name" />
                </div>
                <div>
                  <FieldLabel>Phone *</FieldLabel>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+91 ..." />
                </div>
                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="name@gratefulworld.in" />
                </div>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <QuickSaveSelect optionType="team_member_status" options={statuses} value={status} onChange={setStatus} refresh={refStatus} placeholder="Select status…" />
                </div>
              </Grid>
              <label style={toggleStyle}>
                <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
                <span>
                  <strong style={{ display: "block", fontSize: 13 }}>Send login invite</strong>
                  <span style={{ fontSize: 11.5, color: "var(--ink4)" }}>You can create a team profile without giving login access immediately.</span>
                </span>
              </label>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Work Details" helper="Where this person fits in the company.">
              <Grid>
                <div>
                  <FieldLabel>Position *</FieldLabel>
                  <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                    <select value={positionId} onChange={(e) => setPositionId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      <option value="">Select position…</option>
                      {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button
                      type="button"
                      title="Add new position"
                      onClick={async () => {
                        const name = window.prompt("Add new position (e.g. Operations Lead):");
                        if (!name || !name.trim()) return;
                        try {
                          const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                          const created = await createPosition({ name: name.trim(), slug, default_access_level: "viewer", status: "active", sort_order: 999 } as any);
                          await refPositions();
                          setPositionId(created.id);
                          toast.success("Position added.");
                        } catch (e: any) {
                          toast.error(e?.message ?? "Could not add position.");
                        }
                      }}
                      style={{ width: 34, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)", color: "var(--ink)", cursor: "pointer", fontSize: 16, lineHeight: 1, fontFamily: "'Figtree',sans-serif" }}
                    >+</button>
                  </div>
                </div>
                <div>
                  <FieldLabel>Department</FieldLabel>
                  <QuickSaveSelect optionType="department" options={departments} value={department} onChange={setDepartment} refresh={refDept} placeholder="e.g. Marketing…" />
                </div>
                <div>
                  <FieldLabel>Reporting Manager</FieldLabel>
                  <QuickSaveSelect optionType="reporting_manager" options={managers} value={reportingManager} onChange={setReportingManager} refresh={refMgr} placeholder="Select manager…" />
                </div>
                <div>
                  <FieldLabel>Employment Type</FieldLabel>
                  <QuickSaveSelect optionType="employment_type" options={empTypes} value={employmentType} onChange={setEmploymentType} refresh={refEmp} placeholder="Full-Time, Intern…" />
                </div>
                <div>
                  <FieldLabel>Joining Date</FieldLabel>
                  <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <FieldLabel>Work Mode</FieldLabel>
                  <QuickSaveSelect optionType="work_mode" options={workModes} value={workMode} onChange={setWorkMode} refresh={refWm} placeholder="Office, Remote, Hybrid…" />
                </div>
              </Grid>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Compensation" helper="Package details. Brand allocation only appears when salary auto-sync is enabled.">
              <Grid>
                <div>
                  <FieldLabel>Salary / Package Amount</FieldLabel>
                  <input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} style={inputStyle}>
                    <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Salary Type</FieldLabel>
                  <QuickSaveSelect optionType="salary_type" options={salaryTypes} value={salaryType} onChange={setSalaryType} refresh={refStype} placeholder="Monthly Fixed…" />
                </div>
                <div>
                  <FieldLabel>Payment Cycle</FieldLabel>
                  <QuickSaveSelect optionType="payment_cycle" options={payCycles} value={paymentCycle} onChange={setPaymentCycle} refresh={refPc} placeholder="Monthly, Weekly…" />
                </div>
                <div>
                  <FieldLabel>Payment Date</FieldLabel>
                  <QuickSaveSelect optionType="payment_date" options={payDates} value={paymentDate} onChange={setPaymentDate} refresh={refPd} placeholder="1st of every month…" />
                </div>
                <div>
                  <FieldLabel>Expense Category</FieldLabel>
                  <QuickSaveSelect optionType="expense_category" options={expCats} value={expenseCategory} onChange={setExpenseCategory} refresh={refExp} placeholder="Team Salary / Payroll…" />
                </div>
              </Grid>

              <label style={toggleStyle}>
                <input type="checkbox" checked={autoAdd} onChange={(e) => setAutoAdd(e.target.checked)} />
                <span>
                  <strong style={{ display: "block", fontSize: 13 }}>Auto-sync salary into Expenses</strong>
                  <span style={{ fontSize: 11.5, color: "var(--ink4)" }}>When ON, the Marketizers share of this salary is added to that brand's monthly expenses based on allocation %.</span>
                </span>
              </label>

              {autoAdd && (
                <div style={{ marginTop: 18 }}>
                  <SectionTitle>Brand Cost Allocation</SectionTitle>
                  <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 10 }}>
                    Split this member's cost across brands. Total must equal 100%.
                    {Math.round(allocTotal) !== 100 && (
                      <span style={{ color: "var(--amber)", marginLeft: 6 }}>
                        Currently {Math.round(allocTotal)}%.
                      </span>
                    )}
                  </div>
                  <TeamBrandAllocationEditor value={allocations} onChange={setAllocations} />
                </div>
              )}
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Brand & Module Access" helper="Pick brands first; only relevant modules are shown.">
              <Grid>
                <div>
                  <FieldLabel>Access Preset</FieldLabel>
                  <QuickSaveSelect optionType="access_preset" options={presets} value={accessPreset} onChange={setAccessPreset} refresh={refPreset} placeholder="Viewer, Manager, Admin…" />
                </div>
                <div>
                  <FieldLabel>Access Level</FieldLabel>
                  <QuickSaveSelect optionType="access_level" options={levels} value={accessLevel} onChange={setAccessLevel} refresh={refLevel} placeholder="Select level…" />
                </div>
              </Grid>

              <div style={{ marginTop: 18 }}>
                <SectionTitle>Brand Access</SectionTitle>
                <BrandAccessSelector value={brandIds} onChange={setBrandIds} />
              </div>

              <div style={{ marginTop: 18 }}>
                <SectionTitle>Module Access</SectionTitle>
                {brandIds.size === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink4)", padding: "10px 12px", background: "var(--ivory)", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    Select at least one brand above to see its modules.
                  </div>
                ) : (
                  <ModuleAccessSelector value={moduleIds} onChange={setModuleIds} restrictToBrandIds={brandIds} />
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <button
                  type="button" className="btn-sm"
                  onClick={() => setShowAdvancedPerms((v) => !v)}
                  style={{ background: "transparent" }}
                >
                  {showAdvancedPerms ? "▾ Advanced Permissions" : "▸ Advanced Permissions"}
                </button>
                {showAdvancedPerms && (
                  <div style={{ marginTop: 10 }}>
                    <PermissionToggleList value={perms} onChange={setPerms} />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <FieldLabel>Internal Notes</FieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "'Figtree',sans-serif" }}
                  placeholder="Anything the admin team should know…" />
              </div>
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="Review & Save" helper="Last look before saving.">
              <ReviewBlock title="Profile" rows={[
                ["Name", name || "—"], ["Phone", phone || "—"], ["Email", email || "—"], ["Status", status || "—"],
                ["Login invite", sendInvite ? "Yes" : "Profile only"],
              ]} />
              <ReviewBlock title="Work" rows={[
                ["Position", positionName || "—"],
                ["Department", department || "—"],
                ["Reporting Manager", reportingManager || "—"],
                ["Employment Type", employmentType || "—"],
                ["Joining Date", joiningDate || "—"],
                ["Work Mode", workMode || "—"],
              ]} />
              <ReviewBlock title="Compensation" rows={[
                ["Amount", salaryAmount ? `${salaryCurrency} ${salaryAmount}` : "—"],
                ["Type", salaryType || "—"],
                ["Cycle", paymentCycle || "—"],
                ["Payment Date", paymentDate || "—"],
                ["Expense Category", expenseCategory || "—"],
                ["Auto-sync to Expenses", autoAdd ? `Yes · allocation ${Math.round(allocTotal)}%` : "No"],
              ]} />
              <ReviewBlock title="Access" rows={[
                ["Preset", accessPreset || "—"],
                ["Access Level", accessLevel || "—"],
                ["Brands", selectedBrandNames.length ? selectedBrandNames.join(", ") : "— none —"],
                ["Modules assigned", String(moduleIds.size)],
              ]} />
              {(!name.trim() || !email.trim()) && (
                <Warning>Missing required fields — go back to Step 1.</Warning>
              )}
              {autoAdd && Math.round(allocTotal) !== 100 && (
                <Warning>Brand allocation not 100% — auto-sync to expenses will be blocked.</Warning>
              )}
              {moduleIds.size === 0 && (
                <Warning>No modules assigned — this member will see only the brand hubs they belong to.</Warning>
              )}
            </StepShell>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--ivory)", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink4)" }}>Step {step} of {STEPS.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            {step > 1 && <button className="btn-sm" onClick={goPrev} disabled={busy}>← Previous</button>}
            {step < STEPS.length && (
              <button className="btn-sm" onClick={goNext} disabled={busy}
                style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
                Next →
              </button>
            )}
            {step === STEPS.length && (
              <>
                <button className="btn-sm" onClick={() => handleSave(false)} disabled={busy}
                  style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
                  {busy ? "Saving…" : "Save Team Member"}
                </button>
                <button className="btn-sm" onClick={() => handleSave(true)} disabled={busy}
                  style={{ background: "var(--gold3)", color: "var(--ink)", borderColor: "var(--gold3)" }}>
                  Save & Preview
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Local layout helpers ----------

function StepShell({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{title}</h3>
      {helper && <p style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 18, lineHeight: 1.5 }}>{helper}</p>}
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".14em",
      textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10,
      paddingBottom: 6, borderBottom: "1px solid var(--border)",
    }}>{children}</div>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div style={{ marginBottom: 14, padding: 14, background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 11, color: "var(--ink4)" }}>{k}</div>
            <div style={{ fontSize: 13, color: "var(--ink)" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 8, padding: "9px 12px", background: "var(--amber-bg, rgba(122,78,16,.08))",
      border: "1px solid rgba(122,78,16,.22)", borderRadius: 8,
      fontSize: 12.5, color: "var(--amber, #7a4e10)",
    }}>{children}</div>
  );
}

const toggleStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", marginTop: 14,
  background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
};
