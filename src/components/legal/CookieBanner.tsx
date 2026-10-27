import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const COOKIE_NAME = "pl_cookie_consent";

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeConsent(value: "accepted" | "declined") {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = (value: "accepted" | "declined") => {
    writeConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 560,
        margin: "0 auto",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(17, 24, 39, 0.14)",
        padding: 18,
        zIndex: 100,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#FFFBEB", display: "grid", placeItems: "center", color: "#D97706", flexShrink: 0 }}>
          <Cookie size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>
            We use cookies
          </div>
          <p style={{ fontSize: 13, color: "#4B5563", margin: 0, lineHeight: 1.55 }}>
            We use essential cookies to run PhotoLancer and optional cookies for analytics. See our{" "}
            <Link to="/cookie-policy" style={{ color: "#D97706", textDecoration: "underline" }}>Cookie Policy</Link>.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => dismiss("accepted")}
              style={{ padding: "9px 16px", borderRadius: 8, background: "#D97706", color: "#fff", fontSize: 13, fontWeight: 600 }}
            >
              Accept all
            </button>
            <button
              onClick={() => dismiss("declined")}
              style={{ padding: "9px 16px", borderRadius: 8, background: "#F3F4F6", color: "#111827", fontSize: 13, fontWeight: 600 }}
            >
              Decline non-essential
            </button>
          </div>
        </div>
        <button
          aria-label="Dismiss"
          onClick={() => dismiss("declined")}
          style={{ width: 28, height: 28, borderRadius: 6, color: "#9CA3AF", display: "grid", placeItems: "center", flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
