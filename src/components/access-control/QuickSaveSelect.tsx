// @ts-nocheck
// Reusable QuickSaveSelect: <select> + "+" button.
// Click "+" opens a small inline modal, value saves to gwv_master_options,
// dropdown refreshes, and the new value is auto-selected.
import { useState } from "react";
import { toast } from "sonner";
import { createMasterOption, type MasterOption } from "@/services/accessControl/accessControlService";
import { inputStyle } from "@/components/marketizers/ui";

export function QuickSaveSelect({
  optionType, options, value, onChange, refresh, placeholder, disabled,
}: {
  optionType: string;
  options: MasterOption[];
  value: string;
  onChange: (val: string) => void;
  refresh: () => Promise<any> | void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      const created = await createMasterOption(optionType, label);
      await refresh();
      onChange(created.value);
      setOpen(false); setLabel("");
      toast.success("Added.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        type="button" onClick={() => setOpen(true)} title="Add new option"
        style={{
          width: 34, border: "1px solid var(--border)", borderRadius: 6,
          background: "var(--ivory)", color: "var(--ink)", cursor: "pointer",
          fontSize: 16, lineHeight: 1, fontFamily: "'Figtree',sans-serif",
        }}
      >+</button>

      {open && (
        <div onClick={() => !busy && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--ivory)", borderRadius: 10, padding: 22, width: "min(420px, 95vw)", border: "1px solid var(--border)" }}
          >
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
              Add new option
            </div>
            <input
              autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter value (e.g. Backend Operations Executive)"
              style={inputStyle}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn-sm" onClick={submit} disabled={busy || !label.trim()}
                style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
              >{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
