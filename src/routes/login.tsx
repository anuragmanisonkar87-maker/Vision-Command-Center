import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { getRecoveryForwardUrl } from "@/lib/authRecovery.helpers";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Sign In | GWV Vision Center"; }, []);

  // Recovery-link fallback: if Supabase redirects a recovery email to /login
  // instead of /reset-password (e.g. Site URL fallback), forward the tokens
  // to the reset page without dropping them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forwardUrl = getRecoveryForwardUrl(window.location);
    if (forwardUrl) window.location.replace(forwardUrl);
  }, []);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await signIn(email, password);
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const msg = err?.message ?? "Authentication failed.";
      if (/email not confirmed/i.test(msg)) {
        setError("Your account email isn't confirmed yet. Please ask an administrator to send you a setup link.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 12, padding: "44px 40px 36px", width: "100%", maxWidth: 400, animation: "fadeUp .5s ease both" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: "var(--gold3)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>G</div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Grateful World Ventures</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>Vision Center</div>
        </div>

        <form onSubmit={onSubmit}>
          <Field label="Email">
            <input data-testid="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@gratefulworld.in" />
          </Field>
          <Field label="Password">
            <input data-testid="auth-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </Field>

          <button data-testid="auth-submit" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8, padding: "12px 16px", borderRadius: 7, background: "var(--ink)", color: "var(--parchment)", fontFamily: "'Figtree',sans-serif", fontSize: 13.5, fontWeight: 600, border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Please wait…" : "Sign In"}
          </button>

          {error && <Banner tone="red">{error}</Banner>}
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--ink4)" }}>
          Don't have an account? Please contact your administrator for login access.
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--ink4)", textAlign: "center", lineHeight: 1.6 }}>
          Internal use only — Grateful World Ventures team.
        </div>
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
