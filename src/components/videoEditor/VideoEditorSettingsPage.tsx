// Admin-only settings page: edit KPI config, daily commit target, Critical Number.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { PageHeader, FieldLabel, inputStyle } from "@/components/marketizers/ui";
import {
  getActiveConfig,
  saveConfig,
  type VeConfig,
  type VeFieldDef,
  type VeFieldType,
} from "@/services/videoEditor/videoEditorKpiService";

export default function VideoEditorSettingsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [cfg, setCfg] = useState<VeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => { document.title = "Video Editor KPI Settings | IPC | GWV Vision Center"; }, []);

  useEffect(() => {
    (async () => {
      try { setCfg(await getActiveConfig()); }
      catch (e: any) { setErr(e?.message ?? "Failed to load config"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSave() {
    if (!cfg) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      await saveConfig(cfg);
      setOk("Saved.");
    } catch (e: any) { setErr(e?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  function updateField(i: number, patch: Partial<VeFieldDef>) {
    if (!cfg) return;
    const fields = cfg.fields.slice();
    fields[i] = { ...fields[i], ...patch };
    setCfg({ ...cfg, fields });
  }

  function addField() {
    if (!cfg) return;
    setCfg({ ...cfg, fields: [...cfg.fields, { key: `field_${cfg.fields.length + 1}`, name: "New field", type: "number" }] });
  }

  function removeField(i: number) {
    if (!cfg) return;
    setCfg({ ...cfg, fields: cfg.fields.filter((_, idx) => idx !== i) });
  }

  if (!admin) {
    return <div style={{ padding: 40, color: "var(--ink3)" }}>Admin access required.</div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="IPC / Team Performance / Video Editor"
        title="Video Editor KPI Settings"
        subtitle="Admin-only. Configure the daily KPI fields, commit target, and quarterly Critical Number."
        actions={
          <Link to="/brands/ipc/team-performance/video-editor-performance">
            <button className="btn-sm">← Back</button>
          </Link>
        }
      />

      {loading && <div style={{ padding: 24 }}>Loading…</div>}
      {err && <Banner tone="bad">{err}</Banner>}
      {ok && <Banner tone="good">{ok}</Banner>}

      {cfg && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Daily fields */}
          <section className="panel" style={{ padding: 20 }}>
            <h2 style={sectionH}>Daily KPI Fields</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {cfg.fields.map((f, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 80px", gap: 10, alignItems: "end" }}>
                  <div>
                    <FieldLabel>Key</FieldLabel>
                    <input style={inputStyle} value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input style={inputStyle} value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <select style={inputStyle} value={f.type} onChange={(e) => updateField(i, { type: e.target.value as VeFieldType })}>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="text">text</option>
                      <option value="currency">currency</option>
                    </select>
                  </div>
                  <button className="btn-sm" onClick={() => removeField(i)}>Remove</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-sm" onClick={addField}>+ Add Field</button>
            </div>
          </section>

          {/* Daily commit target */}
          <section className="panel" style={{ padding: 20 }}>
            <h2 style={sectionH}>Daily Commit Target</h2>
            <div style={{ maxWidth: 200 }}>
              <FieldLabel>Pieces per day</FieldLabel>
              <input type="number" style={inputStyle} value={cfg.daily_commit_target}
                onChange={(e) => setCfg({ ...cfg, daily_commit_target: Number(e.target.value) })} />
            </div>
          </section>

          {/* Critical Number */}
          <section className="panel" style={{ padding: 20 }}>
            <h2 style={sectionH}>Quarterly Critical Number</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <FieldLabel>Label</FieldLabel>
                <input style={inputStyle} value={cfg.cn_label} onChange={(e) => setCfg({ ...cfg, cn_label: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                <div><FieldLabel>Target</FieldLabel>
                  <input type="number" style={inputStyle} value={cfg.cn_target} onChange={(e) => setCfg({ ...cfg, cn_target: Number(e.target.value) })} /></div>
                <div><FieldLabel>Super Green ≥</FieldLabel>
                  <input type="number" style={inputStyle} value={cfg.cn_super_green} onChange={(e) => setCfg({ ...cfg, cn_super_green: Number(e.target.value) })} /></div>
                <div><FieldLabel>Green ≥</FieldLabel>
                  <input type="number" style={inputStyle} value={cfg.cn_green} onChange={(e) => setCfg({ ...cfg, cn_green: Number(e.target.value) })} /></div>
                <div><FieldLabel>Red &lt;</FieldLabel>
                  <input type="number" style={inputStyle} value={cfg.cn_red} onChange={(e) => setCfg({ ...cfg, cn_red: Number(e.target.value) })} /></div>
              </div>
            </div>
          </section>

          <div>
            <button className="btn-sm" disabled={saving} onClick={handleSave}
              style={{ background: "var(--ink)", color: "var(--parchment)" }}>
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const sectionH: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 14,
};

function Banner({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  const c = tone === "good"
    ? { bg: "#ecfdf5", fg: "#059669", bd: "#a7f3d0" }
    : { bg: "#fff1f2", fg: "#9f1239", bd: "#fecdd3" };
  return (
    <div style={{ padding: "10px 14px", background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
      {children}
    </div>
  );
}
