// @ts-nocheck
export type AccessPillTone = "yes" | "hidden" | "finance" | "admin" | "own" | "neutral";

const MAP: Record<AccessPillTone, { bg: string; fg: string; br: string; label: string }> = {
  yes:     { bg: "var(--green-bg)", fg: "var(--green)", br: "var(--green-b)", label: "Yes" },
  hidden:  { bg: "var(--parchment2)", fg: "var(--ink4)", br: "var(--border)", label: "Hidden" },
  finance: { bg: "var(--gold-bg)", fg: "var(--gold)", br: "var(--gold-border)", label: "Finance" },
  admin:   { bg: "rgba(122,101,158,.12)", fg: "#5a4685", br: "rgba(122,101,158,.3)", label: "Admin" },
  own:     { bg: "var(--amber-bg)", fg: "var(--amber)", br: "rgba(122,78,16,.22)", label: "Own Only" },
  neutral: { bg: "var(--ivory)", fg: "var(--ink3)", br: "var(--border)", label: "—" },
};

export function AccessStatusPill({ tone, label }: { tone: AccessPillTone; label?: string }) {
  const m = MAP[tone];
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 12,
      fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".1em",
      textTransform: "uppercase",
      background: m.bg, color: m.fg, border: `1px solid ${m.br}`,
    }}>{label ?? m.label}</span>
  );
}
