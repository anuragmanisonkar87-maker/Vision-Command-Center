import { useEffect, useMemo, useState } from "react";
import { FieldLabel, inputStyle } from "@/components/marketizers/ui";
import {
  addQuickSaveOption,
  listQuickSaveOptions,
  type QuickSaveOption,
} from "@/services/marketizers/quickSaveOptionsService";

type Props = {
  label: string;
  group: string;
  value: string;
  onChange: (v: string) => void;
  defaults?: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Searchable select with a `+` quick-save button. Stores any user-added
 * options in marketizers_quick_save_options (per option_group).
 */
export function QuickSaveSelect({
  label,
  group,
  value,
  onChange,
  defaults = [],
  placeholder = "Select…",
  required,
  disabled,
}: Props) {
  const [extras, setExtras] = useState<QuickSaveOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listQuickSaveOptions(group)
      .then((rows) => { if (!cancel) setExtras(rows); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [group]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const all: string[] = [];
    for (const v of [...defaults, ...extras.map((e) => e.value)]) {
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      all.push(v);
    }
    if (value && !seen.has(value.toLowerCase())) all.push(value);
    return all;
  }, [defaults, extras, value]);

  const handleAdd = async () => {
    const v = draft.trim();
    if (!v) return;
    setSaving(true); setError(null);
    try {
      const opt = await addQuickSaveOption(group, v);
      setExtras((prev) =>
        prev.find((p) => p.value.toLowerCase() === opt.value.toLowerCase())
          ? prev
          : [...prev, opt]
      );
      onChange(opt.value);
      setDraft("");
      setAdding(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not save option.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <FieldLabel>{label}{required ? " *" : ""}</FieldLabel>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-sm"
          disabled={disabled}
          onClick={() => { setAdding((v) => !v); setError(null); setDraft(""); }}
          title={`Add new ${label.toLowerCase()}`}
          aria-label={`Add new ${label.toLowerCase()}`}
          style={{ minWidth: 36 }}
        >
          +
        </button>
      </div>
      {adding && (
        <div style={{
          marginTop: 8, padding: 10, borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--parchment)",
        }}>
          <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 6 }}>
            New {label.toLowerCase()}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
              value={draft}
              placeholder={`Type new ${label.toLowerCase()}…`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
            />
            <button type="button" className="btn-sm btn-primary" onClick={handleAdd} disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-sm" onClick={() => { setAdding(false); setDraft(""); }}>
              Cancel
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--danger, #c0392b)" }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
