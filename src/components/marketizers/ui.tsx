// Small shared building blocks for the Marketizers revenue module.
// Reuses the existing Design B tokens — no new design system.

import type { CSSProperties } from "react";
import type { HealthStatus } from "@/lib/marketizersFinanceUtils";

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28, paddingBottom: 22, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(28px,2.6vw,40px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-.02em", marginBottom: subtitle ? 8 : 0 }}>
          {title}
        </h1>
        {subtitle && <p style={{ fontSize: 13.5, color: "var(--ink3)", maxWidth: 540, lineHeight: 1.6 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function MetricCard({
  accent, label, value, delta, deltaTone = "na", helper, emphasis = false,
}: {
  accent: "gold" | "green" | "amber" | "red";
  label: string; value: string; delta?: string;
  deltaTone?: "up" | "dn" | "na";
  helper?: string;
  /** Stronger tinted background + thicker accent bar (use for Net Profit) */
  emphasis?: boolean;
}) {
  const accentColor = { gold: "var(--gold3)", green: "var(--green)", amber: "var(--amber)", red: "var(--red)" }[accent];
  const tintBg = { gold: "var(--gold-bg)", green: "var(--green-bg)", amber: "var(--amber-bg)", red: "var(--red-bg)" }[accent];
  const tintBorder = { gold: "var(--gold-border)", green: "var(--green-b)", amber: "rgba(122,78,16,.22)", red: "rgba(139,32,32,.2)" }[accent];
  const tone = { up: "var(--green)", dn: "var(--red)", na: "var(--ink4)" }[deltaTone];
  return (
    <div style={{
      background: emphasis ? tintBg : "var(--ivory)",
      border: `1px solid ${emphasis ? tintBorder : "var(--border)"}`,
      borderRadius: 10, padding: "22px 22px 20px", position: "relative", overflow: "hidden",
      boxShadow: emphasis ? "0 1px 0 rgba(0,0,0,.02), 0 6px 18px -12px rgba(0,0,0,.18)" : "none",
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 8 }}>{label}</div>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: emphasis ? "clamp(28px,3vw,40px)" : "clamp(22px,2.4vw,32px)",
        fontWeight: 700,
        color: emphasis ? accentColor : "var(--ink)",
        lineHeight: 1, marginBottom: 7, letterSpacing: "-.02em",
      }}>{value}</div>
      {delta && <div style={{ fontSize: 11.5, color: tone }}>{delta}</div>}
      {helper && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 4, fontStyle: "italic" }}>{helper}</div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: emphasis ? 5 : 3, background: accentColor }} />
    </div>
  );
}

export function HealthPill({ status }: { status: HealthStatus }) {
  const map: Record<HealthStatus, { cls: string; label: string }> = {
    Healthy: { cls: "sp-profit", label: "Healthy" },
    Watch: { cls: "sp-warn", label: "Watch" },
    "Loss-making": { cls: "sp-loss", label: "Loss-making" },
    "Payment Pending": { cls: "sp-warn", label: "Payment Pending" },
    Inactive: { cls: "sp-warn", label: "Inactive" },
  };
  return <span className={`status-pill ${map[status].cls}`}>{map[status].label}</span>;
}

export const inputStyle: CSSProperties = {
  width: "100%", padding: "9px 11px",
  border: "1px solid var(--border)", borderRadius: 6,
  background: "var(--parchment)", fontFamily: "'Figtree',sans-serif",
  fontSize: 13, color: "var(--ink)", outline: "none",
};

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink2)", marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon = "📊", title, message, action,
}: { icon?: string; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="panel" style={{ textAlign: "center", padding: "56px 32px" }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 18, maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>{message}</p>
      {action}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ marginBottom: 18, padding: "11px 16px", background: "var(--red-bg)", border: "1px solid rgba(139,32,32,.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, color: "var(--red)", fontSize: 12.5 }}>
      <span>{message}</span>
      {onRetry && <button className="btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function SkeletonRow({ height = 18, width = "100%" }: { height?: number; width?: string | number }) {
  return <div style={{ height, width, background: "var(--parchment2)", borderRadius: 4, animation: "pulse-soft 1.4s ease-in-out infinite" }} />;
}

// Horizontal scroll wrapper for wide tables on small screens.
// Keeps the table layout intact; just lets it scroll on phones/tablets.
export function ScrollableTable({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -26px", padding: "0 26px" }}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

// Standardized loading state with skeleton rows.
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: "20px 0", display: "grid", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} height={20} />)}
    </div>
  );
}

// Mobile record card — stacked label/value pairs as a card.
export type RecordField = { label: string; value: React.ReactNode; mono?: boolean };
export function MobileRecordCard({
  title, subtitle, fields, actions,
}: { title: React.ReactNode; subtitle?: React.ReactNode; fields: RecordField[]; actions?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: actions ? 12 : 0 }}>
        {fields.map((f, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", fontFamily: f.mono ? "'DM Mono',monospace" : undefined }}>{f.value}</div>
          </div>
        ))}
      </div>
      {actions && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--parchment2)" }}>{actions}</div>}
    </div>
  );
}

// Tiny hook: true when viewport is below the given breakpoint (default 720px).
import { useEffect as _useEffect, useState as _useState } from "react";
export function useIsNarrow(breakpoint = 720) {
  const [narrow, setNarrow] = _useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < breakpoint
  );
  _useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => setNarrow(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return narrow;
}
