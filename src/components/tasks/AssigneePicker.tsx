// Ported from IPC Control Center.
// Vision Center adaptation: assignee source is the VC users directory
// (auth users + their roles), and the hidden-visibility feature is dropped
// since Vision Center does not have a task_assignee_visibility table.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { listAllUsersWithRoles } from "@/services/users/userService";
import { initialsOf } from "@/lib/tasks";

export interface AssigneeMember {
  id: string;
  full_name: string;
  role: string | null;
}

interface Props {
  value: string;
  valueName: string;
  onChange: (id: string, name: string) => void;
}

export default function AssigneePicker({ value, valueName, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<AssigneeMember[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAllUsersWithRoles();
        if (cancelled) return;
        const mapped: AssigneeMember[] = rows.map((r) => ({
          id: r.id,
          full_name: r.display_name || "(unnamed user)",
          role: r.roles?.[0] ?? null,
        }));
        mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setAll(mapped);
      } catch {
        if (!cancelled) setAll([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((u) => u.full_name.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const selected = all.find((u) => u.id === value);
  const displayName = selected?.full_name || valueName || "Select…";
  const displayInitials = initialsOf(displayName);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between bg-white rounded-[8px] px-3 transition-colors ${
          open ? "border border-[#C8A84B]" : "border border-[#E8E5DE]"
        }`}
        style={{ height: 40 }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-full bg-black flex items-center justify-center flex-shrink-0"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 9, color: "#C8A84B", fontWeight: 500 }}
          >
            {displayInitials}
          </span>
          <span className="truncate text-left" style={{ fontFamily: "Figtree, sans-serif", fontSize: 13 }}>
            {displayName}
          </span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white border border-[#E8E5DE] rounded-[10px] shadow-lg overflow-hidden"
          style={{ zIndex: 200 }}
        >
          <div className="flex items-center gap-2 px-3 border-b border-[#E8E5DE]" style={{ height: 34 }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user…"
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: "Figtree, sans-serif", fontSize: 12.5 }}
            />
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {visible.length === 0 && (
              <div className="px-3 py-4 text-center text-muted-foreground" style={{ fontFamily: "Figtree, sans-serif", fontSize: 12 }}>
                No results
              </div>
            )}
            {visible.map((m) => {
              const isSel = m.id === value;
              return (
                <div
                  key={m.id}
                  onClick={() => { onChange(m.id, m.full_name); setOpen(false); }}
                  className={`group flex items-center gap-2.5 px-3.5 cursor-pointer ${
                    isSel ? "bg-[#FBF6E9]" : "hover:bg-[#F7F6F3]"
                  }`}
                  style={{ height: 40 }}
                >
                  <span
                    className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 10, color: "#C8A84B", fontWeight: 500 }}
                  >
                    {initialsOf(m.full_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-black" style={{ fontFamily: "Figtree, sans-serif", fontSize: 13 }}>
                      {m.full_name}
                    </div>
                    {m.role && (
                      <div className="truncate text-muted-foreground" style={{ fontFamily: "Figtree, sans-serif", fontSize: 10 }}>
                        {m.role.replace("_", " ")}
                      </div>
                    )}
                  </div>
                  {isSel && <Check className="w-4 h-4 text-[#C8A84B] flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
