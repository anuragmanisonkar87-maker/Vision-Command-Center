// @ts-nocheck
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listUserAccessRows,
  sendUserInvite,
  sendPasswordReset,
  setUserLoginDisabled,
  confirmAndSendSetupLink,
  adminSetUserPassword,
  type UserAccessRow,
} from "@/lib/userAccess.functions";
import { SetPasswordModal } from "@/components/users/LoginAccessTable";
import { STATUS_LABEL, STATUS_PILL, type InviteStatus } from "@/lib/userAccess.helpers";
import { PageHeader, MetricCard, EmptyState, LoadingState, ErrorBanner } from "@/components/marketizers/ui";
import { useTeamMembers, usePositions } from "@/hooks/useAccessControl";
import {
  setTeamMemberStatus, softDeleteTeamMember,
  bulkSetTeamMemberStatus, bulkArchiveTeamMembers, bulkAssignPosition,
  type TeamMember,
} from "@/services/accessControl/accessControlService";
import { TeamMemberDrawer } from "./TeamMemberDrawer";
import { AccessStatusPill } from "./AccessStatusPill";
import { ModuleRegistry } from "./ModuleRegistry";
import { AccessMatrix } from "./AccessMatrix";
import { PositionPresets } from "./PositionPresets";
import { PreviewAsUser } from "./PreviewAsUser";
import { AuditLog } from "./AuditLog";
import { OnboardingTracker } from "./OnboardingTracker";
import { useFinanceVisibility } from "@/hooks/useFinanceVisibility";
import { formatINR } from "@/utils/formatters/format";

const TABS = ["Team Members", "Onboarding Tracker", "Access Matrix", "Module Registry", "Position Presets", "Preview As User", "Audit Log"] as const;
type Tab = typeof TABS[number];

type TeamAccessControlPageProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  extraActions?: ReactNode;
};

export default function TeamAccessControlPage({
  eyebrow = "Settings",
  title = "Team Access Control",
  subtitle = "Add team members, assign brands, modules, positions, and permissions. Users see only what is assigned to them.",
  extraActions,
}: TeamAccessControlPageProps = {}) {
  const [tab, setTab] = useState<Tab>("Team Members");
  const canSeeFinance = useFinanceVisibility("marketizers");
  const { data: members, loading, error, refetch } = useTeamMembers();
  const { data: positions } = usePositions();
  const [drawer, setDrawer] = useState<{ open: boolean; member: TeamMember | null }>({ open: false, member: null });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [accessByEmail, setAccessByEmail] = useState<Map<string, UserAccessRow>>(new Map());
  const [accessBusy, setAccessBusy] = useState<string | null>(null);
  const fetchAccessRows = useServerFn(listUserAccessRows);
  const fnInvite = useServerFn(sendUserInvite);
  const fnReset = useServerFn(sendPasswordReset);
  const fnDisable = useServerFn(setUserLoginDisabled);
  const fnConfirm = useServerFn(confirmAndSendSetupLink);
  const fnSetPassword = useServerFn(adminSetUserPassword);
  const [pwTarget, setPwTarget] = useState<UserAccessRow | null>(null);

  const loadAccess = async () => {
    try {
      const r = await fetchAccessRows();
      const m = new Map<string, UserAccessRow>();
      for (const row of r.rows) m.set(row.email.toLowerCase(), row);
      setAccessByEmail(m);
    } catch {/* admin-only; silently ignore for non-admin viewers */}
  };
  useEffect(() => { void loadAccess(); }, []);

  const runAccessAction = async (email: string, status: InviteStatus, userId: string | null, displayName: string | null) => {
    const lower = email.toLowerCase();
    setAccessBusy(lower);
    try {
      if (status === "not_invited") {
        await fnInvite({ data: { email: lower, display_name: displayName } });
        toast.success("Invite sent");
      } else if (status === "invite_sent") {
        await fnInvite({ data: { email: lower, display_name: displayName } });
        toast.success("Invite resent");
      } else if (status === "email_not_confirmed") {
        await fnConfirm({ data: { email: lower, display_name: displayName } });
        toast.success("Email confirmed and setup link sent");
      } else if (status === "active" || status === "reset_sent") {
        await fnReset({ data: { email: lower } });
        toast.success("Password reset email sent");
      } else if (status === "disabled") {
        if (!userId) return toast.error("No auth user linked");
        await fnDisable({ data: { user_id: userId, disabled: false } });
        toast.success("Login enabled");
      }
      await loadAccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setAccessBusy(null);
    }
  };


  const positionMap = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p.name])), [positions]);

  const metrics = useMemo(() => {
    const total = members.length;
    const restricted = members.filter((m) => m.access_level !== "admin").length;
    const finance = members.filter((m) => m.access_level === "finance" || m.access_level === "admin").length;
    return { total, restricted, finance };
  }, [members]);

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.id)));
  };

  const runBulk = async (fn: () => Promise<void>, success: string) => {
    try {
      await fn();
      toast.success(success);
      setSelected(new Set());
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk operation failed.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={(
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
            {extraActions}
            {tab === "Team Members" && (
              <button className="btn-sm" onClick={() => setDrawer({ open: true, member: null })}
                style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
              >+ Add Team Member</button>
            )}
          </div>
        )}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
        <MetricCard accent="gold" label="Team Members" value={String(metrics.total)} />
        <MetricCard accent="amber" label="Restricted Users" value={String(metrics.restricted)} />
        <MetricCard accent="green" label="Module Assignments" value="—" helper="Phase 2" />
        <MetricCard accent="red" label="Finance Access" value={String(metrics.finance)} />
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 22, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 16px", border: "none", background: "transparent",
            cursor: "pointer", fontSize: 13, fontFamily: "'Figtree',sans-serif",
            color: tab === t ? "var(--ink)" : "var(--ink4)",
            fontWeight: tab === t ? 600 : 400,
            borderBottom: `2px solid ${tab === t ? "var(--gold3)" : "transparent"}`,
            whiteSpace: "nowrap", marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === "Team Members" && (
        <>
          {error && <ErrorBanner message={error} onRetry={refetch} />}

          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 12, background: "var(--ink)", color: "var(--parchment)", borderRadius: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
              <span style={{ flex: 1 }} />
              <button className="btn-sm" onClick={() => runBulk(() => bulkSetTeamMemberStatus([...selected], "active"), "Reactivated.")}>Activate</button>
              <button className="btn-sm" onClick={() => runBulk(() => bulkSetTeamMemberStatus([...selected], "paused"), "Paused.")}>Pause</button>
              <select onChange={(e) => {
                if (!e.target.value) return;
                const v = e.target.value === "__none__" ? null : e.target.value;
                void runBulk(() => bulkAssignPosition([...selected], v), "Position assigned.");
                e.target.value = "";
              }} defaultValue="" style={{ padding: "6px 8px", borderRadius: 6, fontSize: 12, background: "var(--ivory)", color: "var(--ink)", border: "1px solid var(--border)" }}>
                <option value="" disabled>Assign position…</option>
                <option value="__none__">— Clear position —</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-sm" style={{ color: "var(--red)" }} onClick={() => {
                if (!confirm(`Archive ${selected.size} member(s)?`)) return;
                void runBulk(() => bulkArchiveTeamMembers([...selected]), "Archived.");
              }}>Archive</button>
              <button className="btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}

          {loading ? <LoadingState rows={5} /> :
            members.length === 0 ? (
              <EmptyState icon="👥" title="No team members yet"
                message="Add your first team member to start assigning brands, modules, and permissions."
                action={<button className="btn-sm" onClick={() => setDrawer({ open: true, member: null })}
                  style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
                >+ Add Team Member</button>}
              />
            ) : (
              <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="attr-table" style={{ minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox"
                            checked={selected.size > 0 && selected.size === members.length}
                            onChange={toggleAll} />
                        </th>
                        <th>Team Member</th><th>Phone</th><th>Position</th>
                        <th>Status</th><th>Access Level</th>
                        {canSeeFinance && <><th>Monthly Salary</th><th>Payment Date</th><th>Auto-Sync</th></>}
                        <th>Login Access</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const initial = m.name.trim().charAt(0).toUpperCase() || "?";
                        return (
                          <tr key={m.id}>
                            <td>
                              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--gold3)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontWeight: 700 }}>{initial}</div>
                                <div>
                                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{m.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--ink4)" }}>{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{m.phone || "—"}</td>
                            <td>{positionMap[m.position_id] || "—"}</td>
                            <td><AccessStatusPill tone={m.status === "active" ? "yes" : "neutral"} label={m.status} /></td>
                            <td>
                              <AccessStatusPill
                                tone={m.access_level === "admin" ? "admin" : m.access_level === "finance" ? "finance" : "yes"}
                                label={m.access_level}
                              />
                            </td>
                            {canSeeFinance && (
                              <>
                                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{m.salary_amount ? formatINR(Number(m.salary_amount)) : "—"}</td>
                                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{(m as any).payment_date || "—"}</td>
                                <td>{m.auto_add_to_expenses ? <AccessStatusPill tone="yes" label="On" /> : <AccessStatusPill tone="neutral" label="Off" />}</td>
                              </>
                            )}
                            {(() => {
                              const acc = accessByEmail.get((m.email ?? "").toLowerCase());
                              const status: InviteStatus = (acc?.invite_status ?? "not_invited") as InviteStatus;
                              const actionLabel =
                                status === "not_invited" ? "Send Invite" :
                                status === "invite_sent" ? "Resend Invite" :
                                status === "email_not_confirmed" ? "Confirm + Send Setup Link" :
                                status === "active" || status === "reset_sent" ? "Send Password Reset" :
                                status === "disabled" ? "Enable Login" : null;
                              const busy = accessBusy === (m.email ?? "").toLowerCase();
                              return (
                                <td>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                                    <span className={`status-pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {actionLabel && m.email && (
                                        <button
                                          className="btn-sm"
                                          disabled={busy}
                                          onClick={() => runAccessAction(m.email, status, acc?.user_id ?? null, m.name ?? null)}
                                        >{busy ? "…" : actionLabel}</button>
                                      )}
                                      {m.email && (
                                        <button
                                          className="btn-sm btn-primary"
                                          disabled={busy}
                                          onClick={() => setPwTarget({
                                            user_id: acc?.user_id ?? null,
                                            email: (m.email as string).toLowerCase(),
                                            display_name: m.name ?? null,
                                            roles: acc?.roles ?? [],
                                            invite_status: status,
                                            invite_sent_at: acc?.invite_sent_at ?? null,
                                            password_reset_sent_at: acc?.password_reset_sent_at ?? null,
                                            last_login_at: acc?.last_login_at ?? null,
                                            disabled: acc?.disabled ?? false,
                                          })}
                                        >Set Password</button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })()}
                            <td style={{ whiteSpace: "nowrap" }}>
                              <button className="btn-sm" onClick={() => setDrawer({ open: true, member: m })}>Edit</button>{" "}
                              <button className="btn-sm" onClick={async () => {
                                await setTeamMemberStatus(m.id, m.status === "paused" ? "active" : "paused");
                                toast.success(m.status === "paused" ? "Reactivated." : "Paused.");
                                refetch();
                              }}>{m.status === "paused" ? "Resume" : "Pause"}</button>{" "}
                              <button className="btn-sm" onClick={async () => {
                                if (!confirm(`Archive ${m.name}?`)) return;
                                await softDeleteTeamMember(m.id);
                                toast.success("Archived.");
                                refetch();
                              }} style={{ color: "var(--red)" }}>Archive</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </>
      )}

      {tab === "Onboarding Tracker" && <OnboardingTracker />}
      {tab === "Module Registry" && <ModuleRegistry />}
      {tab === "Access Matrix" && <AccessMatrix />}
      {tab === "Position Presets" && <PositionPresets />}
      {tab === "Preview As User" && <PreviewAsUser />}
      {tab === "Audit Log" && <AuditLog />}

      {drawer.open && (
        <TeamMemberDrawer member={drawer.member} onClose={() => setDrawer({ open: false, member: null })}
          onSaved={() => refetch()} />
      )}
      {pwTarget && (
        <SetPasswordModal
          row={pwTarget}
          onClose={() => setPwTarget(null)}
          onSubmit={async (pw) => {
            const res = await fnSetPassword({
              data: { email: pwTarget.email, password: pw, display_name: pwTarget.display_name },
            });
            toast.success(res.created ? "Account created with password" : "Password updated");
            setPwTarget(null);
            await loadAccess();
          }}
        />
      )}
    </div>
  );
}
