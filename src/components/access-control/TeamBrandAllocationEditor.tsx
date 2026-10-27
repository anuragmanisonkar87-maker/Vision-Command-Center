// Brand allocation editor — split a team member's monthly cost across brands.
// Sum must be ≤ 100%. Shows live total + warning chip.
import { useMemo } from "react";
import { useBrands } from "@/hooks/useBrands";
import type { BrandAllocation } from "@/services/accessControl/teamCompensationService";
import { inputStyle } from "@/components/marketizers/ui";

export function TeamBrandAllocationEditor({
  value,
  onChange,
}: {
  value: BrandAllocation[];
  onChange: (rows: BrandAllocation[]) => void;
}) {
  const { allocationBrands } = useBrands();

  const byBrand = useMemo(() => {
    const m = new Map<string, BrandAllocation>();
    for (const r of value) m.set(r.brand_id, r);
    return m;
  }, [value]);

  const total = value.reduce((s, r) => s + (Number(r.percentage) || 0), 0);

  const update = (brandId: string, pct: number) => {
    const next = allocationBrands
      .map((b) => {
        const existing = byBrand.get(b.id);
        if (b.id === brandId) {
          return { team_member_id: "", brand_id: b.id, percentage: pct } as BrandAllocation;
        }
        return existing ?? null;
      })
      .filter((r): r is BrandAllocation => !!r && Number(r.percentage) > 0);
    onChange(next);
  };

  if (!allocationBrands.length) {
    return <div style={{ fontSize: 12, color: "var(--ink4)" }}>No brands configured for cost allocation.</div>;
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 8 }}>
        {allocationBrands.map((b) => {
          const row = byBrand.get(b.id);
          return (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: b.color || "#C9973A" }} />
                {b.name}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={row?.percentage ?? ""}
                  onChange={(e) => update(b.id, Number(e.target.value) || 0)}
                  style={{ ...inputStyle, paddingRight: 28, textAlign: "right" }}
                  placeholder="0"
                />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--ink4)" }}>%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderRadius: 6,
          background: total > 100 ? "rgba(220,60,60,.08)" : total === 100 ? "rgba(80,150,80,.08)" : "var(--ivory)",
          border: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--ink3)", fontFamily: "'DM Mono',monospace", letterSpacing: ".1em", textTransform: "uppercase" }}>
          Total Allocation
        </span>
        <strong style={{ fontFamily: "'DM Mono',monospace", color: total > 100 ? "var(--danger,#c0392b)" : "var(--ink)" }}>
          {total.toFixed(2)}%
        </strong>
      </div>
      {total > 100 && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--danger,#c0392b)" }}>
          Over 100%. Reduce the percentages before saving.
        </div>
      )}
    </div>
  );
}
