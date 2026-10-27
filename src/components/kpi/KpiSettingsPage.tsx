// Admin: per-position KPI configuration (generic).
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  listConfigs, upsertConfig, deleteConfig, listDefinitions, upsertDefinition, deleteDefinition, listPositions,
  type KpiPositionConfig, type KpiDefinition, type KpiType, type KpiDirection, type GoodDayRule,
} from "@/services/kpi/kpiService";

const box: React.CSSProperties = { border: "1px solid var(--edge)", borderRadius: 10, padding: 16, background: "var(--panel)" };
const inp: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--edge)", background: "var(--panel-2)", color: "var(--ink)", fontSize: 13, width: "100%" };
const btn: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--edge)", background: "var(--panel-2)", color: "var(--ink)", fontSize: 13, cursor: "pointer" };
const btnPri: React.CSSProperties = { ...btn, background: "var(--brand)", color: "white", border: "1px solid var(--brand)" };

export default function KpiSettingsPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [configs, setConfigs] = useState<Array<KpiPositionConfig & { position_name: string | null }>>([]);
  const [defs, setDefs] = useState<Record<string, KpiDefinition[]>>({});
  const [selPos, setSelPos] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "KPI Settings | GWV Vision Center"; }, []);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const [pos, cfgs] = await Promise.all([listPositions(), listConfigs()]);
      setPositions(pos); setConfigs(cfgs);
      const map: Record<string, KpiDefinition[]> = {};
      await Promise.all(cfgs.map(async (c) => { map[c.id] = await listDefinitions(c.id); }));
      setDefs(map);
    } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  const positionsWithoutConfig = useMemo(() => {
    const used = new Set(configs.map((c) => c.position_id));
    return positions.filter((p) => !used.has(p.id));
  }, [positions, configs]);

  async function addConfig() {
    if (!selPos || !user?.id) return;
    try {
      await upsertConfig(selPos, { daily_commit_target: 1, is_active: true, good_day_rule: { min_ship_ratio: 1, require_quality_gate: true, required_kpis: [] } }, user.id);
      setSelPos(""); setOk("Config created."); await reload();
    } catch (e: any) { setErr(e?.message ?? "Failed to create"); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>KPI Settings</h1>
      <p style={{ color: "var(--ink4)", fontSize: 13, marginBottom: 16 }}>
        Configure KPIs, Critical Number and daily commit target per position. Employees see only their own position's KPIs.
      </p>
      {err && <div style={{ ...box, borderColor: "#c00", color: "#c00", marginBottom: 12 }}>{err}</div>}
      {ok && <div style={{ ...box, borderColor: "#0a0", color: "#0a0", marginBottom: 12 }}>{ok}</div>}

      <div style={{ ...box, marginBottom: 16, display: "flex", gap: 8, alignItems: "end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 4 }}>Add config for position</div>
          <select style={inp} value={selPos} onChange={(e) => setSelPos(e.target.value)}>
            <option value="">Select position…</option>
            {positionsWithoutConfig.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button style={btnPri} onClick={addConfig} disabled={!selPos}>Create config</button>
      </div>

      {loading ? <div>Loading…</div> : configs.length === 0 ? (
        <div style={{ ...box, color: "var(--ink4)" }}>No KPI configs yet. Pick a position above to create the first one.</div>
      ) : configs.map((cfg) => (
        <ConfigEditor
          key={cfg.id}
          config={cfg}
          definitions={defs[cfg.id] ?? []}
          onChanged={reload}
          onError={setErr}
          onOk={setOk}
          userId={user?.id ?? ""}
        />
      ))}
    </div>
  );
}

function ConfigEditor(props: {
  config: KpiPositionConfig & { position_name: string | null };
  definitions: KpiDefinition[];
  onChanged: () => void | Promise<void>;
  onError: (s: string | null) => void;
  onOk: (s: string | null) => void;
  userId: string;
}) {
  const { config, definitions, onChanged, onError, onOk, userId } = props;
  const [draft, setDraft] = useState<KpiPositionConfig>(config);
  const rule: GoodDayRule = draft.good_day_rule || {};

  useEffect(() => { setDraft(config); }, [config.id]);

  async function saveCfg() {
    onError(null); onOk(null);
    try {
      await upsertConfig(draft.position_id, {
        critical_number: draft.critical_number,
        critical_number_target: draft.critical_number_target,
        critical_number_unit: draft.critical_number_unit,
        quarter_label: draft.quarter_label,
        daily_commit_target: draft.daily_commit_target,
        good_day_rule: draft.good_day_rule,
        is_active: draft.is_active,
      }, userId);
      onOk("Saved."); await onChanged();
    } catch (e: any) { onError(e?.message ?? "Save failed"); }
  }
  async function removeCfg() {
    if (!confirm(`Delete KPI config for ${config.position_name}? This deletes all its KPI definitions too.`)) return;
    try { await deleteConfig(config.id); onOk("Deleted."); await onChanged(); }
    catch (e: any) { onError(e?.message ?? "Delete failed"); }
  }

  return (
    <div style={{ ...box, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{config.position_name ?? "(no position)"}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Active
          </label>
          <button style={btnPri} onClick={saveCfg}>Save</button>
          <button style={{ ...btn, color: "#c00" }} onClick={removeCfg}>Delete</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="Critical Number (the main thing)">
          <input style={inp} value={draft.critical_number ?? ""} onChange={(e) => setDraft({ ...draft, critical_number: e.target.value })} />
        </Field>
        <Field label="Quarter">
          <input style={inp} value={draft.quarter_label ?? ""} onChange={(e) => setDraft({ ...draft, quarter_label: e.target.value })} placeholder="Q3 2026" />
        </Field>
        <Field label="CN target">
          <input style={inp} type="number" value={draft.critical_number_target ?? ""} onChange={(e) => setDraft({ ...draft, critical_number_target: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="CN unit">
          <input style={inp} value={draft.critical_number_unit ?? ""} onChange={(e) => setDraft({ ...draft, critical_number_unit: e.target.value })} placeholder="pieces, leads…" />
        </Field>
        <Field label="Daily commit target (default)">
          <input style={inp} type="number" value={draft.daily_commit_target} onChange={(e) => setDraft({ ...draft, daily_commit_target: Number(e.target.value) || 0 })} />
        </Field>
      </div>

      <div style={{ ...box, background: "var(--panel-2)", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Good-day rule</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Min ship ratio (shipped / committed)">
            <input style={inp} type="number" step="0.1" value={rule.min_ship_ratio ?? 1} onChange={(e) => setDraft({ ...draft, good_day_rule: { ...rule, min_ship_ratio: Number(e.target.value) } })} />
          </Field>
          <Field label="Require quality gate?">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={rule.require_quality_gate !== false} onChange={(e) => setDraft({ ...draft, good_day_rule: { ...rule, require_quality_gate: e.target.checked } })} />
              Quality gate must pass for a good day
            </label>
          </Field>
        </div>
      </div>

      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>KPIs ({definitions.length})</div>
        <button style={btn} onClick={async () => {
          const k = prompt("KPI key (slug, e.g. 'shots_delivered'):"); if (!k) return;
          const label = prompt("KPI label:") ?? k;
          try { await upsertDefinition({ config_id: config.id, kpi_key: k, label, kpi_type: "number" as KpiType, direction: "higher_better" as KpiDirection, is_quality_gate: false, weight: 1, sort_order: definitions.length }); onOk("KPI added."); await onChanged(); }
          catch (e: any) { onError(e?.message ?? "Add failed"); }
        }}>+ Add KPI</button>
      </div>

      {definitions.length === 0 ? (
        <div style={{ color: "var(--ink4)", fontSize: 13 }}>No KPIs yet.</div>
      ) : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink4)" }}>
              <th>Key</th><th>Label</th><th>Type</th><th>Target</th><th>Dir</th><th>Q-gate</th><th>Active</th><th>Order</th><th></th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((d) => (
              <DefRow key={d.id} def={d} onChanged={onChanged} onError={onError} onOk={onOk} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DefRow({ def, onChanged, onError, onOk }: { def: KpiDefinition; onChanged: () => void | Promise<void>; onError: (s: string | null) => void; onOk: (s: string | null) => void }) {
  const [d, setD] = useState(def);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setD(def); setDirty(false); }, [def.id]);
  function upd(patch: Partial<KpiDefinition>) { setD({ ...d, ...patch }); setDirty(true); }
  async function save() {
    try { await upsertDefinition({ ...d }); setDirty(false); onOk("KPI saved."); await onChanged(); }
    catch (e: any) { onError(e?.message ?? "Save failed"); }
  }
  async function remove() {
    if (!confirm(`Delete KPI '${d.label}'?`)) return;
    try { await deleteDefinition(d.id); onOk("KPI deleted."); await onChanged(); }
    catch (e: any) { onError(e?.message ?? "Delete failed"); }
  }
  return (
    <tr style={{ borderTop: "1px solid var(--edge)" }}>
      <td style={{ padding: "6px 4px" }}><code style={{ fontSize: 12 }}>{d.kpi_key}</code></td>
      <td><input style={inp} value={d.label} onChange={(e) => upd({ label: e.target.value })} /></td>
      <td>
        <select style={inp} value={d.kpi_type} onChange={(e) => upd({ kpi_type: e.target.value as KpiType })}>
          <option value="number">number</option><option value="boolean">boolean</option>
          <option value="commit_ship">commit_ship</option><option value="quality_gate">quality_gate</option>
        </select>
      </td>
      <td><input style={inp} type="number" value={d.target ?? ""} onChange={(e) => upd({ target: e.target.value ? Number(e.target.value) : null })} /></td>
      <td>
        <select style={inp} value={d.direction} onChange={(e) => upd({ direction: e.target.value as KpiDirection })}>
          <option value="higher_better">↑</option><option value="lower_better">↓</option>
        </select>
      </td>
      <td style={{ textAlign: "center" }}><input type="checkbox" checked={d.is_quality_gate} onChange={(e) => upd({ is_quality_gate: e.target.checked })} /></td>
      <td style={{ textAlign: "center" }}><input type="checkbox" checked={d.is_active} onChange={(e) => upd({ is_active: e.target.checked })} /></td>
      <td style={{ width: 60 }}><input style={inp} type="number" value={d.sort_order} onChange={(e) => upd({ sort_order: Number(e.target.value) || 0 })} /></td>
      <td style={{ display: "flex", gap: 4 }}>
        {dirty && <button style={btnPri} onClick={save}>Save</button>}
        <button style={{ ...btn, color: "#c00" }} onClick={remove}>×</button>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
