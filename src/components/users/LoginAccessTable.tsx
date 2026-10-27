import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listUserAccessRows,
  sendUserInvite,
  sendPasswordReset,
  setUserLoginDisabled,
  confirmAndSendSetupLink,
  adminSetUserPassword,
  type UserAccessRow,
} from "@/lib/userAccess.functions";
import { isValidPassword } from "@/lib/userAccess.helpers";
import {
  STATUS_LABEL,
  STATUS_PILL,
  actionsForStatus,
  ACTION_LABEL,
  type UserAccessAction,
} from "@/lib/userAccess.helpers";
import { ScrollableTable, LoadingState, EmptyState } from "@/components/marketizers/ui";

export function LoginAccessTable() {
  const [rows, setRows] = useState<UserAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserAccessRow | null>(null);
  const fetchRows = useServerFn(listUserAccessRows);
  const fnInvite = useServerFn(sendUserInvite);
  const fnReset = useServerFn(sendPasswordReset);
  const fnDisable = useServerFn(setUserLoginDisabled);
  const fnConfirm = useServerFn(confirmAndSendSetupLink);
  const fnSetPassword = useServerFn(adminSetUserPassword);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchRows();
      setRows(r.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runAction = async (row: UserAccessRow, action: UserAccessAction) => {
    setBusyEmail(row.email);
    try {
      if (action === "send_invite" || action === "resend_invite") {
        const res = await fnInvite({ data: { email: row.email, display_name: row.display_name } });
        if (res.alreadyExists && !res.resent) {
          toast.message("User already exists — send a password reset instead.");
        } else {
          toast.success(action === "resend_invite" ? "Invite resent" : "Invite sent");
        }
      } else if (action === "send_reset") {
        await fnReset({ data: { email: row.email } });
        toast.success("Password reset email sent");
      } else if (action === "confirm_and_send_setup") {
        await fnConfirm({ data: { email: row.email, display_name: row.display_name } });
        toast.success("Email confirmed and setup link sent");
      } else if (action === "set_password") {
        setPwTarget(row);
        return;
      } else if (action === "disable_login" || action === "enable_login") {
        if (!row.user_id) return toast.error("No auth user linked");
        await fnDisable({ data: { user_id: row.user_id, disabled: action === "disable_login" } });
        toast.success(action === "disable_login" ? "Login disabled" : "Login enabled");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusyEmail(null);
    }
  };

  const toggleSel = (email: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(email) ? n.delete(email) : n.add(email);
      return n;
    });
  };

  const bulkInvite = async () => {
    const targets = rows.filter((r) => selected.has(r.email) && r.invite_status === "not_invited");
    if (!targets.length) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const r of targets) {
      try { await fnInvite({ data: { email: r.email, display_name: r.display_name } }); ok += 1; }
      catch { fail += 1; }
    }
    setBulkBusy(false);
    setSelected(new Set());
    toast.success(`Invites sent: ${ok}${fail ? `, failed: ${fail}` : ""}`);
    await load();
  };

  const bulkReset = async () => {
    const eligible = rows.filter((r) => selected.has(r.email) && (r.invite_status === "active" || r.invite_status === "reset_sent") && r.user_id);
    const skippedNotInvited = rows.filter((r) => selected.has(r.email) && r.invite_status === "not_invited").length;
    const skippedDisabled = rows.filter((r) => selected.has(r.email) && r.invite_status === "disabled").length;
    if (!eligible.length) {
      toast.message(`No eligible users. ${skippedNotInvited ? `${skippedNotInvited} not invited (send invite first). ` : ""}${skippedDisabled ? `${skippedDisabled} disabled (enable first).` : ""}`.trim() || "No active users selected.");
      return;
    }
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const r of eligible) {
      try { await fnReset({ data: { email: r.email } }); ok += 1; }
      catch { fail += 1; }
    }
    setBulkBusy(false);
    setSelected(new Set());
    const notes: string[] = [`Password resets sent: ${ok}`];
    if (fail) notes.push(`failed: ${fail}`);
    if (skippedNotInvited) notes.push(`${skippedNotInvited} skipped (not invited)`);
    if (skippedDisabled) notes.push(`${skippedDisabled} skipped (disabled)`);
    toast.success(notes.join(", "));
    await load();
  };


  const selectedNotInvited = useMemo(
    () => rows.filter((r) => selected.has(r.email) && r.invite_status === "not_invited").length,
    [rows, selected],
  );
  const selectedResettable = useMemo(
    () => rows.filter((r) => selected.has(r.email) && (r.invite_status === "active" || r.invite_status === "reset_sent") && r.user_id).length,
    [rows, selected],
  );

  if (loading) return <LoadingState rows={4} />;

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div style={{ padding: "10px 22px", background: "var(--gold-bg)", borderBottom: "1px solid var(--gold-border)", fontSize: 11.5, color: "var(--ink2)" }}>
        <strong>Email delivery:</strong> Lovable Cloud's default Supabase email is used. Deliverability to external addresses (Gmail, etc.) can be unreliable. If a user reports
        <em> "Email not confirmed"</em> or never receives the invite, use <strong>Confirm + Send Setup Link</strong> on their row.
      </div>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--parchment2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            Team Members — Login Access
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 2 }}>
            Activation and reset emails are sent through the platform's auth email system.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selectedNotInvited > 0 && (
            <button className="btn-sm btn-primary" onClick={bulkInvite} disabled={bulkBusy}>
              {bulkBusy ? "Sending…" : `Send Invites (${selectedNotInvited})`}
            </button>
          )}
          {selectedResettable > 0 && (
            <button className="btn-sm" onClick={bulkReset} disabled={bulkBusy}>
              {bulkBusy ? "Sending…" : `Send Password Reset (${selectedResettable})`}
            </button>
          )}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState icon="👥" title="No users yet" message="Add a team member to invite them." />
      ) : (
        <ScrollableTable minWidth={780}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["", "Email", "Name", "Roles", "Login Access", "Last Login", "Actions"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const acts = actionsForStatus(r.invite_status);
                const busy = busyEmail === r.email;
                return (
                  <tr key={r.email} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.email)}
                        onChange={() => toggleSel(r.email)}
                        disabled={r.invite_status === "disabled"}
                      />
                    </td>
                    <td style={td}>{r.email || "—"}</td>
                    <td style={td}>{r.display_name ?? "—"}</td>
                    <td style={td}>{r.roles.join(", ") || "—"}</td>
                    <td style={td}>
                      <span className={`status-pill ${STATUS_PILL[r.invite_status]}`}>
                        {STATUS_LABEL[r.invite_status]}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>
                      {r.last_login_at ? new Date(r.last_login_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {acts.map((a) => (
                        <button
                          key={a}
                          className="btn-sm"
                          style={{ marginLeft: 6 }}
                          onClick={() => runAction(r, a)}
                          disabled={busy}
                        >
                          {busy ? "…" : ACTION_LABEL[a]}
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      )}
      {pwTarget && (
        <SetPasswordModal
          row={pwTarget}
          onClose={() => setPwTarget(null)}
          onSubmit={async (pw) => {
            try {
              const res = await fnSetPassword({
                data: { email: pwTarget.email, password: pw, display_name: pwTarget.display_name },
              });
              toast.success(res.created ? "Account created with password" : "Password updated");
              setPwTarget(null);
              await load();
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to set password");
            }
          }}
        />
      )}
    </div>
  );
}

export function SetPasswordModal({
  row,
  onClose,
  onSubmit,
}: {
  row: UserAccessRow;
  onClose: () => void;
  onSubmit: (pw: string) => Promise<void>;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== confirm) { setErr("Passwords don't match."); return; }
    const check = isValidPassword(pw);
    if (!check.ok) { setErr(check.reason ?? "Invalid password"); return; }
    setBusy(true);
    try { await onSubmit(pw); }
    catch (e: any) { setErr(e?.message ?? "Failed to set password"); }
    finally { setBusy(false); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,18,14,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, width: "100%", maxWidth: 420, padding: 24 }}
      >
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
          Set Password
        </div>
        <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 16 }}>
          Manually set a login password for <strong style={{ color: "var(--ink2)" }}>{row.display_name ?? row.email}</strong> ({row.email}). They can sign in with this password immediately — no email required.
        </div>

        <label style={labelStyle}>New Password</label>
        <input
          data-testid="set-password-input"
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          maxLength={72}
          required
          autoFocus
          style={inputStyle}
          placeholder="Enter any password"
        />

        <label style={labelStyle}>Confirm Password</label>
        <input
          data-testid="set-password-confirm"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          maxLength={72}
          required
          style={inputStyle}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink4)", marginBottom: 14 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
        </label>

        {err && (
          <div style={{ padding: "8px 10px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid rgba(139,32,32,.15)", borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-sm btn-primary" disabled={busy} data-testid="set-password-submit">
            {busy ? "Saving…" : "Set Password"}
          </button>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--parchment2)", fontSize: 11, color: "var(--ink4)", lineHeight: 1.5 }}>
          Share this password with the team member through a secure channel. Ask them to change it after their first sign-in via <em>Send Password Reset</em> when ready.
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontFamily: "'Figtree',sans-serif", fontSize: 13.5, color: "var(--ink)", outline: "none", marginBottom: 12 };


const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 22px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "13px 8px 13px 22px", verticalAlign: "middle", fontSize: 13, color: "var(--ink2)" };
