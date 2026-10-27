// Reports & History — ROAS sessions, daily reports aggregations, trash.
import "./vc-roas.css";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, MetricCard } from "@/components/marketizers/ui";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { useFinanceVisibility } from "@/hooks/useFinanceVisibility";
import {
  listRoasSessions,
  softDeleteRoasSession,
  restoreRoasSession,
  duplicateRoasSession,
  type RoasSession,
} from "@/services/marketizers/roasService";
import {
  MEDIA_BUYER_HUB_ROUTE,
  SEMINAR_ROAS_ROUTE,
} from "@/config/marketizersTeamPerformanceModules";

const inr = (n: number | null | undefined) =>
  isFinite(Number(n)) && n != null
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n))
    : "0";

type TabKey = "roas" | "client" | "media-buyer" | "trends" | "trash";

const TABS: { key: TabKey; label: string }[] = [
  { key: "roas", label: "ROAS History" },
  { key: "client", label: "Client-wise" },
  { key: "media-buyer", label: "Media Buyer-wise" },
  { key: "trends", label: "Trends" },
  { key: "trash", label: "Trash" },
];

export default function RoasReportsHistoryPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const canSeeFinance = useFinanceVisibility("marketizers");
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("roas");
  const [rows, setRows] = useState<RoasSession[]>([]);
  const [trashed, setTrashed] = useState<RoasSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Reports & History | Media Buyer Performance";
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const [active, deleted] = await Promise.all([
        listRoasSessions(),
        listRoasSessions({ onlyDeleted: true }),
      ]);
      setRows(active);
      setTrashed(deleted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.client_name, r.media_buyer_name, r.event_name, r.event_type]
        .filter(Boolean).join(" ").toLowerCase().includes(s));
  }, [rows, search]);

  const totals = useMemo(() => {
    const ad = rows.reduce((s, r) => s + Number(r.ad_spend || 0), 0);
    const rev = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
    const pnl = rows.reduce((s, r) => s + Number(r.pnl || 0), 0);
    const leads = rows.reduce((s, r) => s + Number(r.leads || 0), 0);
    return { ad, rev, pnl, leads, count: rows.length };
  }, [rows]);

  const groupBy = (key: "client_name" | "media_buyer_name") => {
    const map = new Map<string, { ad: number; rev: number; pnl: number; leads: number; count: number }>();
    for (const r of rows) {
      const k = (r[key] as string) || "Unassigned";
      const v = map.get(k) ?? { ad: 0, rev: 0, pnl: 0, leads: 0, count: 0 };
      v.ad += Number(r.ad_spend || 0);
      v.rev += Number(r.total_revenue || 0);
      v.pnl += Number(r.pnl || 0);
      v.leads += Number(r.leads || 0);
      v.count += 1;
      map.set(k, v);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].rev - a[1].rev);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Move this ROAS session to Trash?")) return;
    await softDeleteRoasSession(id);
    refresh();
  };

  const handleRestore = async (id: string) => {
    await restoreRoasSession(id);
    refresh();
  };

  const handleDuplicate = async (id: string) => {
    const newId = await duplicateRoasSession(id);
    navigate({ to: SEMINAR_ROAS_ROUTE, search: { editId: newId } as any });
  };

  return (
    <div className="vc-roas">
      <PageHeader
        eyebrow="Marketizers / Media Buyer Performance"
        title="Reports & History"
        subtitle="ROAS sessions, daily reports, client and media-buyer aggregates, trends, and trash."
        actions={
          <>
            <Link to={MEDIA_BUYER_HUB_ROUTE}>
              <button className="btn-sm">← Back to Hub</button>
            </Link>
            <Link to={SEMINAR_ROAS_ROUTE}>
              <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)" }}>
                + New ROAS Calculation
              </button>
            </Link>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <MetricCard accent="gold" label="Sessions" value={String(totals.count)} />
        {canSeeFinance && <MetricCard accent="green" label="Total Revenue" value={`₹${inr(totals.rev)}`} />}
        {canSeeFinance && <MetricCard accent="amber" label="Total Ad Spend" value={`₹${inr(totals.ad)}`} />}
        {canSeeFinance && <MetricCard accent={totals.pnl >= 0 ? "green" : "amber"} label="Total PNL" value={`₹${inr(totals.pnl)}`} />}
        <MetricCard accent="gold" label="Total Leads" value={inr(totals.leads)} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className="btn-sm"
            onClick={() => setTab(t.key)}
            style={tab === t.key ? { background: "var(--ink)", color: "var(--parchment)" } : undefined}
          >
            {t.label}
          </button>
        ))}
        {tab === "roas" && (
          <input
            placeholder="Search client / event / buyer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 4, minWidth: 240 }}
          />
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}>Loading…</div>
      ) : tab === "roas" ? (
        <RoasTable
          rows={filtered}
          admin={admin}
          canSeeFinance={canSeeFinance}
          onOpen={(id) => navigate({ to: SEMINAR_ROAS_ROUTE, search: { editId: id } as any })}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      ) : tab === "client" ? (
        <AggregateTable label="Client" rows={groupBy("client_name")} canSeeFinance={canSeeFinance} />
      ) : tab === "media-buyer" ? (
        <AggregateTable label="Media Buyer" rows={groupBy("media_buyer_name")} canSeeFinance={canSeeFinance} />
      ) : tab === "trends" ? (
        <TrendsView rows={rows} canSeeFinance={canSeeFinance} />
      ) : (
        <TrashTable
          rows={trashed}
          admin={admin}
          canSeeFinance={canSeeFinance}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}

function RoasTable({
  rows, admin, canSeeFinance, onOpen, onDuplicate, onDelete,
}: {
  rows: RoasSession[];
  admin: boolean;
  canSeeFinance: boolean;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!rows.length) return <div className="card" style={{ padding: 24 }}>No ROAS sessions yet. <Link to={SEMINAR_ROAS_ROUTE}>Create one</Link>.</div>;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th style={th}>Date</th>
            <th style={th}>Client</th>
            <th style={th}>Event</th>
            <th style={th}>Media Buyer</th>
            {canSeeFinance && <th style={thR}>Ad Spend</th>}
            <th style={thR}>Leads</th>
            {canSeeFinance && <th style={thR}>CPL</th>}
            {canSeeFinance && <th style={thR}>Revenue</th>}
            {canSeeFinance && <th style={thR}>ROAS</th>}
            {canSeeFinance && <th style={thR}>PNL</th>}
            <th style={th}>Health</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--rule-soft, #eee)" }}>
              <td style={td}>{r.campaign_date_to ?? "—"}</td>
              <td style={td}>{r.client_name ?? "—"}</td>
              <td style={td}>{r.event_name ?? r.event_type ?? "—"}</td>
              <td style={td}>{r.media_buyer_name ?? "—"}</td>
              {canSeeFinance && <td style={tdR}>₹{inr(r.ad_spend)}</td>}
              <td style={tdR}>{inr(r.leads)}</td>
              {canSeeFinance && <td style={tdR}>{r.cpl != null ? `₹${inr(r.cpl)}` : "—"}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(r.total_revenue)}</td>}
              {canSeeFinance && <td style={tdR}>{r.roas != null ? r.roas.toFixed(2) : "—"}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(r.pnl)}</td>}
              <td style={td}>{r.performance_health ?? "—"}</td>
              <td style={td}>
                <button className="btn-xs" onClick={() => onOpen(r.id)}>Open</button>{" "}
                <button className="btn-xs" onClick={() => onDuplicate(r.id)}>Duplicate</button>{" "}
                {admin && <button className="btn-xs" onClick={() => onDelete(r.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AggregateTable({ label, rows, canSeeFinance }: { label: string; rows: [string, { ad: number; rev: number; pnl: number; leads: number; count: number }][]; canSeeFinance: boolean }) {
  if (!rows.length) return <div className="card" style={{ padding: 24 }}>No data.</div>;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th style={th}>{label}</th>
            <th style={thR}>Sessions</th>
            <th style={thR}>Leads</th>
            {canSeeFinance && <th style={thR}>Ad Spend</th>}
            {canSeeFinance && <th style={thR}>Revenue</th>}
            {canSeeFinance && <th style={thR}>PNL</th>}
            {canSeeFinance && <th style={thR}>Avg ROAS</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, v]) => (
            <tr key={name} style={{ borderBottom: "1px solid var(--rule-soft, #eee)" }}>
              <td style={td}>{name}</td>
              <td style={tdR}>{v.count}</td>
              <td style={tdR}>{inr(v.leads)}</td>
              {canSeeFinance && <td style={tdR}>₹{inr(v.ad)}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(v.rev)}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(v.pnl)}</td>}
              {canSeeFinance && <td style={tdR}>{v.ad > 0 ? (v.rev / v.ad).toFixed(2) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendsView({ rows, canSeeFinance }: { rows: RoasSession[]; canSeeFinance: boolean }) {
  const byMonth = new Map<string, { rev: number; ad: number; pnl: number; leads: number; count: number }>();
  for (const r of rows) {
    const m = (r.campaign_date_to ?? r.created_at).slice(0, 7);
    const v = byMonth.get(m) ?? { rev: 0, ad: 0, pnl: 0, leads: 0, count: 0 };
    v.rev += Number(r.total_revenue || 0);
    v.ad += Number(r.ad_spend || 0);
    v.pnl += Number(r.pnl || 0);
    v.leads += Number(r.leads || 0);
    v.count += 1;
    byMonth.set(m, v);
  }
  const months = Array.from(byMonth.entries()).sort();
  if (!months.length) return <div className="card" style={{ padding: 24 }}>No data yet.</div>;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th style={th}>Month</th>
            <th style={thR}>Sessions</th>
            <th style={thR}>Leads</th>
            {canSeeFinance && <th style={thR}>Ad Spend</th>}
            {canSeeFinance && <th style={thR}>Revenue</th>}
            {canSeeFinance && <th style={thR}>PNL</th>}
            {canSeeFinance && <th style={thR}>ROAS</th>}
            {canSeeFinance && <th style={thR}>CPL</th>}
          </tr>
        </thead>
        <tbody>
          {months.map(([m, v]) => (
            <tr key={m} style={{ borderBottom: "1px solid var(--rule-soft, #eee)" }}>
              <td style={td}>{m}</td>
              <td style={tdR}>{v.count}</td>
              <td style={tdR}>{inr(v.leads)}</td>
              {canSeeFinance && <td style={tdR}>₹{inr(v.ad)}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(v.rev)}</td>}
              {canSeeFinance && <td style={tdR}>₹{inr(v.pnl)}</td>}
              {canSeeFinance && <td style={tdR}>{v.ad > 0 ? (v.rev / v.ad).toFixed(2) : "—"}</td>}
              {canSeeFinance && <td style={tdR}>{v.leads > 0 ? `₹${inr(v.ad / v.leads)}` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrashTable({ rows, admin, canSeeFinance, onRestore }: { rows: RoasSession[]; admin: boolean; canSeeFinance: boolean; onRestore: (id: string) => void; }) {
  if (!admin) return <div className="card" style={{ padding: 24 }}>Trash is admin/manager only.</div>;
  if (!rows.length) return <div className="card" style={{ padding: 24 }}>Trash is empty.</div>;
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
            <th style={th}>Deleted</th>
            <th style={th}>Client</th>
            <th style={th}>Event</th>
            {canSeeFinance && <th style={thR}>Revenue</th>}
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--rule-soft, #eee)" }}>
              <td style={td}>{r.deleted_at?.slice(0, 10) ?? "—"}</td>
              <td style={td}>{r.client_name ?? "—"}</td>
              <td style={td}>{r.event_name ?? "—"}</td>
              {canSeeFinance && <td style={tdR}>₹{inr(r.total_revenue)}</td>}
              <td style={td}>
                <button className="btn-xs" onClick={() => onRestore(r.id)}>Restore</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
