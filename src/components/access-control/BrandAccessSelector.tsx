// @ts-nocheck
import { useBrands } from "@/hooks/useBrands";

export type SelectedBrandIds = Set<string>;

export function BrandAccessSelector({
  value, onChange,
}: { value: SelectedBrandIds; onChange: (next: SelectedBrandIds) => void }) {
  const { activeBrands, loading } = useBrands();

  if (loading) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>Loading brands…</div>;
  if (!activeBrands.length) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>No brands defined yet.</div>;

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button type="button" className="btn-sm" onClick={() => onChange(new Set(activeBrands.map((b) => b.id)))}>Select All</button>
        <button type="button" className="btn-sm" onClick={() => onChange(new Set())}>Clear</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {activeBrands.map((b) => {
          const checked = value.has(b.id);
          return (
            <label key={b.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
              background: checked ? "var(--gold-bg)" : "var(--ivory)",
              border: `1px solid ${checked ? "var(--gold-border)" : "var(--border)"}`,
              borderRadius: 7, cursor: "pointer",
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(b.id)}
                style={{ width: 16, height: 16, accentColor: "var(--gold3)" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{b.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
