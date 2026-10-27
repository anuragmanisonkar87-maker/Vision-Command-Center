import { useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import { BrandAccessSelector, type BrandAccessSelection } from "./BrandAccessSelector";
import { createUserInvite } from "@/services/users/userService";
import type { AppRole } from "@/types/auth";

const ROLES: AppRole[] = ["admin", "finance_manager", "brand_manager", "operator", "team_member", "media_buyer"];

export function UserInviteDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["team_member"]);
  const [access, setAccess] = useState<BrandAccessSelection>({ brand_ids: [], all_brands: false, access_level: "viewer" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const toggle = (r: AppRole) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const submit = async () => {
    setErr(null);
    if (!email.trim()) return setErr("Email is required.");
    setBusy(true);
    try {
      await createUserInvite({
        email: email.trim().toLowerCase(),
        display_name: name.trim() || null,
        roles,
        brand_ids: access.brand_ids,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={scrim} onClick={onClose}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            Invite User
          </h3>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>
        <div style={body}>
          {err && <div style={errBox}>{err}</div>}
          <div style={{ background: "var(--parchment2)", padding: "8px 12px", borderRadius: 6, fontSize: 11.5, color: "var(--ink3)", marginBottom: 14 }}>
            Invites are stored in the workspace. The invitee must sign up with this email; their roles and brand access will be applied on first login.
          </div>
          <Field label="Email"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" /></Field>
          <Field label="Display name (optional)"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>

          <Field label="Roles">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <button key={r} type="button" className="btn-sm" onClick={() => toggle(r)}
                    style={{
                      background: on ? "var(--ink)" : "transparent", color: on ? "var(--ivory)" : "var(--ink2)",
                      borderColor: on ? "var(--ink)" : "var(--border)", fontSize: 11,
                    }}>
                    {on ? "✓ " : "+ "}{r}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Brand access"><BrandAccessSelector value={access} onChange={setAccess} /></Field>

          <Field label="Notes (optional)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-sm btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save invite"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

const scrim: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(28,24,20,.42)", zIndex: 70, display: "flex", justifyContent: "flex-end" };
const drawer: React.CSSProperties = { width: "min(520px,100%)", height: "100%", background: "var(--ivory)", display: "flex", flexDirection: "column", overflow: "hidden" };
const head: React.CSSProperties = { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" };
const body: React.CSSProperties = { padding: 22, overflowY: "auto", flex: 1 };
const errBox: React.CSSProperties = { background: "var(--red-bg)", color: "var(--red)", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 };
