// @ts-nocheck
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { inputStyle, FieldLabel } from "@/components/marketizers/ui";
import { useBrands } from "@/hooks/useBrands";
import { useMasterOptions } from "@/hooks/useAccessControl";
import { QuickSaveSelect } from "./QuickSaveSelect";
import { createModule, updateModule, type ModuleRow } from "@/services/accessControl/accessControlService";

const SENSITIVITY = ["normal", "finance", "admin"];
const ACCESS_LEVELS = ["viewer", "editor", "manager", "finance", "admin"];
const STATUSES = ["active", "draft", "paused", "archived"];

export function ModuleDrawer({
  module, onClose, onSaved,
}: { module: ModuleRow | null; onClose: () => void; onSaved: () => void }) {
  const { activeBrands } = useBrands();
  const sensitivity = useMasterOptions("module_sensitivity");
  const accessLevels = useMasterOptions("access_level");
  const statuses = useMasterOptions("module_status");

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<ModuleRow>>({
    module_name: "", module_key: "", route_path: "", description: "",
    brand_id: null, sensitivity: "normal", default_access_level: "viewer",
    module_status: "active", is_assignable: true, show_in_sidebar: false,
    show_in_module_hub: true, sort_order: 0,
  });

  useEffect(() => {
    if (module) setForm(module);
  }, [module]);

  const set = (k: keyof ModuleRow, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const slugify = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const save = async () => {
    if (!form.module_name?.trim()) { toast.error("Module name is required."); return; }
    const payload = {
      ...form,
      module_key: form.module_key?.trim() || slugify(form.module_name),
    };
    setBusy(true);
    try {
      if (module?.id) await updateModule(module.id, payload);
      else await createModule(payload);
      toast.success(module ? "Module updated." : "Module created.");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed.");
    } finally { setBusy(false); }
  };

  const sensOptions = sensitivity.data.length ? sensitivity.data : SENSITIVITY.map((v) => ({ id: v, value: v, label: v, option_type: "module_sensitivity", option_key: v, sort_order: 0, is_active: true }));
  const lvlOptions = accessLevels.data.length ? accessLevels.data : ACCESS_LEVELS.map((v) => ({ id: v, value: v, label: v, option_type: "access_level", option_key: v, sort_order: 0, is_active: true }));
  const stOptions = statuses.data.length ? statuses.data : STATUSES.map((v) => ({ id: v, value: v, label: v, option_type: "module_status", option_key: v, sort_order: 0, is_active: true }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 100vw)", height: "100vh", background: "var(--parchment)", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)" }}
      >
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">{module ? "Edit Module" : "New Module"}</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>
              {form.module_name || "Untitled module"}
            </h2>
          </div>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 26, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Module Name *</FieldLabel>
              <input style={inputStyle} value={form.module_name || ""}
                onChange={(e) => set("module_name", e.target.value)} />
            </div>
            <div>
              <FieldLabel>Module Key (slug)</FieldLabel>
              <input style={inputStyle} value={form.module_key || ""}
                placeholder={form.module_name ? slugify(form.module_name) : "auto"}
                onChange={(e) => set("module_key", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Brand</FieldLabel>
              <select style={inputStyle} value={form.brand_id || ""}
                onChange={(e) => set("brand_id", e.target.value || null)}>
                <option value="">Global (no brand)</option>
                {activeBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Route Path</FieldLabel>
              <input style={inputStyle} value={form.route_path || ""}
                placeholder="/brands/marketizers/revenue"
                onChange={(e) => set("route_path", e.target.value)} />
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Sensitivity</FieldLabel>
              <QuickSaveSelect optionType="module_sensitivity" options={sensOptions}
                value={form.sensitivity || "normal"}
                onChange={(v) => set("sensitivity", v)}
                refresh={sensitivity.refetch} />
            </div>
            <div>
              <FieldLabel>Default Access Level</FieldLabel>
              <QuickSaveSelect optionType="access_level" options={lvlOptions}
                value={form.default_access_level || "viewer"}
                onChange={(v) => set("default_access_level", v)}
                refresh={accessLevels.refetch} />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <QuickSaveSelect optionType="module_status" options={stOptions}
                value={form.module_status || "active"}
                onChange={(v) => set("module_status", v)}
                refresh={statuses.refetch} />
            </div>
          </div>

          <div>
            <FieldLabel>Visibility & Behavior</FieldLabel>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { k: "is_assignable", label: "Assignable to team members", help: "Uncheck to hide from access selectors." },
                { k: "show_in_sidebar", label: "Show in main sidebar" },
                { k: "show_in_module_hub", label: "Show in module hub / brand landing" },
              ].map((row) => (
                <label key={row.k} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer",
                }}>
                  <input type="checkbox" checked={!!form[row.k]}
                    onChange={(e) => set(row.k as any, e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--gold3)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--ink)" }}>{row.label}</div>
                    {row.help && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>{row.help}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Sort Order</FieldLabel>
              <input type="number" style={inputStyle} value={form.sort_order ?? 0}
                onChange={(e) => set("sort_order", parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border)", background: "var(--ivory)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-sm" onClick={save} disabled={busy}
            style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
            {busy ? "Saving…" : "Save Module"}
          </button>
        </div>
      </div>
    </div>
  );
}
