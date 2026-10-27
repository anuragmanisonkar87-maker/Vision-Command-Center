import { useBrands } from "@/hooks/useBrands";

export type BrandAccessSelection = {
  brand_ids: string[];     // empty = no access
  all_brands: boolean;     // shortcut
  access_level: "viewer" | "editor" | "manager" | "finance" | "admin";
};

export function BrandAccessSelector({
  value,
  onChange,
}: {
  value: BrandAccessSelection;
  onChange: (next: BrandAccessSelection) => void;
}) {
  const { activeBrands, loading } = useBrands();

  const toggle = (brandId: string) => {
    const has = value.brand_ids.includes(brandId);
    onChange({
      ...value,
      brand_ids: has ? value.brand_ids.filter((b) => b !== brandId) : [...value.brand_ids, brandId],
      all_brands: false,
    });
  };

  if (loading) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>Loading brands…</div>;

  return (
    <div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={value.all_brands}
          onChange={(e) =>
            onChange({
              ...value,
              all_brands: e.target.checked,
              brand_ids: e.target.checked ? activeBrands.map((b) => b.id) : [],
            })
          }
        />
        All brands
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {activeBrands.map((b) => {
          const on = value.brand_ids.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              className="btn-sm"
              onClick={() => toggle(b.id)}
              style={{
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--ivory)" : "var(--ink2)",
                borderColor: on ? "var(--ink)" : "var(--border)",
                fontSize: 11,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: b.color }} />
              {on ? "✓ " : ""}{b.name}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>Access level</span>
        <select
          value={value.access_level}
          onChange={(e) => onChange({ ...value, access_level: e.target.value as any })}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--parchment)" }}
        >
          {["viewer", "editor", "manager", "finance", "admin"].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}
