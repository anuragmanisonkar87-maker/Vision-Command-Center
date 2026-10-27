// Reusable Vision Center wizard primitives.
// Used to chunk heavy forms into focused step-by-step flows.
// Design: parchment/ivory cards, gold accents, Cormorant headings, Figtree body, DM Mono labels.
import { ReactNode, useState, useCallback } from "react";

// ---------- Stepper ----------
export function WizardStepper({
  steps, current, onJump,
}: {
  steps: { key: string; label: string }[];
  current: number;
  onJump?: (idx: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex", gap: 6, overflowX: "auto", padding: "4px 2px 12px",
        scrollbarWidth: "thin",
      }}
    >
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onJump && i <= current && onJump(i)}
            disabled={!onJump || i > current}
            style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 999,
              border: `1px solid ${active ? "var(--ink)" : done ? "var(--gold-border)" : "var(--border)"}`,
              background: active ? "var(--ink)" : done ? "var(--ivory)" : "transparent",
              color: active ? "var(--parchment)" : done ? "var(--ink)" : "var(--ink4)",
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em",
              textTransform: "uppercase", cursor: onJump && i <= current ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            {i + 1}. {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Step Card ----------
export function WizardStep({
  title, description, children,
}: { title?: string; description?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--ivory)", border: "1px solid var(--border)",
        borderRadius: 10, padding: 20, display: "grid", gap: 14,
      }}
    >
      {title && (
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "var(--ink)", lineHeight: 1.2 }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 12.5, color: "var(--ink4)", marginTop: 4 }}>{description}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- Footer ----------
export function WizardFooter({
  onCancel, onPrev, onNext, onSave, nextDisabled, saveDisabled,
  saveLabel = "Save", isLast, busy, extraActions,
}: {
  onCancel?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSave?: () => void;
  nextDisabled?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  isLast?: boolean;
  busy?: boolean;
  extraActions?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, background: "var(--parchment)",
        borderTop: "1px solid var(--border)", padding: "12px 0",
        marginTop: 16, display: "flex", gap: 8, justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div>
        {onCancel && (
          <button type="button" className="btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onPrev && (
          <button type="button" className="btn-sm" onClick={onPrev} disabled={busy}>
            ← Previous
          </button>
        )}
        {extraActions}
        {!isLast && onNext && (
          <button
            type="button" className="btn-sm" onClick={onNext} disabled={busy || nextDisabled}
            style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
          >
            Next →
          </button>
        )}
        {isLast && onSave && (
          <button
            type="button" className="btn-sm" onClick={onSave} disabled={busy || saveDisabled}
            style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
          >
            {busy ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Review Summary Row ----------
export function WizardReviewRow({
  label, value, onEdit,
}: { label: string; value: ReactNode; onEdit?: () => void }) {
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 12,
        padding: "8px 0", borderBottom: "1px dashed var(--border)", alignItems: "center",
      }}
    >
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)" }}>{value || <span style={{ color: "var(--ink4)" }}>—</span>}</div>
      {onEdit && (
        <button type="button" className="btn-sm" onClick={onEdit} style={{ fontSize: 11 }}>Edit</button>
      )}
    </div>
  );
}

// ---------- Hook ----------
export function useWizard<T extends string>(steps: T[]) {
  const [current, setCurrent] = useState(0);
  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), [steps.length]);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);
  const jump = useCallback((i: number) => setCurrent(Math.max(0, Math.min(i, steps.length - 1))), [steps.length]);
  return { current, setCurrent, next, prev, jump, isFirst: current === 0, isLast: current === steps.length - 1 };
}
