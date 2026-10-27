// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { inputStyle, FieldLabel } from "@/components/marketizers/ui";
import { useModules } from "@/hooks/useAccessControl";
import { useBrands } from "@/hooks/useBrands";
import {
  createPosition, updatePosition, getPositionPresets, savePositionPresets,
  type Position, type PositionPresetRow,
} from "@/services/accessControl/accessControlService";

const ACCESS_LEVELS = ["viewer", "editor", "manager", "finance", "admin"];

type EditableRow = PositionPresetRow & { module_name: string; module_key: string; sensitivity: string };

export function PositionPresetDrawer({
  position, onClose, onSaved,
}: { position: Position | null; onClose: () => void; onSaved: () => void }) {
  const { data: modules } = useModules();
  const { activeBrands } = useBrands();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<Position>>({
    name: "", slug: "", description: "", default_access_level: "viewer", status: "active", sort_order: 0,
  });
  const [rows, setRows] = useState<Map<string, PositionPresetRow>>(new Map());

  useEffect(() => {
    if (position) {
      setForm(position);
      void getPositionPresets(position.id).then((data) => {
        setRows(new Map(data.map((r) => [r.module_id, r])));
      });
    } else {
      setForm({ name: "", slug: "", description: "", default_access_level: "viewer", status: "active", sort_order: 0 });
      setRows(new Map());
    }
  }, [position]);

  const editable: EditableRow[] = useMemo(() =>
    modules.filter((m) => m.is_assignable).map((m) => {
      const existing = rows.get(m.id);
      return {
        module_id: m.id,
        position_id: position?.id || "",
        brand_id: m.brand_id,
        access_level: existing?.access_level ?? form.default_access_level ?? "viewer",
        scope: existing?.scope ?? "assigned",
        can_view: existing?.can_view ?? false,
        can_create: existing?.can_create ?? false,
        can_edit: existing?.can_edit ?? false,
        can_delete: existing?.can_delete ?? false,
        can_export: existing?.can_export ?? false,
        can_manage: existing?.can_manage ?? false,
        can_view_finance: existing?.can_view_finance ?? false,
        module_name: m.module_name,
        module_key: m.module_key,
        sensitivity: m.sensitivity,
      };
    }), [modules, rows, position, form.default_access_level]);

  const setRow = (moduleId: string, patch: Partial<PositionPresetRow>) => {
    setRows((prev) => {
      const next = new Map(prev);
      const cur = next.get(moduleId) ?? editable.find((e) => e.module_id === moduleId)!;
      next.set(moduleId, { ...cur, ...patch });
      return next;
    });
  };

  const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const save = async () => {
    if (!form.name?.trim()) { toast.error("Position name is required."); return; }
    setBusy(true);
    try {
      const payload = { ...form, slug: form.slug?.trim() || slugify(form.name) };
      const saved = position?.id
        ? await updatePosition(position.id, payload)
        : await createPosition(payload);
      const toSave = Array.from(rows.values())
        .filter((r) => r.can_view || r.can_create || r.can_edit || r.can_delete || r.can_export || r.can_manage || r.can_view_finance)
        .map((r) => ({ ...r, position_id: saved.id }));
      await savePositionPresets(saved.id, toSave);
      toast.success(position ? "Preset updated." : "Preset created.");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed.");
    } finally { setBusy(false); }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, EditableRow[]>();
    for (const r of editable) {
      const k = r.brand_id || "__global";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries());
  }, [editable]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(880px, 100vw)", height: "100vh", background: "var(--parchment)", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)" }}>
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">{position ? "Edit Position Preset" : "New Position Preset"}</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>
              {form.name || "Untitled position"}
            </h2>
          </div>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 26, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Position Name *</FieldLabel>
              <input style={inputStyle} value={form.name || ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Slug</FieldLabel>
              <input style={inputStyle} value={form.slug || ""} placeholder={form.name ? slugify(form.name) : "auto"}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Default Access Level</FieldLabel>
              <select style={inputStyle} value={form.default_access_level || "viewer"}
                onChange={(e) => setForm((f) => ({ ...f, default_access_level: e.target.value }))}>
                {ACCESS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <FieldLabel>Module Permissions</FieldLabel>
            <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 10 }}>
              These defaults are applied when a team member is assigned this position. Individual overrides on the team member always win.
            </div>

            {grouped.length === 0 && <div style={{ fontSize: 12, color: "var(--ink4)" }}>No assignable modules. Register modules first.</div>}

            {grouped.map(([brandId, mods]) => {
              const brand = activeBrands.find((b) => b.id === brandId);
              return (
                <div key={brandId} style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>
                    {brand?.name ?? "Global"}
                  </div>
                  <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table className="attr-table" style={{ minWidth: 720 }}>
                        <thead>
                          <tr>
                            <th>Module</th><th>View</th><th>Create</th><th>Edit</th>
                            <th>Delete</th><th>Export</th><th>Finance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mods.map((r) => (
                            <tr key={r.module_id}>
                              <td>
                                <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{r.module_name}</div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4)", marginTop: 2 }}>
                                  {r.module_key}{r.sensitivity === "finance" && " · finance"}
                                </div>
                              </td>
                              {(["can_view", "can_create", "can_edit", "can_delete", "can_export", "can_view_finance"] as const).map((k) => (
                                <td key={k} style={{ textAlign: "center" }}>
                                  <input type="checkbox" checked={!!r[k]}
                                    disabled={k === "can_view_finance" && r.sensitivity !== "finance"}
                                    onChange={(e) => setRow(r.module_id, { [k]: e.target.checked } as any)}
                                    style={{ width: 16, height: 16, accentColor: "var(--gold3)" }} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border)", background: "var(--ivory)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-sm" onClick={save} disabled={busy}
            style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
            {busy ? "Saving…" : "Save Preset"}
          </button>
        </div>
      </div>
    </div>
  );
}
