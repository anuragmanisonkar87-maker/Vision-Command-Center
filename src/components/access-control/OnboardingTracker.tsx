import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listUserAccessRows,
  sendUserInvite,
  sendPasswordReset,
  setUserLoginDisabled,
  type UserAccessRow,
} from "@/lib/userAccess.functions";
import { listAccessSummaries, type AccessSummaryRow } from "@/lib/onboardingTracker.functions";
import {
  STATUS_LABEL,
  STATUS_PILL,
  type InviteStatus,
} from "@/lib/userAccess.helpers";
import {
  deriveOnboarding,
  matchesFilter,
  ONBOARDING_LABEL,
  ONBOARDING_PILL,
  ACTION_NEEDED_LABEL,
  type OnboardingFilter,
} from "@/lib/onboardingTracker.helpers";
import { useTeamMembers, usePositions } from "@/hooks/useAccessControl";
import { MetricCard, LoadingState, EmptyState } from "@/components/marketizers/ui";

const FILTERS: { value: OnboardingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_setup", label: "Pending Setup" },
  { value: "active", label: "Active" },
  { value: "not_invited", label: "Not Invited" },
  { value: "disabled", label: "Disabled" },
  { value: "access_review", label: "Access Review Needed" },
];

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return "—"; }
}

export function OnboardingTracker() {
  const { data: members, loading: membersLoading } = useTeamMembers();
  const { data: positions } = usePositions();
  const positionMap = useMemo(
    () => Object.fromEntries(positions.map((p) => [p.id, p.name])),
    [positions],
  );

  const [access, setAccess] = useState<UserAccessRow[]>([]);
  const [summaries, setSummaries] = useState<AccessSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<OnboardingFilter>("all");

  const fetchAccess = useServerFn(listUserAccessRows);
  const fetchSummaries = useServerFn(listAccessSummaries);
  const fnInvite = useServerFn(sendUserInvite);
  const fnReset = useServerFn(sendPasswordReset);
  const fnDisable = useServerFn(setUserLoginDisabled);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([fetchAccess(), fetchSummaries()]);
      setAccess(a.rows);
      setSummaries(s.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const accessByEmail = useMemo(() => {
    const m = new Map<string, UserAccessRow>();
    for (const r of access) m.set(r.email.toLowerCase(), r);
    return m;
  }, [access]);

  const summaryById = useMemo(() => {
    const m = new Map<string, AccessSummaryRow>();
    for (const r of summaries) m.set(r.team_member_id, r);
    return m;
  }, [summaries]);

  type Row = {
    id: string;
    name: string;
    email: string;
    position: string;
    invite: InviteStatus;
    user_id: string | null;
    inviteSentAt: string | null;
    lastLoginAt: string | null;
    brandCount: number;
    moduleCount: number;
    onboarding: ReturnType<typeof deriveOnboarding>;
  };

  const rows: Row[] = useMemo(() => {
    return (members ?? [])
      .filter((m: any) => !m.is_deleted)
      .map((m: any) => {
        const email = String(m.email ?? "").toLowerCase();
        const acc = accessByEmail.get(email);
        const invite: InviteStatus = (acc?.invite_status ?? "not_invited") as InviteStatus;
        const sum = summaryById.get(m.id);
        const brandCount = sum?.brand_count ?? 0;
        const moduleCount = sum?.module_count ?? 0;
        const onboarding = deriveOnboarding(invite, {
          inviteSentAt: acc?.invite_sent_at ?? null,
          lastLoginAt: acc?.last_login_at ?? null,
          brandCount,
          moduleCount,
        });
        return {
          id: m.id,
          name: m.name ?? "—",
          email,
          position: positionMap[m.position_id] || "—",
          invite,
          user_id: acc?.user_id ?? null,
          inviteSentAt: acc?.invite_sent_at ?? null,
          lastLoginAt: acc?.last_login_at ?? null,
          brandCount,
          moduleCount,
          onboarding,
        };
      });
  }, [members, accessByEmail, summaryById, positionMap]);

  const visible = useMemo(
    () => rows.filter((r) => matchesFilter(filter, r.invite, r.onboarding.status)),
    [rows, filter],
  );

  const metrics = useMemo(() => {
    let total = rows.length, invitesSent = 0, active = 0, pending = 0, disabled = 0, review = 0;
    for (const r of rows) {
      if (r.invite === "invite_sent" || r.invite === "active" || r.invite === "reset_sent") invitesSent += 1;
      if (r.invite === "active") active += 1;
      if (r.invite === "not_invited" || r.invite === "invite_sent" || r.invite === "reset_sent") pending += 1;
      if (r.invite === "disabled") disabled += 1;
      if (r.onboarding.status === "access_review_needed") review += 1;
    }
    return { total, invitesSent, active, pending, disabled, review };
  }, [rows]);

  const runAction = async (row: Row, action: "send_invite" | "resend_invite" | "send_reset" | "disable_login" | "enable_login") => {
    if (!row.email) return;
    setBusy(row.email);
    try {
      if (action === "send_invite" || action === "resend_invite") {
        await fnInvite({ data: { email: row.email, display_name: row.name } });
        toast.success(action === "resend_invite" ? "Invite resent" : "Invite sent");
      } else if (action === "send_reset") {
        await fnReset({ data: { email: row.email } });
        toast.success("Password reset email sent");
      } else if (action === "disable_login" || action === "enable_login") {
        if (!row.user_id) { toast.error("No auth user linked"); return; }
        await fnDisable({ data: { user_id: row.user_id, disabled: action === "disable_login" } });
        toast.success(action === "disable_login" ? "Login disabled" : "Login enabled");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (membersLoading || loading) return <LoadingState rows={5} />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
        <MetricCard accent="gold" label="Total Team Members" value={String(metrics.total)} />
        <MetricCard accent="amber" label="Invites Sent" value={String(metrics.invitesSent)} />
        <MetricCard accent="green" label="Active Users" value={String(metrics.active)} />
        <MetricCard accent="amber" label="Pending Setup" value={String(metrics.pending)} />
        <MetricCard accent="red" label="Disabled" value={String(metrics.disabled)} />
        <MetricCard accent="red" label="Access Review" value={String(metrics.review)} />
      </div>

      <div style={{
        padding: "10px 14px", marginBottom: 14,
        background: "var(--parchment)", border: "1px solid var(--parchment2)",
        borderRadius: 8, fontSize: 12, color: "var(--ink3)",
      }}>
        🔒 Passwords are private. Admins can send invite/reset links but cannot view passwords.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className="btn-sm" style={{
            background: filter === f.value ? "var(--ink)" : "transparent",
            color: filter === f.value ? "var(--parchment)" : "var(--ink3)",
            borderColor: filter === f.value ? "var(--ink)" : "var(--border)",
          }}>{f.label}</button>
        ))}
      </div>

      {!visible.length ? (
        <EmptyState icon="🪄" title="No team members match this filter" message="Try a different filter or invite team members from the Team Members tab." />
      ) : (
        <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="attr-table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Email</th>
                  <th>Role / Position</th>
                  <th>Login Status</th>
                  <th>Invite Sent</th>
                  <th>Last Login</th>
                  <th>Brand Access</th>
                  <th>Module Access</th>
                  <th>Onboarding</th>
                  <th>Action Needed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const initial = r.name.trim().charAt(0).toUpperCase() || "?";
                  const isBusy = busy === r.email;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--gold3)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontWeight: 700 }}>{initial}</div>
                          <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink3)" }}>{r.email || "—"}</td>
                      <td style={{ fontSize: 12 }}>{r.position}</td>
                      <td><span className={`status-pill ${STATUS_PILL[r.invite]}`}>{STATUS_LABEL[r.invite]}</span></td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>{fmtDate(r.inviteSentAt)}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>{fmtDate(r.lastLoginAt)}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.brandCount}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.moduleCount} module{r.moduleCount === 1 ? "" : "s"}</td>
                      <td><span className={`status-pill ${ONBOARDING_PILL[r.onboarding.status]}`}>{ONBOARDING_LABEL[r.onboarding.status]}</span></td>
                      <td style={{ fontSize: 12, color: "var(--ink3)" }}>{ACTION_NEEDED_LABEL[r.onboarding.action]}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.invite === "not_invited" && r.email && (
                          <button className="btn-sm" disabled={isBusy} onClick={() => runAction(r, "send_invite")}>Send Invite</button>
                        )}
                        {r.invite === "invite_sent" && r.email && (
                          <button className="btn-sm" disabled={isBusy} onClick={() => runAction(r, "resend_invite")}>Resend Invite</button>
                        )}
                        {(r.invite === "active" || r.invite === "reset_sent") && r.email && (
                          <>
                            <button className="btn-sm" disabled={isBusy} onClick={() => runAction(r, "send_reset")}>Send Reset</button>{" "}
                            {r.user_id && (
                              <button className="btn-sm" disabled={isBusy} style={{ color: "var(--red)" }} onClick={() => runAction(r, "disable_login")}>Disable Login</button>
                            )}
                          </>
                        )}
                        {r.invite === "disabled" && r.user_id && (
                          <button className="btn-sm" disabled={isBusy} onClick={() => runAction(r, "enable_login")}>Enable Login</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
