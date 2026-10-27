// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { LoadingState, EmptyState } from "@/components/marketizers/ui";
import { useTeamMembers, useModules, usePositions } from "@/hooks/useAccessControl";
import { useBrands } from "@/hooks/useBrands";
import {
  getModuleAccessForMember, getBrandAccessForMember, getPositionPresets,
  type ModuleAccessRow, type BrandAccessRow, type PositionPresetRow,
} from "@/services/accessControl/accessControlService";
import { AccessStatusPill } from "./AccessStatusPill";

export function PreviewAsUser() {
  const { data: members, loading: lm } = useTeamMembers();
  const { data: modules } = useModules();
  const { data: positions } = usePositions();
  const { activeBrands } = useBrands();
  const [memberId, setMemberId] = useState("");
  const [modAccess, setModAccess] = useState<ModuleAccessRow[]>([]);
  const [brandAccess, setBrandAccess] = useState<BrandAccessRow[]>([]);
  const [presets, setPresets] = useState<PositionPresetRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) { setModAccess([]); setBrandAccess([]); setPresets([]); return; }
    const member = members.find((m) => m.id === memberId);
    setLoading(true);
    Promise.all([
      getModuleAccessForMember(memberId),
      getBrandAccessForMember(memberId),
      member?.position_id ? getPositionPresets(member.position_id) : Promise.resolve([]),
    ]).then(([ma, ba, pp]) => {
      setModAccess(ma); setBrandAccess(ba); setPresets(pp);
    }).finally(() => setLoading(false));
  }, [memberId, members]);

  const member = useMemo(() => members.find((m) => m.id === memberId), [members, memberId]);

  // Effective access = explicit module access overrides position preset.
  const effective = useMemo(() => {
    if (!member) return new Map<string, { can_view: boolean; can_view_finance: boolean; access_level: string; source: string }>();
    const map = new Map<string, any>();
    for (const p of presets) {
      map.set(p.module_id, { can_view: p.can_view, can_view_finance: p.can_view_finance, access_level: p.access_level, source: "preset" });
    }
    for (const a of modAccess) {
      if (!a.is_active) continue;
      map.set(a.module_id, { can_view: a.can_view, can_view_finance: a.can_view_finance, access_level: a.access_level, source: "explicit" });
    }
    return map;
  }, [presets, modAccess, member]);

  const visibleBrandIds = useMemo(() => new Set(brandAccess.filter((b) => b.is_active !== false && b.can_view).map((b) => b.brand_id)), [brandAccess]);

  return (
    <div>
      <div style={{ marginBottom: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)" }}>Preview as</div>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontSize: 13, minWidth: 280 }}>
          <option value="">— Select team member —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
        </select>
      </div>

      {lm ? <LoadingState rows={3} /> :
        !memberId ? (
          <EmptyState icon="👁" title="Select a member"
            message="Choose a team member to simulate what they would see in the sidebar and module hub." />
        ) : loading ? <LoadingState rows={4} /> : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 18 }}>
            {/* Member summary */}
            <div className="panel" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Member</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{member?.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 12 }}>{member?.email}</div>
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--ink3)" }}>
                <div><strong>Position:</strong> {positions.find((p) => p.id === member?.position_id)?.name ?? "—"}</div>
                <div><strong>Access Level:</strong> <AccessStatusPill tone={member?.access_level === "admin" ? "admin" : member?.access_level === "finance" ? "finance" : "yes"} label={member?.access_level} /></div>
                <div><strong>Status:</strong> <AccessStatusPill tone={member?.status === "active" ? "yes" : "neutral"} label={member?.status} /></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Visible Brands</div>
                {member?.access_level === "admin" ? (
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>All brands (admin).</div>
                ) : visibleBrandIds.size === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink4)" }}>No brand access assigned.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {activeBrands.filter((b) => visibleBrandIds.has(b.id)).map((b) => (
                      <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: b.color }} />
                        {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Module visibility */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Module Visibility</div>
              <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="attr-table" style={{ minWidth: 560 }}>
                    <thead>
                      <tr><th>Module</th><th>Brand</th><th>Visibility</th><th>Source</th></tr>
                    </thead>
                    <tbody>
                      {modules.map((m) => {
                        const isAdmin = member?.access_level === "admin";
                        const eff = effective.get(m.id);
                        const brand = m.brand_id ? activeBrands.find((b) => b.id === m.brand_id) : null;
                        const brandHidden = brand && !visibleBrandIds.has(brand.id) && !isAdmin;
                        let tone: any = "hidden", label = "Hidden";
                        if (isAdmin) { tone = "admin"; label = "Admin"; }
                        else if (brandHidden) { tone = "hidden"; label = "Brand hidden"; }
                        else if (m.sensitivity === "finance") {
                          if (eff?.can_view_finance) { tone = "finance"; label = "Finance"; }
                        } else if (eff?.can_view) {
                          tone = "yes"; label = "Visible";
                        }
                        return (
                          <tr key={m.id}>
                            <td>
                              <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{m.module_name}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4)", marginTop: 2 }}>{m.module_key}</div>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {brand ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: brand.color }} />
                                  {brand.name}
                                </span>
                              ) : <span style={{ color: "var(--ink4)" }}>Global</span>}
                            </td>
                            <td><AccessStatusPill tone={tone} label={label} /></td>
                            <td style={{ fontSize: 11, color: "var(--ink4)" }}>{isAdmin ? "admin override" : eff?.source ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
