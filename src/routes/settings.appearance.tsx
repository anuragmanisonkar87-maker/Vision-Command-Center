import { createFileRoute } from "@tanstack/react-router";
import { THEME_LIST, type ThemeDef } from "@/lib/theme/themes";
import { applyTheme, useTheme } from "@/lib/theme/useTheme";
import { useRef } from "react";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearancePage,
});

function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const previewRevertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePreview = (key: ThemeDef["key"]) => {
    applyTheme(key);
    if (previewRevertRef.current) clearTimeout(previewRevertRef.current);
    previewRevertRef.current = setTimeout(() => applyTheme(theme), 4000);
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Appearance</div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700,
          color: "var(--ink)", letterSpacing: "-.01em", marginBottom: 6,
        }}>
          Theme & Branding
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--ink3)", maxWidth: 620, lineHeight: 1.6 }}>
          Choose how Vision Center looks for you. Themes change colors only —
          your data, permissions, and workflows are untouched. Preference is
          saved on this browser.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
        gap: 18,
      }}>
        {THEME_LIST.map((t) => (
          <ThemeCard
            key={t.key}
            theme={t}
            active={t.key === theme}
            onApply={() => setTheme(t.key)}
            onPreview={() => handlePreview(t.key)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  theme, active, onApply, onPreview,
}: {
  theme: ThemeDef;
  active: boolean;
  onApply: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="panel" style={{
      padding: 18,
      border: active ? "1.5px solid var(--gold3)" : "1px solid var(--border)",
      boxShadow: active ? "0 6px 24px rgba(0,0,0,.06)" : undefined,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 700,
            color: "var(--ink)", marginBottom: 4,
          }}>
            {theme.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.5 }}>
            {theme.description}
          </div>
        </div>
        {active && (
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".1em",
            textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
            background: "var(--gold-bg)", color: "var(--gold)", border: "1px solid var(--gold-border)",
            whiteSpace: "nowrap",
          }}>Active</span>
        )}
      </div>

      {/* swatches */}
      <div style={{ display: "flex", gap: 6, height: 38 }}>
        {theme.swatches.map((c, i) => (
          <div key={i} style={{
            flex: 1, background: c, borderRadius: 6,
            border: "1px solid rgba(0,0,0,.08)",
          }} />
        ))}
      </div>

      {/* sample preview */}
      <div style={{
        padding: "10px 12px", borderRadius: 7,
        background: theme.vars["--parchment"] ?? "var(--parchment)",
        border: `1px solid ${theme.vars["--border"] ?? "var(--border)"}`,
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700,
          color: theme.vars["--ink"] ?? "var(--ink)",
        }}>The quick brown fox</div>
        <div style={{
          fontSize: 11, color: theme.vars["--ink3"] ?? "var(--ink3)", marginTop: 2,
        }}>
          Sample body text
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".08em",
            padding: "3px 8px", borderRadius: 4,
            background: theme.vars["--gold3"] ?? "var(--gold3)",
            color: theme.vars["--ivory"] ?? "var(--ivory)",
          }}>BUTTON</span>
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".08em",
            padding: "3px 8px", borderRadius: 4,
            background: theme.vars["--gold-bg"] ?? "var(--gold-bg)",
            color: theme.vars["--gold"] ?? "var(--gold)",
            border: `1px solid ${theme.vars["--gold-border"] ?? "var(--gold-border)"}`,
          }}>PILL</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button className="btn-sm" onClick={onPreview} title="Preview for 4 seconds">
          Preview
        </button>
        <button
          className="btn-sm btn-primary"
          onClick={onApply}
          disabled={active}
          style={{ flex: 1, opacity: active ? 0.55 : 1, cursor: active ? "default" : "pointer" }}
        >
          {active ? "Applied" : "Apply Theme"}
        </button>
      </div>
    </div>
  );
}
