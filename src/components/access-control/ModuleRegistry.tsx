// @ts-nocheck
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@/components/marketizers/ui";
import { useModules } from "@/hooks/useAccessControl";
import { useBrands } from "@/hooks/useBrands";
import { softDeleteModule, type ModuleRow } from "@/services/accessControl/accessControlService";
import { AccessStatusPill } from "./AccessStatusPill";
import { ModuleDrawer } from "./ModuleDrawer";

export function ModuleRegistry() {
  const { data: modules, loading, refetch } = useModules();
  const { activeBrands } = useBrands();
  const [drawer, setDrawer] = useState<{ open: boolean; module: ModuleRow | null }>({ open: false, module: null });
  const [filterBrand, setFilterBrand] = useState<string>("");

  const brandMap = useMemo(() => Object.fromEntries(activeBrands.map((b) => [b.id, b])), [activeBrands]);

  const filtered = useMemo(() => {
    if (!filterBrand) return modules;
    if (filterBrand === "__global") return modules.filter((m) => !m.brand_id);
    return modules.filter((m) => m.brand_id === filterBrand);
  }, [modules, filterBrand]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>Brand</span>
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontSize: 13 }}>
            <option value="">All brands</option>
            <option value="__global">Global only</option>
            {activeBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button className="btn-sm" onClick={() => setDrawer({ open: true, module: null })}
          style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
          + Add Module
        </button>
      </div>

      {loading ? <LoadingState rows={5} /> :
        filtered.length === 0 ? (
          <EmptyState icon="📦" title="No modules registered"
            message="Modules represent the pages and tools users can be granted access to."
            action={<button className="btn-sm" onClick={() => setDrawer({ open: true, module: null })}
              style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>+ Add Module</button>}
          />
        ) : (
          <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="attr-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Module</th><th>Brand</th><th>Sensitivity</th>
                    <th>Default Level</th><th>Status</th><th>Visibility</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const brand = m.brand_id ? brandMap[m.brand_id] : null;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{m.module_name}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)", marginTop: 2 }}>
                            {m.module_key}{m.route_path ? ` · ${m.route_path}` : ""}
                          </div>
                        </td>
                        <td>
                          {brand ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: brand.color }} />
                              {brand.name}
                            </span>
                          ) : <span style={{ color: "var(--ink4)" }}>Global</span>}
                        </td>
                        <td>
                          <AccessStatusPill
                            tone={m.sensitivity === "finance" ? "finance" : m.sensitivity === "admin" ? "admin" : "neutral"}
                            label={m.sensitivity}
                          />
                        </td>
                        <td style={{ fontSize: 12 }}>{m.default_access_level}</td>
                        <td>
                          <AccessStatusPill
                            tone={m.module_status === "active" ? "yes" : "neutral"}
                            label={m.module_status}
                          />
                        </td>
                        <td style={{ fontSize: 11, color: "var(--ink4)" }}>
                          {[m.is_assignable && "assignable", m.show_in_sidebar && "sidebar", m.show_in_module_hub && "hub"].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-sm" onClick={() => setDrawer({ open: true, module: m })}>Edit</button>{" "}
                          <button className="btn-sm" style={{ color: "var(--red)" }}
                            onClick={async () => {
                              if (!confirm(`Archive module "${m.module_name}"?`)) return;
                              await softDeleteModule(m.id);
                              toast.success("Archived.");
                              refetch();
                            }}>Archive</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {drawer.open && (
        <ModuleDrawer module={drawer.module} onClose={() => setDrawer({ open: false, module: null })}
          onSaved={() => refetch()} />
      )}
    </div>
  );
}
