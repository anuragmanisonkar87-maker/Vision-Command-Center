// @ts-nocheck
// Settings → Integrations → Google Sheets
// API-key-based connector. Admin-only.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import {
  fetchSheet,
  listConnections,
  saveConnection,
  deleteConnection,
  listSyncRuns,
  recordSyncRun,
  presetRange,
  filterRowsByDate,
  type DateRangePreset,
  type FetchResult,
  type SheetConnection,
  type SheetTab,
  type SyncRun,
} from "@/services/integrations/googleSheetsService";

export const Route = createFileRoute("/settings/integrations/google-sheets")({
  component: GoogleSheetsIntegrationPage,
});

const box: React.CSSProperties = {
  background: "var(--card, #fff)",
  border: "1px solid var(--border, #e5e5e5)",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 };
const btn: React.CSSProperties = { padding: "8px 14px", border: "1px solid #111", background: "#111", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const btnAlt: React.CSSProperties = { ...btn, background: "#fff", color: "#111" };

function extractGid(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[#&?]gid=(\d+)/);
  return m ? m[1] : null;
}

function GoogleSheetsIntegrationPage() {
  const { isAdmin, isLoading } = useEffectiveAccess();

  // form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState("");
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [dateCol, setDateCol] = useState("");
  const [preset, setPreset] = useState<DateRangePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // results
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FetchResult | null>(null);

  // persistence
  const [connections, setConnections] = useState<SheetConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);

  const range = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  async function refreshConnections() {
    try { setConnections(await listConnections()); } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { if (isAdmin) void refreshConnections(); }, [isAdmin]);

  useEffect(() => {
    if (!selectedId) { setRuns([]); return; }
    listSyncRuns(selectedId).then(setRuns).catch((e) => setError(e.message));
  }, [selectedId]);

  // Step 1: load metadata only (tabs list). Don't try to read rows yet.
  async function onTest() {
    setError(null); setResult(null); setTabs([]);
    setBusy(true);
    try {
      const meta = await fetchSheet({ sheet_url: url });
      setTabs(meta.tabs ?? []);
      // Auto-select by gid if present in URL, otherwise first tab.
      const gid = extractGid(url);
      const match = gid ? meta.tabs?.find((t) => t.sheetId === gid) : null;
      const pick = match?.tabName ?? meta.tabs?.[0]?.tabName ?? "";
      setTab(pick);
      // Immediately load rows for selected tab if any.
      if (pick) {
        const rowsResult = await fetchSheet({ sheet_url: url, sheet_name: pick });
        setResult(rowsResult);
      } else {
        setResult(meta);
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  // Reload rows when user picks a different tab from the dropdown.
  async function onTabChange(next: string) {
    setTab(next);
    if (!next || !url) return;
    setBusy(true); setError(null);
    try {
      const r = await fetchSheet({ sheet_url: url, sheet_name: next });
      setResult(r);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function onSave() {
    if (!result) { setError("Run Test Access first."); return; }
    setError(null); setBusy(true);
    try {
      const conn = await saveConnection({
        connection_name: name || result.spreadsheetTitle || "Google Sheet",
        sheet_url: url,
        spreadsheet_id: result.spreadsheetId,
        sheet_name: tab || null,
        date_column: dateCol || null,
      });
      await recordSyncRun(conn.id, { row_count: filteredRows.length, status: "success" });
      await refreshConnections();
      setSelectedId(conn.id);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function onResyncSelected() {
    const c = connections.find((x) => x.id === selectedId);
    if (!c) return;
    setBusy(true); setError(null);
    try {
      const r = await fetchSheet({ sheet_url: c.sheet_url, sheet_name: c.sheet_name || undefined });
      await recordSyncRun(c.id, { row_count: r.totalRows, status: "success" });
      setRuns(await listSyncRuns(c.id));
    } catch (e: any) {
      await recordSyncRun(c.id, { row_count: 0, status: "error", error_message: e.message }).catch(() => {});
      setError(e.message);
      setRuns(await listSyncRuns(c.id).catch(() => []));
    } finally { setBusy(false); }
  }

  const filteredRows = useMemo(() => {
    if (!result) return [];
    if (!dateCol) return result.rows;
    return filterRowsByDate(result.headers, result.rows, dateCol, range);
  }, [result, dateCol, range]);

  if (isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!isAdmin) return <div style={{ padding: 24 }}>Admin access required.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Google Sheets Integration</h1>
      <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 13 }}>
        Sheets must be shared as <strong>Anyone with the link → Viewer</strong>.
      </p>

      <section style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add Sheet Connection</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Connection Name</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Leads – Brand A" />
          </div>
          <div>
            <label style={label}>Tab / Sheet</label>
            {tabs.length > 0 ? (
              <select style={input} value={tab} onChange={(e) => onTabChange(e.target.value)}>
                {tabs.map((t) => (
                  <option key={t.sheetId} value={t.tabName}>{t.tabName}</option>
                ))}
              </select>
            ) : (
              <input style={input} value={tab} onChange={(e) => setTab(e.target.value)} placeholder="Click Test Access to load tabs" />
            )}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Google Sheet URL</label>
            <input style={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button style={btn} onClick={onTest} disabled={busy || !url}>{busy ? "Working…" : "Test Access"}</button>
          <button style={btnAlt} onClick={onSave} disabled={busy || !result || !result.headers?.length}>Save Connection</button>
        </div>
        {error && <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
      </section>

      {result && (
        <section style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{result.spreadsheetTitle}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {result.totalRows} rows · {filteredRows.length} after filter
                {result.tabs?.length ? ` · tabs: ${result.tabs.map((t) => t.tabName).join(", ")}` : ""}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Date Column</label>
              <select style={input} value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                <option value="">— none —</option>
                {result.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Date Range</label>
              <select style={input} value={preset} onChange={(e) => setPreset(e.target.value as DateRangePreset)}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {preset === "custom" && (
              <>
                <div>
                  <label style={label}>From</label>
                  <input type="date" style={input} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <label style={label}>To</label>
                  <input type="date" style={input} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6, maxHeight: 360 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                <tr>{result.headers.map((h) => <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 200).map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    {result.headers.map((_, ci) => <td key={ci} style={{ padding: 8 }}>{String(row[ci] ?? "")}</td>)}
                  </tr>
                ))}
                {filteredRows.length === 0 && <tr><td colSpan={Math.max(1, result.headers.length)} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>No rows match the filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 200 && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Showing first 200 of {filteredRows.length} rows.</div>}
        </section>
      )}

      <section style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Saved Connections</h2>
        {connections.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No connections yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#f9fafb" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", padding: 8 }}>Tab</th>
              <th style={{ textAlign: "left", padding: 8 }}>Date Column</th>
              <th style={{ textAlign: "left", padding: 8 }}>Last Synced</th>
              <th style={{ padding: 8 }}></th>
            </tr></thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #e5e7eb", background: selectedId === c.id ? "#fafafa" : undefined }}>
                  <td style={{ padding: 8 }}>{c.connection_name}</td>
                  <td style={{ padding: 8 }}>{c.sheet_name ?? "—"}</td>
                  <td style={{ padding: 8 }}>{c.date_column ?? "—"}</td>
                  <td style={{ padding: 8 }}>{c.last_synced_at ? new Date(c.last_synced_at).toLocaleString() : "—"}</td>
                  <td style={{ padding: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button style={btnAlt} onClick={() => setSelectedId(c.id)}>History</button>
                    <button style={btnAlt} onClick={async () => { await deleteConnection(c.id); await refreshConnections(); if (selectedId === c.id) setSelectedId(null); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {selectedId && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Sync History</strong>
              <button style={btn} onClick={onResyncSelected} disabled={busy}>Re-sync</button>
            </div>
            {runs.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>No syncs yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: 6 }}>Started</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Rows</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Error</th>
                </tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 6 }}>{new Date(r.started_at).toLocaleString()}</td>
                      <td style={{ padding: 6, color: r.status === "success" ? "#047857" : "#b91c1c" }}>{r.status}</td>
                      <td style={{ padding: 6 }}>{r.row_count ?? "—"}</td>
                      <td style={{ padding: 6, color: "#b91c1c" }}>{r.error_message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
