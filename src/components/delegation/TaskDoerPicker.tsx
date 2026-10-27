// Polished, searchable Task Doer picker for the Delegation Command Center.
// Replaces native <select> with an ivory/gold app-styled combobox.
// Dropdown is rendered through a portal with fixed positioning so it is never
// clipped by the grid's overflow:hidden cells.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, UserPlus } from "lucide-react";
import { initialsOf } from "@/lib/tasks";
import type { TaskDoer } from "@/services/delegation/taskDoers";

interface Props {
  value: string;                       // selected team-member id
  doers: TaskDoer[];
  onChange: (id: string) => void;
  placeholder?: string;                // default: "Choose task doer"
  size?: "sm" | "md";                  // sm = grid cell, md = drawer field
  autoFocus?: boolean;
  testId?: string;
  /** When true and value is empty, render a soft "Choose task doer" pill */
  legacyUnassigned?: boolean;
}

const EMPTY_LABEL = "Choose task doer";

export default function TaskDoerPicker({
  value, doers, onChange, placeholder = EMPTY_LABEL,
  size = "sm", autoFocus = false, testId, legacyUnassigned = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (autoFocus) setOpen(true);
  }, [autoFocus]);

  // Position the portal menu under the trigger (fixed coords so overflow:hidden
  // cells cannot clip it). Recompute on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const width = Math.max(280, t.width);
      const viewportW = window.innerWidth;
      const left = Math.min(Math.max(8, t.left), viewportW - width - 8);
      const top = t.bottom + 4;
      setMenuPos({ top, left, width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return doers;
    return doers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.position_name ?? "").toLowerCase().includes(q),
    );
  }, [doers, query]);

  const selected = doers.find((d) => d.id === value) ?? null;
  const empty = !selected;

  const triggerHeight = size === "sm" ? 30 : 40;
  const fontSize = size === "sm" ? 12.5 : 13;

  const triggerCls = empty
    ? legacyUnassigned
      ? "border border-[#E8D49A] bg-[#FBF6E9] text-[#7A5E10]"
      : "border border-[#E8E2D2] bg-white text-stone-500"
    : "border border-[#E8E2D2] bg-white text-stone-800";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        data-testid={testId}
        className={`w-full flex items-center justify-between rounded-[8px] pl-3 pr-2 gap-2 transition-colors hover:border-[#C8A84B] ${triggerCls} ${open ? "ring-1 ring-[#C8A84B] border-[#C8A84B]" : ""}`}
        style={{ height: triggerHeight, fontSize }}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span
                className="rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0"
                style={{
                  width: size === "sm" ? 20 : 24,
                  height: size === "sm" ? 20 : 24,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: size === "sm" ? 9 : 10,
                  color: "#C8A84B",
                }}
              >
                {initialsOf(selected.name)}
              </span>
              <span className="truncate text-left">
                {selected.name}
                {selected.position_name && (
                  <span className="text-stone-400"> · {selected.position_name}</span>
                )}
              </span>
            </>
          ) : legacyUnassigned ? (
            <span className="flex items-center gap-2 truncate">
              <UserPlus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{EMPTY_LABEL}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 truncate">
              <UserPlus className="w-3.5 h-3.5 flex-shrink-0 text-stone-400" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
        </span>
        <ChevronDown className="w-3 h-3 text-stone-400 flex-shrink-0" />
      </button>

      {open && menuPos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="bg-white border border-[#E8E2D2] rounded-[10px] shadow-xl overflow-hidden"
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            zIndex: 9999,
          }}
        >
          <div className="flex items-center gap-2 px-3 border-b border-[#F0EBD9]" style={{ height: 34 }}>
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search task doer…"
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: "Figtree, sans-serif", fontSize: 12.5 }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {visible.length === 0 ? (
              <div className="px-3 py-4 text-center text-stone-400 text-xs">
                {doers.length === 0 ? "No active team members found" : "No matches"}
              </div>
            ) : (
              visible.map((d) => {
                const isSel = d.id === value;
                return (
                  <div
                    key={d.id}
                    onMouseDown={(e) => { e.preventDefault(); onChange(d.id); setOpen(false); setQuery(""); }}
                    className={`group flex items-center gap-2.5 px-3 cursor-pointer ${isSel ? "bg-[#FBF6E9]" : "hover:bg-[#F7F4EA]"}`}
                    style={{ height: 42 }}
                  >
                    <span
                      className="w-7 h-7 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0"
                      style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 10, color: "#C8A84B" }}
                    >
                      {initialsOf(d.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-stone-900" style={{ fontSize: 13 }}>{d.name}</div>
                      {d.position_name && (
                        <div className="truncate text-stone-500" style={{ fontSize: 10.5 }}>{d.position_name}</div>
                      )}
                    </div>
                    {isSel && <Check className="w-4 h-4 text-[#C8A84B] flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Read-only identity pill used for employees (locked Task Doer cell). */
export function TaskDoerSelfPill({
  name, subtext = "Assigned to me", size = "sm",
}: { name: string; subtext?: string; size?: "sm" | "md" }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[8px] border border-[#E8D49A] bg-[#FBF6E9] pl-2 pr-3 max-w-full"
      style={{ height: size === "sm" ? 28 : 36 }}
      data-testid="dg-taskdoer-self-pill"
      title="Employees can only be assigned to themselves"
    >
      <span
        className="rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0"
        style={{
          width: size === "sm" ? 20 : 24,
          height: size === "sm" ? 20 : 24,
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 9,
          color: "#C8A84B",
        }}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex flex-col leading-tight">
        <span className="truncate text-stone-900" style={{ fontSize: 12.5 }}>{name}</span>
        <span className="truncate text-[#7A5E10]" style={{ fontSize: 10 }}>{subtext}</span>
      </span>
    </span>
  );
}
