import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRecoveryUrlParams } from "@/lib/authRecovery.helpers";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => { document.title = "Set Your Password | GWV Vision Center"; }, []);

  useEffect(() => {
    let cancelled = false;

    // Supabase recovery links land with tokens in the URL hash:
    //   #access_token=...&refresh_token=...&type=recovery
    // We must call setSession() with them before updateUser() will work.
    const params = typeof window !== "undefined" ? getRecoveryUrlParams(window.location) : new URLSearchParams();
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    const errDesc = params.get("error_description") || params.get("error");

    if (errDesc) {
      setError(decodeURIComponent(errDesc));
      setStatus("invalid");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    (async () => {
      try {
        if (access_token && refresh_token && (type === "recovery" || type === null)) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) throw setErr;
          // Clean tokens from the URL so they aren't visible/copied.
          window.history.replaceState({}, document.title, window.location.pathname);
          if (!cancelled) setStatus("ready");
          return;
        }
        if (!cancelled) setStatus("invalid");
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "This setup link is invalid or expired.");
          setStatus("invalid");
        }
      }
    })();

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setStatus("saving");
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      await supabase.auth.signOut({ scope: "local" });
      setStatus("done");
      setInfo("Password set successfully. Please sign in.");
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (e: any) {
      setError(e?.message ?? "Could not set password.");
      setStatus("ready");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 12, padding: "44px 40px 36px", width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: "var(--gold3)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>G</div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Grateful World Ventures</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em", margin: 0, textAlign: "center" }}>Set your Vision Center password</h1>
        </div>

        {status === "checking" && (
          <div style={{ textAlign: "center", color: "var(--ink4)", fontSize: 13 }}>Verifying setup link…</div>
        )}

        {status === "invalid" && (
          <div>
            <Banner tone="red">{error || "This setup link is invalid or expired. Please ask your administrator to send a new setup link."}</Banner>
            <Link to="/login" style={{ display: "block", marginTop: 16, textAlign: "center", padding: "10px 16px", borderRadius: 7, background: "var(--ink)", color: "var(--parchment)", fontFamily: "'Figtree',sans-serif", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>Back to Login</Link>
          </div>
        )}

        {(status === "ready" || status === "saving" || status === "done") && (
          <form onSubmit={onSubmit}>
            <Field label="New Password">
              <input data-testid="reset-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="At least 8 characters" autoComplete="new-password" />
            </Field>
            <Field label="Confirm Password">
              <input data-testid="reset-confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} placeholder="Re-enter password" autoComplete="new-password" />
            </Field>
            <button data-testid="reset-submit" type="submit" disabled={status === "saving" || status === "done"} style={{ width: "100%", marginTop: 8, padding: "12px 16px", borderRadius: 7, background: "var(--ink)", color: "var(--parchment)", fontFamily: "'Figtree',sans-serif", fontSize: 13.5, fontWeight: 600, border: "none", cursor: status === "saving" ? "wait" : "pointer", opacity: status === "saving" || status === "done" ? 0.7 : 1 }}>
              {status === "saving" ? "Saving…" : status === "done" ? "Saved" : "Set Password"}
            </button>
            {error && <Banner tone="red">{error}</Banner>}
            {info && <Banner tone="gold">{info}</Banner>}
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function Banner({ tone, children }: { tone: "red" | "gold"; children: React.ReactNode }) {
  const colors = tone === "red"
    ? { bg: "var(--red-bg)", fg: "var(--red)", br: "rgba(139,32,32,.15)" }
    : { bg: "var(--gold-bg)", fg: "var(--gold)", br: "var(--gold-border)" };
  return (
    <div style={{ marginTop: 14, padding: "10px 12px", background: colors.bg, color: colors.fg, border: `1px solid ${colors.br}`, borderRadius: 6, fontSize: 12.5, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontFamily: "'Figtree',sans-serif", fontSize: 13.5, color: "var(--ink)", outline: "none" };
