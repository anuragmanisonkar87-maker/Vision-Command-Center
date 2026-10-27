// @ts-nocheck
import { useMemo } from "react";
import { useBrands } from "@/hooks/useBrands";
import { useModules } from "@/hooks/useAccessControl";

export type SelectedModuleIds = Set<string>;

export function ModuleAccessSelector({
  value, onChange, restrictToBrandIds,
}: {
  value: SelectedModuleIds;
  onChange: (next: SelectedModuleIds) => void;
  restrictToBrandIds?: Set<string>;
}) {
  const { data: modules, loading } = useModules();
  const { activeBrands } = useBrands();

  const grouped = useMemo(() => {
    const filtered = restrictToBrandIds && restrictToBrandIds.size
      ? modules.filter((m) => !m.brand_id || restrictToBrandIds.has(m.brand_id))
      : modules;
    const map = new Map<string, typeof modules>();
    for (const m of filtered) {
      const k = m.brand_id || "__global";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return Array.from(map.entries());
  }, [modules, restrictToBrandIds]);

  if (loading) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>Loading modules…</div>;
  if (!modules.length) return <div style={{ fontSize: 12, color: "var(--ink4)" }}>No modules registered yet. Register them in the Module Registry tab (Phase 2).</div>;

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button type="button" className="btn-sm" onClick={() => {
          const all = new Set(modules.filter((m) => m.is_assignable).map((m) => m.id));
          onChange(all);
        }}>Select All</button>
        <button type="button" className="btn-sm" onClick={() => onChange(new Set())}>Clear</button>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {grouped.map(([brandId, mods]) => {
          const brand = activeBrands.find((b) => b.id === brandId);
          return (
            <div key={brandId}>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em",
                textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6,
              }}>
                {brand?.name ?? "Global"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 6 }}>
                {mods.map((m) => {
                  const checked = value.has(m.id);
                  const isFinance = m.sensitivity === "finance";
                  return (
                    <label key={m.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 10px",
                      background: checked ? "var(--gold-bg)" : "var(--ivory)",
                      border: `1px solid ${checked ? "var(--gold-border)" : "var(--border)"}`,
                      borderRadius: 6, cursor: "pointer", minHeight: 44,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(m.id)}
                        disabled={!m.is_assignable}
                        style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--gold3)", flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{m.module_name}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4)", marginTop: 2, letterSpacing: ".05em" }}>
                          {m.module_key}{isFinance && " · finance"}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
