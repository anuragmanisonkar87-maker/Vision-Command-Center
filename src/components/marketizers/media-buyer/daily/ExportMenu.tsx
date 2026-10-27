import { useEffect, useRef, useState } from "react";

export type ExportAction =
  | "csv"
  | "xlsx"
  | "pdf"
  | "whatsapp"
  | "sheets-download"
  | "sheets-copy";

interface Props {
  label?: string;
  size?: "sm" | "md";
  includeWhatsapp?: boolean;
  onSelect: (action: ExportAction) => void;
  align?: "left" | "right";
}

export default function ExportMenu({
  label = "Export",
  size = "sm",
  includeWhatsapp = true,
  onSelect,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const items: { key: ExportAction; label: string }[] = [
    { key: "csv", label: "📁 Export CSV" },
    { key: "xlsx", label: "📊 Export Excel (CSV)" },
    { key: "pdf", label: "📄 Export PDF" },
    ...(includeWhatsapp ? [{ key: "whatsapp" as ExportAction, label: "📋 Copy WhatsApp" }] : []),
    { key: "sheets-download", label: "📗 Google Sheets CSV" },
    { key: "sheets-copy", label: "📗 Copy for Google Sheets" },
  ];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        className={"btn btn-g " + (size === "sm" ? "btn-sm" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        📤 {label} ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [align]: 0 as any,
            background: "#fff",
            border: "1px solid #E8E5DE",
            borderRadius: 10,
            minWidth: 220,
            zIndex: 60,
            padding: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,.04)",
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => { setOpen(false); onSelect(it.key); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "8px 12px", background: "transparent", border: "none",
                fontFamily: "'Jost',sans-serif", fontSize: 12, color: "#0a0a0a",
                cursor: "pointer", borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FBF6E9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
