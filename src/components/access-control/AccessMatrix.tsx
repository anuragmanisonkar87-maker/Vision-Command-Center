// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { LoadingState, EmptyState } from "@/components/marketizers/ui";
import { useTeamMembers, useModules } from "@/hooks/useAccessControl";
import { getAllModuleAccess, type ModuleAccessRow } from "@/services/accessControl/accessControlService";
import { AccessStatusPill } from "./AccessStatusPill";

export function AccessMatrix() {
  const { data: members, loading: lm } = useTeamMembers();
  const { data: modules, loading: lmod } = useModules();
  const [access, setAccess] = useState<ModuleAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setAccess(await getAllModuleAccess()); }
      finally { setLoading(false); }
    })();
  }, []);

  const accessMap = useMemo(() => {
    const map = new Map<string, ModuleAccessRow>();
    for (const a of access) map.set(`${a.team_member_id}::${a.module_id}`, a);
    return map;
  }, [access]);

  const visibleModules = useMemo(() => {
    if (!filterBrand) return modules;
    if (filterBrand === "__global") return modules.filter((m) => !m.brand_id);
    return modules.filter((m) => m.brand_id === filterBrand);
  }, [modules, filterBrand]);

  const brands = useMemo(() => {
    const set = new Map<string, string>();
    for (const m of modules) if (m.brand_id) set.set(m.brand_id, m.brand_id);
    return Array.from(set.keys());
  }, [modules]);

  if (lm || lmod || loading) return <LoadingState rows={5} />;
  if (!members.length) return <EmptyState icon="👥" title="No team members" message="Add team members in the Team Members tab." />;
  if (!visibleModules.length) return <EmptyState icon="📦" title="No modules" message="Register modules in the Module Registry tab." />;

  const renderCell = (memberId: string, moduleId: string, modSensitivity: string) => {
    const a = accessMap.get(`${memberId}::${moduleId}`);
    if (!a || !a.can_view) return <AccessStatusPill tone="hidden" />;
    if (a.access_level === "admin") return <AccessStatusPill tone="admin" />;
    if (modSensitivity === "finance") return <AccessStatusPill tone={a.can_view_finance ? "finance" : "hidden"} />;
    if (a.scope === "own") return <AccessStatusPill tone="own" />;
    return <AccessStatusPill tone="yes" />;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--ink4)" }}>
          Read-only overview. Edit access from the Team Members tab.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>Filter</span>
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontSize: 13 }}>
            <option value="">All modules</option>
            <option value="__global">Global only</option>
            {brands.map((b) => <option key={b} value={b}>Brand: {b.slice(0, 8)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "auto", maxHeight: "70vh" }}>
        <table className="attr-table" style={{ minWidth: 600 + visibleModules.length * 140 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "var(--ivory)", zIndex: 2, minWidth: 200 }}>Team Member</th>
              {visibleModules.map((m) => (
                <th key={m.id} style={{ minWidth: 140, fontSize: 11 }}>
                  <div>{m.module_name}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4)", marginTop: 2 }}>{m.module_key}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((mem) => (
              <tr key={mem.id}>
                <td style={{ position: "sticky", left: 0, background: "var(--ivory)", zIndex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{mem.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink4)" }}>{mem.email}</div>
                </td>
                {visibleModules.map((m) => (
                  <td key={m.id} style={{ textAlign: "center" }}>
                    {mem.access_level === "admin"
                      ? <AccessStatusPill tone="admin" />
                      : renderCell(mem.id, m.id, m.sensitivity)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
