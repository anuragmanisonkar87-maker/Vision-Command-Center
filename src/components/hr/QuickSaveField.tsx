// QuickSaveField — dropdown with always-visible "+" to add new options.
import { useEffect, useState } from "react";
import { listOptions, quickSaveOption, type MasterOption } from "@/services/hr/hrMasterOptionsService";
import { inputStyle, FieldLabel } from "@/components/marketizers/ui";

type Props = {
  label: string;
  optionType: string;
  value: string;
  onChange: (v: string, opt?: MasterOption) => void;
  placeholder?: string;
  required?: boolean;
};

export function QuickSaveField({ label, optionType, value, onChange, placeholder, required }: Props) {
  const [options, setOptions] = useState<MasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const load = async () => {
    setLoading(true);
    try { setOptions(await listOptions(optionType)); } catch { setOptions([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [optionType]);

  const handleSave = async () => {
    if (!draft.trim()) return;
    try {
      const opt = await quickSaveOption(optionType, draft);
      setOptions((o) => [...o, opt]);
      onChange(opt.value, opt);
      setDraft(""); setAdding(false);
    } catch (e: any) {
      alert(e?.message || "Could not save option");
    }
  };

  return (
    <div>
      <FieldLabel>{label}{required && " *"}</FieldLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 38px", gap: 6 }}>
        <select
          style={{ ...inputStyle, minHeight: 38 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          <option value="">{loading ? "Loading…" : (placeholder ?? "Select…")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdding(true)}
          title={`Add new ${label.toLowerCase()}`}
          style={{
            height: 38, width: 38, border: "1px solid var(--gold-border)",
            background: "var(--gold-bg)", color: "var(--gold)", borderRadius: 6,
            fontSize: 18, fontWeight: 700, cursor: "pointer",
          }}
        >+</button>
      </div>

      {adding && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(23,21,18,.42)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "min(420px, 92vw)", background: "var(--ivory)", borderRadius: 10, border: "1px solid var(--border)", padding: 22 }}>
            <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: "0 0 8px" }}>Add {label}</h4>
            <p style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 14 }}>This option will be available everywhere immediately.</p>
            <input
              autoFocus
              style={{ ...inputStyle, marginBottom: 12 }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`New ${label.toLowerCase()}`}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-sm" onClick={() => { setAdding(false); setDraft(""); }}>Cancel</button>
              <button type="button" className="btn-sm" onClick={handleSave}
                style={{ background: "var(--ink)", color: "var(--parchment)" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
