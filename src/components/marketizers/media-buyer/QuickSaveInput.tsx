import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/auth/useAuth";

export interface QuickSaveEntry {
  id: string;
  field_key: string;
  value: string;
  sort_order: number;
  created_by: string | null;
}

// Simple in-memory cache shared across all instances
const cache = new Map<string, QuickSaveEntry[]>();
const subscribers = new Map<string, Set<() => void>>();

function notify(fk: string) {
  subscribers.get(fk)?.forEach((cb) => cb());
}

async function loadEntries(fk: string) {
  const { data } = await supabase
    .from("quick_save_entries")
    .select("id, field_key, value, sort_order, created_by")
    .eq("field_key", fk)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  cache.set(fk, (data as QuickSaveEntry[]) || []);
  notify(fk);
}

function useEntries(fk: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!subscribers.has(fk)) subscribers.set(fk, new Set());
    const cb = () => setTick((t) => t + 1);
    subscribers.get(fk)!.add(cb);
    if (!cache.has(fk)) loadEntries(fk);
    return () => { subscribers.get(fk)?.delete(cb); };
  }, [fk]);
  return cache.get(fk) || [];
}

interface Props {
  fieldKey: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  className?: string;
  inputClassName?: string;
  width?: string;
  height?: number;
}

export default function QuickSaveInput({
  fieldKey, label, placeholder, value, onChange,
  type = "text", className = "", inputClassName = "", width = "100%", height,
}: Props) {
  const { user } = useAuth();
  const entries = useEntries(fieldKey);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [removedMsg, setRemovedMsg] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const v = value || "";
  const trimmed = v.trim();
  const exists = entries.some((e) => e.value.toLowerCase() === trimmed.toLowerCase());
  const showPlus = trimmed.length > 0 && !exists;
  const helperText = entries.length > 0
    ? "Click to choose from saved list or type a new value"
    : "No saved options yet — type a value and press + to save";

  const filtered = trimmed
    ? entries.filter((e) => e.value.toLowerCase().includes(trimmed.toLowerCase()))
    : entries;

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // dropdown direction
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setOpenUp(window.innerHeight - r.bottom < 240 && r.top > 240);
  }, [open]);

  const save = useCallback(async () => {
    if (!trimmed || exists || !user) return;
    setPulse(true);
    setTimeout(() => setPulse(false), 220);
    const { data, error } = await supabase
      .from("quick_save_entries")
      .insert({ field_key: fieldKey, value: trimmed, created_by: user.id })
      .select()
      .single();
    if (error) {
      // likely a duplicate (case difference); reload
      await loadEntries(fieldKey);
      return;
    }
    const list = cache.get(fieldKey) || [];
    cache.set(fieldKey, [data as QuickSaveEntry, ...list]);
    notify(fieldKey);
    setSavedMsg(label ? `✓ Saved to ${label} entries` : "✓ Saved");
    setTimeout(() => setSavedMsg(null), 1500);
  }, [trimmed, exists, user, fieldKey, label]);

  const remove = useCallback(async (id: string, val: string) => {
    // soft delete (own) or hard delete (admin) — try update first
    const { error } = await supabase
      .from("quick_save_entries")
      .update({ is_active: false })
      .eq("id", id);
    if (!error) {
      cache.set(fieldKey, (cache.get(fieldKey) || []).filter((e) => e.id !== id));
      notify(fieldKey);
      if (value === val) onChange("");
      setRemovedMsg(true);
      setTimeout(() => setRemovedMsg(false), 1200);
    }
  }, [fieldKey, value, onChange]);

  const inputStyle: React.CSSProperties = {
    paddingRight: 44,
    ...(height ? { height } : {}),
  };

  return (
    <div className={"qsi-wrap " + className} style={{ width }} ref={wrapRef}>
      {label && <label className="qsi-label">{label}</label>}
      <div className="qsi-field">
        <input
          ref={inputRef}
          type={type}
          className={"qsi-input " + inputClassName}
          style={inputStyle}
          value={v}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(-1); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
          onBlur={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            blurTimer.current = window.setTimeout(() => setOpen(false), 180);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); return; }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHi((h) => Math.min((filtered.length - 1), h + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
              return;
            }
            if (e.key === "Enter") {
              if (open && hi >= 0 && filtered[hi]) {
                e.preventDefault();
                onChange(filtered[hi].value);
                setOpen(false);
                return;
              }
              if (showPlus) { e.preventDefault(); save(); }
            }
          }}
        />
        {showPlus ? (
          <button
            type="button"
            className={"qsi-plus" + (pulse ? " qsi-pulse" : "")}
            title="Save this value to the list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={save}
          >+</button>
        ) : (
          <button
            type="button"
            className="qsi-plus qsi-plus-chev"
            title={entries.length > 0 ? "Show saved options" : "Type a value, then press + to save"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
            aria-label="Show saved options"
          >▾</button>
        )}

        {open && (
          <div className={"qsi-dd" + (openUp ? " qsi-dd-up" : "")} onMouseDown={(e) => e.preventDefault()}>
            <div className="qsi-dd-hdr">Saved entries</div>
            {entries.length === 0 && (
              <div className="qsi-dd-empty">No saved entries yet — type and press + to save</div>
            )}
            {entries.length > 0 && filtered.length === 0 && trimmed && (
              <div className="qsi-dd-empty">Press + to save "{trimmed}"</div>
            )}
            {filtered.map((e, i) => (
              <div
                key={e.id}
                className={"qsi-dd-row" + (i === hi ? " qsi-dd-row-hi" : "")}
                onMouseEnter={() => setHi(i)}
                onClick={() => { onChange(e.value); setOpen(false); }}
              >
                <span className="qsi-dd-val">{e.value}</span>
                <button
                  type="button"
                  className="qsi-dd-x"
                  title="Remove"
                  onClick={(ev) => { ev.stopPropagation(); remove(e.id, e.value); }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="qsi-helper">{helperText}</div>
      {savedMsg && <div className="qsi-saved">{savedMsg}</div>}
      {removedMsg && <div className="qsi-removed">✕ Entry removed</div>}
    </div>
  );
}
