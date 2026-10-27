// Reusable percentage allocation editor across brands.
// Brands fetched dynamically from gwv_brands — never hardcoded.
import { useEffect, useMemo } from "react";
import { useBrands } from "@/hooks/useBrands";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import {
  validateAllocationPercentages,
  type AllocationInput,
} from "@/services/allocations/sharedExpenseAllocationService";
import { formatINR } from "@/utils/formatters/format";

export type BrandAllocationEditorProps = {
  amountInInr: number;
  value: AllocationInput[];
  onChange: (next: AllocationInput[]) => void;
  /** slug of the "current" brand (used by 100% Current Brand button) */
  currentBrandSlug?: string;
  disabled?: boolean;
};

export function BrandAllocationEditor({
  amountInInr,
  value,
  onChange,
  currentBrandSlug,
  disabled,
}: BrandAllocationEditorProps) {
  const { allocationBrands, loading } = useBrands();

  // Ensure value has a row for every allocation brand
  useEffect(() => {
    if (loading || !allocationBrands.length) return;
    const byId = new Map(value.map((v) => [v.brand_id, v]));
    const synced = allocationBrands.map((b) => byId.get(b.id) ?? { brand_id: b.id, allocation_percentage: 0 });
    if (synced.length !== value.length || synced.some((s, i) => value[i]?.brand_id !== s.brand_id)) {
      onChange(synced);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allocationBrands]);

  const totals = useMemo(() => validateAllocationPercentages(value), [value]);

  const setPct = (brand_id: string, pct: number) => {
    onChange(value.map((v) => (v.brand_id === brand_id ? { ...v, allocation_percentage: pct } : v)));
  };

  const equalAll = () => {
    const n = allocationBrands.length || 1;
    const each = +(100 / n).toFixed(2);
    onChange(allocationBrands.map((b, i) => ({
      brand_id: b.id,
      allocation_percentage: i === n - 1 ? +(100 - each * (n - 1)).toFixed(2) : each,
    })));
  };
  const equalFirst3 = () => {
    const top = allocationBrands.slice(0, 3);
    const each = +(100 / Math.max(top.length, 1)).toFixed(2);
    onChange(allocationBrands.map((b, i) => ({
      brand_id: b.id,
      allocation_percentage:
        i < top.length ? (i === top.length - 1 ? +(100 - each * (top.length - 1)).toFixed(2) : each) : 0,
    })));
  };
  const onlyCurrent = () => {
    const cur = allocationBrands.find((b) => b.slug === currentBrandSlug);
    onChange(allocationBrands.map((b) => ({
      brand_id: b.id,
      allocation_percentage: cur && b.id === cur.id ? 100 : 0,
    })));
  };
  const clear = () => onChange(allocationBrands.map((b) => ({ brand_id: b.id, allocation_percentage: 0 })));

  if (loading) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>Loading brands…</div>;
  if (!allocationBrands.length) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>No brands available for allocation.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" className="btn-sm" onClick={equalAll} disabled={disabled}>Equal All</button>
        <button type="button" className="btn-sm" onClick={equalFirst3} disabled={disabled}>Equal First 3</button>
        {currentBrandSlug && (
          <button type="button" className="btn-sm" onClick={onlyCurrent} disabled={disabled}>100% Current Brand</button>
        )}
        <button type="button" className="btn-sm" onClick={clear} disabled={disabled}>Clear</button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {allocationBrands.map((b) => {
          const row = value.find((v) => v.brand_id === b.id);
          const pct = Number(row?.allocation_percentage || 0);
          const amt = +(amountInInr * pct / 100).toFixed(2);
          return (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 130px", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                {b.name}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={pct}
                  disabled={disabled}
                  onChange={(e) => setPct(b.id, Math.min(100, Math.max(0, Number(e.target.value || 0))))}
                  style={{ ...inputStyle, paddingRight: 26 }}
                />
                <span style={{ position: "absolute", right: 10, top: 9, fontSize: 11, color: "var(--ink4)" }}>%</span>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--ink3)", textAlign: "right" }}>
                {formatINR(amt)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 12, padding: "8px 12px", borderRadius: 6,
        background: totals.ok ? "rgba(45,106,79,.10)" : "rgba(139,32,32,.10)",
        color: totals.ok ? "var(--green)" : "var(--red)",
        fontFamily: "'DM Mono',monospace", fontSize: 11.5, display: "flex", justifyContent: "space-between",
      }}>
        <span>TOTAL ALLOCATION</span>
        <span>{totals.total.toFixed(2)}% {totals.ok ? "✓" : "(must equal 100%)"}</span>
      </div>
    </div>
  );
}
