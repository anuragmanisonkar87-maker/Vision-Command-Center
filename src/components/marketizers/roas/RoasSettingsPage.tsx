// Settings & Master Data for Media Buyer Performance.
import "./vc-roas.css";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/marketizers/ui";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUYER_HUB_ROUTE } from "@/config/marketizersTeamPerformanceModules";

type Section = "event_type" | "audience_segment" | "roas_threshold" | "revenue_default" | "google-sheet";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "event_type", label: "Event Types" },
  { key: "audience_segment", label: "Audience Segments" },
  { key: "roas_threshold", label: "ROAS Health Thresholds" },
  { key: "revenue_default", label: "Revenue Formula Defaults" },
  { key: "google-sheet", label: "Google Sheet Sync" },
];

type Option = { id: string; option_group: string; label: string; value: string; sort_order: number; is_active: boolean };

export default function RoasSettingsPage() {
  const [section, setSection] = useState<Section>("event_type");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");

  useEffect(() => { document.title = "Settings & Master Data | Media Buyer"; }, []);

  const isOptionsTab = section !== "google-sheet";

  const refresh = async () => {
    if (!isOptionsTab) { setOptions([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("marketizers_roas_quick_save_options")
      .select("*")
      .eq("option_group", section)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) console.error(error);
    setOptions((data ?? []) as Option[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [section]);

  const addOption = async () => {
    const v = newValue.trim();
    if (!v || !isOptionsTab) return;
    const { error } = await (supabase as any)
      .from("marketizers_roas_quick_save_options")
      .insert({ option_group: section, label: v, value: v, sort_order: options.length });
    if (error) { alert(error.message); return; }
    setNewValue("");
    refresh();
  };

  const removeOption = async (id: string) => {
    if (!confirm("Remove this option?")) return;
    const { error } = await (supabase as any)
      .from("marketizers_roas_quick_save_options")
      .update({ is_active: false })
      .eq("id", id);
    if (error) { alert(error.message); return; }
    setOptions((o) => o.filter((x) => x.id !== id));
  };

  return (
    <div className="vc-roas">
      <PageHeader
        eyebrow="Marketizers / Media Buyer Performance"
        title="Settings & Master Data"
        subtitle="Manage dropdown options, ROAS thresholds, formula defaults, and integrations."
        actions={
          <Link to={MEDIA_BUYER_HUB_ROUTE}>
            <button className="btn-sm">← Back to Hub</button>
          </Link>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 12 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 12px", marginBottom: 4, borderRadius: 4,
                border: "none", cursor: "pointer",
                background: section === s.key ? "var(--ink)" : "transparent",
                color: section === s.key ? "var(--parchment)" : "inherit",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          {section === "google-sheet" ? (
            <div>
              <h3 style={{ marginTop: 0 }}>Google Sheet Sync</h3>
              <p style={{ color: "var(--muted)" }}>
                Foundation-ready. Future: import ROAS sessions directly from a configured Google Sheet.
                Manual entry remains the primary workflow.
              </p>
              <button className="btn-sm" disabled>Sync from Google Sheet (Coming soon)</button>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>{SECTIONS.find((s) => s.key === section)?.label}</h3>
              {loading ? <div>Loading…</div> : (
                <>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
                    {options.map((o) => (
                      <li key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--rule-soft, #eee)" }}>
                        <span>{o.label}</span>
                        <button className="btn-xs" onClick={() => removeOption(o.id)}>Remove</button>
                      </li>
                    ))}
                    {!options.length && <li style={{ padding: 8, color: "var(--muted)" }}>No options yet.</li>}
                  </ul>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="New option…"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addOption()}
                      style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 4 }}
                    />
                    <button className="btn-sm" onClick={addOption} style={{ background: "var(--ink)", color: "var(--parchment)" }}>+ Add</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
