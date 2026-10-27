// @ts-nocheck
import { useEffect, useState } from "react";
import { getAuditLog, type AuditEntry } from "@/services/accessControl/auditLogService";
import { LoadingState, EmptyState, ErrorBanner } from "@/components/marketizers/ui";

const ACTION_TONE: Record<string, string> = {
  create: "var(--green)",
  update: "var(--gold3)",
  delete: "var(--red)",
  bulk: "var(--ink)",
};

function tone(action: string) {
  if (action.startsWith("create")) return ACTION_TONE.create;
  if (action.startsWith("delete") || action.startsWith("archive")) return ACTION_TONE.delete;
  if (action.startsWith("bulk")) return ACTION_TONE.bulk;
  return ACTION_TONE.update;
}

export function AuditLog() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getAuditLog(300)); }
    catch (e: any) { setError(e?.message ?? "Failed to load audit log."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = data.filter((d) =>
    !filter ||
    d.action.toLowerCase().includes(filter.toLowerCase()) ||
    (d.summary ?? "").toLowerCase().includes(filter.toLowerCase()) ||
    (d.actor_label ?? "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Filter by action, actor, or summary…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)", fontSize: 13, background: "var(--ivory)" }}
        />
        <button className="btn-sm" onClick={load}>Refresh</button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? <LoadingState rows={5} /> :
        filtered.length === 0 ? (
          <EmptyState icon="📜" title="No audit entries"
            message="Permission changes and bulk operations will appear here." />
        ) : (
          <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="attr-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontSize: 12 }}>{e.actor_label || "—"}</td>
                      <td>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--parchment)", background: tone(e.action) }}>
                          {e.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{e.entity_type}</td>
                      <td style={{ fontSize: 12, color: "var(--ink3)" }}>{e.summary || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
