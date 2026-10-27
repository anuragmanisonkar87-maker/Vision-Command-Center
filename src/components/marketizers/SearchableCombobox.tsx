// Vision Center — searchable combobox.
// Custom popover with input + filtered list. No native datalist (datalist had
// inconsistent preview behaviour). Used for Client / Media Buyer selection.
//
// API:
//   <SearchableCombobox
//     value={selected}                       // string (current label/value)
//     options={[{ id, label, sublabel? }]}
//     onChange={(opt) => ...}                // null when cleared
//     placeholder="Select…"
//     loading={false}
//     error={null}
//     emptyText="No results"
//     emptyAction={<button …>+ Add Client</button>}
//   />

import { useEffect, useMemo, useRef, useState } from "react";
import { FieldLabel, inputStyle as baseInput } from "@/components/marketizers/ui";

export type ComboOption = {
  id: string;
  label: string;
  sublabel?: string | null;
  /** Optional extra haystack tokens (niche, position, etc.) for matching */
  meta?: string | null;
};

type Props = {
  label?: string;
  value: string;
  onChange: (opt: ComboOption | null) => void;
  options: ComboOption[];
  placeholder?: string;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Extra trailing controls below dropdown (e.g. + Add) */
  footer?: React.ReactNode;
};

function initials(s: string) {
  return s.split(/\s+/).map((w) => w[0]).join("").toLowerCase();
}

export function SearchableCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  loading,
  error,
  emptyText = "No results.",
  emptyAction,
  required,
  disabled,
  footer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync displayed text with selected value when not actively searching.
  useEffect(() => {
    if (!open) setQuery(value || "");
  }, [value, open]);

  // Outside click to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel ?? ""} ${o.meta ?? ""}`.toLowerCase();
      if (hay.includes(q)) return true;
      // initials match (e.g. "sj" → "Sandeep Jyot")
      if (initials(o.label).startsWith(q)) return true;
      return false;
    });
  }, [options, query]);

  const select = (opt: ComboOption) => {
    onChange(opt);
    setQuery(opt.label);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {label && <FieldLabel>{label}{required ? " *" : ""}</FieldLabel>}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") {
              if (open && filtered[active]) { e.preventDefault(); select(filtered[active]); }
            } else if (e.key === "Escape") { setOpen(false); }
          }}
          style={{ ...baseInput, paddingRight: value ? 30 : 11 }}
        />
        {value && !disabled && (
          <button
            type="button" onClick={clear} aria-label="Clear"
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              width: 22, height: 22, border: "none", background: "transparent",
              color: "var(--ink4)", cursor: "pointer", fontSize: 16, lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: "var(--ivory)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 12px 30px -12px rgba(0,0,0,.22)",
            maxHeight: 280, overflowY: "auto", zIndex: 90,
          }}
        >
          {loading ? (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink4)" }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--red)" }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--ink4)", marginBottom: emptyAction ? 10 : 0 }}>
                {emptyText}
              </div>
              {emptyAction}
            </div>
          ) : (
            <div role="listbox">
              {filtered.map((o, i) => {
                const selected = o.label === value;
                const isActive = i === active;
                return (
                  <div
                    key={o.id}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => { e.preventDefault(); select(o); }}
                    onMouseEnter={() => setActive(i)}
                    style={{
                      padding: "9px 12px",
                      cursor: "pointer",
                      background: isActive ? "var(--gold-bg)" : selected ? "var(--parchment2)" : "transparent",
                      borderBottom: "1px solid var(--parchment2)",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: selected ? 600 : 500 }}>
                      {o.label}
                    </div>
                    {o.sublabel && (
                      <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 2 }}>
                        {o.sublabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {footer && (
            <div style={{ padding: 8, borderTop: "1px solid var(--parchment2)", background: "var(--parchment)" }}>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
