// @ts-nocheck
import { useState } from "react";
import { toast } from "sonner";
import { LoadingState, EmptyState } from "@/components/marketizers/ui";
import { usePositions } from "@/hooks/useAccessControl";
import { softDeletePosition, type Position } from "@/services/accessControl/accessControlService";
import { AccessStatusPill } from "./AccessStatusPill";
import { PositionPresetDrawer } from "./PositionPresetDrawer";

export function PositionPresets() {
  const { data: positions, loading, refetch } = usePositions();
  const [drawer, setDrawer] = useState<{ open: boolean; position: Position | null }>({ open: false, position: null });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--ink4)" }}>
          Define default permissions per role. Applied when assigning a position to a team member.
        </div>
        <button className="btn-sm" onClick={() => setDrawer({ open: true, position: null })}
          style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
          + Add Position
        </button>
      </div>

      {loading ? <LoadingState rows={5} /> :
        positions.length === 0 ? (
          <EmptyState icon="🎭" title="No positions defined"
            message="Create positions to set default access for roles like Media Buyer, Brand Manager, etc."
          />
        ) : (
          <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="attr-table" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Position</th><th>Default Level</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)", marginTop: 2 }}>{p.slug}</div>
                        {p.description && <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 4 }}>{p.description}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{p.default_access_level}</td>
                      <td><AccessStatusPill tone={p.status === "active" ? "yes" : "neutral"} label={p.status} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-sm" onClick={() => setDrawer({ open: true, position: p })}>Edit</button>{" "}
                        <button className="btn-sm" style={{ color: "var(--red)" }}
                          onClick={async () => {
                            if (!confirm(`Archive position "${p.name}"?`)) return;
                            await softDeletePosition(p.id);
                            toast.success("Archived.");
                            refetch();
                          }}>Archive</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {drawer.open && (
        <PositionPresetDrawer position={drawer.position} onClose={() => setDrawer({ open: false, position: null })}
          onSaved={() => refetch()} />
      )}
    </div>
  );
}
