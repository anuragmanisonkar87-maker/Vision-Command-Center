// QuickSave dropdown — supports adding new master option values inline.
import { useEffect, useState } from "react";
import { inputStyle, FieldLabel } from "@/components/marketizers/ui";
import { createExpenseMasterOption, getExpenseMasterOptions, type MasterOption } from "@/services/marketizers/expensesService";

export function QuickSaveSelect({
  label, optionType, value, onChange, required, placeholder,
}: {
  label: string;
  optionType: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<MasterOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try { setOptions(await getExpenseMasterOptions(optionType)); }
    catch (e: any) { setErr(e?.message ?? "Failed to load options"); }
  };
  useEffect(() => { void load(); }, [optionType]);

  const add = async () => {
    if (!newVal.trim()) return;
    setBusy(true); setErr(null);
    try {
      const created = await createExpenseMasterOption(optionType, newVal.trim());
      setNewVal(""); setAdding(false);
      await load();
      onChange(created.label);
    } catch (e: any) { setErr(e?.message ?? "Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <FieldLabel>{label}{required && " *"}</FieldLabel>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder ?? "— Select —"}</option>
          {options.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
          {value && !options.find((o) => o.label === value) && <option value={value}>{value}</option>}
        </select>
        <button
          type="button"
          className="btn-sm"
          title="Add new"
          onClick={() => setAdding((v) => !v)}
          style={{ flexShrink: 0, minWidth: 36 }}
        >+</button>
      </div>
      {adding && (
        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder={`New ${label.toLowerCase()}…`}
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            autoFocus
          />
          <button type="button" className="btn-sm btn-primary" onClick={add} disabled={busy || !newVal.trim()}>
            {busy ? "…" : "Save"}
          </button>
          <button type="button" className="btn-sm" onClick={() => { setAdding(false); setNewVal(""); }}>×</button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{err}</div>}
    </div>
  );
}
