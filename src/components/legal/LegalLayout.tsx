import { Link } from "@tanstack/react-router";
import { Camera, FileText, Shield, RefreshCw, Cookie, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CookieBanner } from "./CookieBanner";

export type Section = { id: string; label: string };

const SUN = "#F59E0B";
const SUN_DEEP = "#D97706";
const INK = "#111827";
const INK2 = "#374151";
const INK3 = "#6B7280";
const LINE = "#E5E7EB";
const BG = "#FFFFFF";
const SOFT = "#FFFBEB";

const fontHead = `'Bricolage Grotesque', system-ui, sans-serif`;
const fontBody = `'Plus Jakarta Sans', system-ui, sans-serif`;

const navLinks = [
  { to: "/terms", label: "Terms", icon: FileText },
  { to: "/privacy", label: "Privacy", icon: Shield },
  { to: "/refund-policy", label: "Refunds", icon: RefreshCw },
  { to: "/cookie-policy", label: "Cookies", icon: Cookie },
] as const;

export function LegalLayout({
  title,
  intro,
  lastUpdated,
  sections,
  children,
}: {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: Section[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: fontBody, fontSize: 15, lineHeight: 1.7 }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${LINE}`, background: BG, position: "sticky", top: 0, zIndex: 30, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${SUN}, ${SUN_DEEP})`, display: "grid", placeItems: "center", color: "#fff" }}>
              <Camera size={18} strokeWidth={2.4} />
            </div>
            <span style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>PhotoLancer</span>
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {navLinks.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: INK2 }}
                activeProps={{ style: { background: SOFT, color: SUN_DEEP } }}
              >
                <n.icon size={14} />
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Template warning banner */}
      <div style={{ background: SOFT, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, color: SUN_DEEP, fontSize: 13, fontWeight: 500 }}>
          <AlertTriangle size={16} />
          <span><strong>Template pending legal review.</strong> This document is a starting point and must be reviewed by a qualified Indian lawyer before launch.</span>
        </div>
      </div>

      {/* Hero */}
      <section style={{ borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 24px 40px" }}>
          <div style={{ fontFamily: fontHead, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: SUN_DEEP, marginBottom: 12, fontWeight: 600 }}>
            Legal · PhotoLancer India
          </div>
          <h1 style={{ fontFamily: fontHead, fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: INK, marginBottom: 16 }}>
            {title}
          </h1>
          <p style={{ fontSize: 17, color: INK2, maxWidth: 760, marginBottom: 16 }}>{intro}</p>
          <div style={{ fontSize: 13, color: INK3, fontFamily: fontHead, letterSpacing: "0.02em" }}>
            Last updated: <strong style={{ color: INK2 }}>{lastUpdated}</strong>
          </div>
        </div>
      </section>

      {/* Content */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 80px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 48 }} className="legal-grid">
        <aside className="legal-aside">
          <div style={{ position: "sticky", top: 96 }}>
            <div style={{ fontFamily: fontHead, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: INK3, marginBottom: 14, fontWeight: 600 }}>
              On this page
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2, borderLeft: `1px solid ${LINE}` }}>
              {sections.map((s) => {
                const isActive = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      style={{
                        display: "block",
                        padding: "7px 14px",
                        fontSize: 13.5,
                        color: isActive ? SUN_DEEP : INK3,
                        fontWeight: isActive ? 600 : 400,
                        borderLeft: isActive ? `2px solid ${SUN}` : "2px solid transparent",
                        marginLeft: -1,
                      }}
                    >
                      {s.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <main className="legal-main" style={{ maxWidth: 760 }}>
          {children}

          <div style={{ marginTop: 56, padding: 20, borderRadius: 12, background: SOFT, border: `1px solid #FDE68A`, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertTriangle size={18} color={SUN_DEEP} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, color: INK2 }}>
              <strong style={{ color: SUN_DEEP }}>Disclaimer:</strong> This document is a template prepared for the PhotoLancer platform and does not constitute legal advice. It must be reviewed and customised by a qualified lawyer admitted to practise in India before being relied upon.
            </div>
          </div>
        </main>
      </div>

      <Footer />
      <CookieBanner />

      <style>{`
        .legal-grid { grid-template-columns: 220px minmax(0, 1fr); }
        @media (max-width: 880px) { .legal-grid { grid-template-columns: minmax(0,1fr); gap: 24px; } .legal-aside { display: none; } }
        .legal-main h2 { font-family: ${fontHead}; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; color: ${INK}; margin-top: 48px; margin-bottom: 14px; scroll-margin-top: 96px; }
        .legal-main h2:first-child { margin-top: 0; }
        .legal-main h3 { font-family: ${fontHead}; font-size: 17px; font-weight: 600; color: ${INK}; margin-top: 24px; margin-bottom: 8px; }
        .legal-main p { color: ${INK2}; margin-bottom: 14px; }
        .legal-main ul, .legal-main ol { color: ${INK2}; margin: 0 0 16px 22px; padding: 0; }
        .legal-main li { margin-bottom: 6px; }
        .legal-main strong { color: ${INK}; font-weight: 600; }
        .legal-main a { color: ${SUN_DEEP}; text-decoration: underline; text-underline-offset: 2px; }
      `}</style>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, background: "#FAFAF9" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px", display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${SUN}, ${SUN_DEEP})`, display: "grid", placeItems: "center", color: "#fff" }}>
              <Camera size={16} strokeWidth={2.4} />
            </div>
            <span style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 16 }}>PhotoLancer</span>
          </div>
          <p style={{ fontSize: 13.5, color: INK3 }}>
            India's marketplace for photographers, studios, and second shooters. Bookings held in escrow, released after the event.
          </p>
        </div>
        <div>
          <div style={{ fontFamily: fontHead, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: INK3, marginBottom: 12, fontWeight: 600 }}>Legal</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {navLinks.map((n) => (
              <li key={n.to}>
                <Link to={n.to} style={{ fontSize: 13.5, color: INK2 }}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ fontSize: 12, color: INK3 }}>
          © {new Date().getFullYear()} PhotoLancer.<br />Made in India.
        </div>
      </div>
    </footer>
  );
}
