import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarketizersAccessGuard, canEditMarketizersFinance } from "@/components/marketizers/MarketizersAccessGuard";
import {
  PageHeader,
  MetricCard,
  EmptyState,
  ErrorBanner,
  LoadingState,
  ScrollableTable,
  MobileRecordCard,
  useIsNarrow,
  inputStyle,
  FieldLabel,
} from "@/components/marketizers/ui";
import { FollowupDrawer } from "@/components/marketizers/FollowupDrawer";
import { useMarketizersCollections } from "@/hooks/marketizers/useMarketizersCollections";
import {
  markCollectionAsCollected,
  markCollectionAsFollowedUp,
  markCollectionAsPromised,
  markCollectionAsPartiallyCollected,
  softDeleteCollectionFollowup,
  backfillFollowupsFromPendingEntries,
  countPendingEntriesWithoutFollowup,
} from "@/services/marketizers/collectionFollowupsService";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import {
  calculateOutstandingAmount,
  getCollectionRiskLevel,
  getDaysPending,
  getFollowupStatusLabel,
  getFollowupStatusPill,
} from "@/utils/calculations/collectionUtils";
import { formatINR, formatDateIndian, formatMonthLabel } from "@/utils/formatters/format";
import { exportToCSV } from "@/utils/export/csv";
import type { Client, CollectionFollowup, FollowupPriority, FollowupStatus } from "@/types/marketizers";

export const Route = createFileRoute("/brands/marketizers/revenue/collections")({
  component: () => (
    <MarketizersAccessGuard>
      <CollectionsPage />
    </MarketizersAccessGuard>
  ),
});

const STATUSES: FollowupStatus[] = [
  "pending", "followed_up", "promised", "partially_collected",
  "collected", "disputed", "overdue", "written_off",
];
const PRIORITIES: FollowupPriority[] = ["low", "medium", "high", "urgent"];

function CollectionsPage() {
  const navigate = useNavigate();
  const { rows, loading, error, refetch, filters, updateFilter, clearFilters } = useMarketizersCollections();
  const [clients, setClients] = useState<Client[]>([]);
  const [drawer, setDrawer] = useState<Partial<CollectionFollowup> | null>(null);
  const [pendingNoFu, setPendingNoFu] = useState(0);
  const [page, setPage] = useState(0);
  const isNarrow = useIsNarrow(900);
  const canEdit = canEditMarketizersFinance();
  const PAGE_SIZE = 25;

  useEffect(() => {
    document.title = "Pending Collections | Marketizers | GWV Vision Center";
    void getMarketizersClients().then(setClients).catch(() => {});
    void countPendingEntriesWithoutFollowup().then(setPendingNoFu).catch(() => {});
  }, []);

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.client_name]));
    return (id: string) => map.get(id) ?? "—";
  }, [clients]);

  const today = new Date().toISOString().slice(0, 10);
  const totalPending = rows.reduce((s, f) => s + calculateOutstandingAmount(f.pending_amount, f.amount_recovered), 0);
  const overdueAmt = rows
    .filter((f) => f.due_date && f.due_date < today && f.status !== "collected" && f.status !== "written_off")
    .reduce((s, f) => s + calculateOutstandingAmount(f.pending_amount, f.amount_recovered), 0);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueWeek = rows
    .filter((f) => (f.next_followup_date && f.next_followup_date <= in7) || (f.due_date && f.due_date <= in7 && f.due_date >= today))
    .reduce((s, f) => s + calculateOutstandingAmount(f.pending_amount, f.amount_recovered), 0);
  const collectedThisMonth = rows
    .filter((f) => (f.status === "collected" || f.status === "partially_collected") && (!filters.month || f.month === filters.month))
    .reduce((s, f) => s + (f.amount_recovered || 0), 0);

  const buckets = useMemo(() => {
    const high: CollectionFollowup[] = [], medium: CollectionFollowup[] = [], low: CollectionFollowup[] = [];
    rows.forEach((f) => {
      const r = getCollectionRiskLevel(f);
      if (r === "high") high.push(f);
      else if (r === "medium") medium.push(f);
      else if (r === "low") low.push(f);
    });
    return { high, medium, low };
  }, [rows]);

  const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const handleMarkCollected = async (f: CollectionFollowup) => {
    const input = prompt(`Recovered amount for ${clientName(f.client_id)} (${formatMonthLabel(f.month)})?`, String(f.pending_amount));
    if (input === null) return;
    const amt = Number(input);
    if (!Number.isFinite(amt) || amt < 0) { alert("Invalid amount."); return; }
    try {
      await markCollectionAsCollected(f.id, amt);
      refetch();
    } catch (e: any) { alert(e?.message ?? "Failed."); }
  };

  const handleMarkFollowedUp = async (f: CollectionFollowup) => {
    const channel = prompt("Communication channel? (Call / WhatsApp / Email / Meeting / Other)", f.communication_channel ?? "Call");
    if (channel === null) return;
    const next = prompt("Next follow-up date (YYYY-MM-DD, optional)", f.next_followup_date ?? "") ?? "";
    try {
      await markCollectionAsFollowedUp(f.id, { channel: channel || null, notes: f.notes, nextFollowupDate: next || null });
      refetch();
    } catch (e: any) { alert(e?.message ?? "Failed."); }
  };

  const handleMarkPromised = async (f: CollectionFollowup) => {
    const date = prompt("Promise-to-pay date (YYYY-MM-DD)", f.promise_to_pay_date ?? "");
    if (!date) return;
    try {
      await markCollectionAsPromised(f.id, date, f.notes ?? undefined);
      refetch();
    } catch (e: any) { alert(e?.message ?? "Failed."); }
  };

  const handleMarkPartial = async (f: CollectionFollowup) => {
    const input = prompt(`Partial amount recovered for ${clientName(f.client_id)}?`, String(f.amount_recovered || ""));
    if (input === null) return;
    const amt = Number(input);
    if (!Number.isFinite(amt) || amt <= 0) { alert("Enter an amount greater than zero."); return; }
    try {
      await markCollectionAsPartiallyCollected(f.id, amt);
      refetch();
    } catch (e: any) { alert(e?.message ?? "Failed."); }
  };

  const handleDelete = async (f: CollectionFollowup) => {
    if (!confirm("You are about to delete this follow-up record. It will be hidden from normal views but preserved in history.")) return;
    try { await softDeleteCollectionFollowup(f.id); refetch(); }
    catch (e: any) { alert(e?.message ?? "Delete failed."); }
  };

  const handleBackfill = async () => {
    try {
      const n = await backfillFollowupsFromPendingEntries();
      alert(`${n} follow-up record${n === 1 ? "" : "s"} created.`);
      setPendingNoFu(0);
      refetch();
    } catch (e: any) { alert(e?.message ?? "Backfill failed."); }
  };

  const handleExport = () => {
    exportToCSV(`marketizers-pending-collections-${filters.month ?? "all"}`, rows.map((f) => ({
      client: clientName(f.client_id),
      month: f.month,
      pending_amount: f.pending_amount,
      amount_recovered: f.amount_recovered,
      outstanding: calculateOutstandingAmount(f.pending_amount, f.amount_recovered),
      due_date: f.due_date,
      days_pending: getDaysPending(f.due_date) ?? "",
      owner: f.followup_owner,
      status: f.status,
      priority: f.priority,
      next_followup: f.next_followup_date,
      notes: f.notes,
    })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Collection Control"
        title="Pending Collections"
        subtitle="Track outstanding client payments, follow-up status, due dates, and collection risk."
        actions={
          <>
            <button className="btn-sm" onClick={handleExport} disabled={!rows.length}>Export CSV</button>
            {canEdit && <button className="btn-sm btn-primary" onClick={() => setDrawer({ status: "pending", priority: "medium", month: new Date().toISOString().slice(0, 7) })}>+ Add Follow-up</button>}
          </>
        }
      />

      {pendingNoFu > 0 && canEdit && (
        <div style={{ marginBottom: 18, padding: "12px 16px", background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ink2)" }}>
            {pendingNoFu} pending entr{pendingNoFu === 1 ? "y does" : "ies do"} not have follow-up records yet.
          </span>
          <button className="btn-sm btn-primary" onClick={handleBackfill}>Create Follow-up Records</button>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Filters */}
      <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
          <div><FieldLabel>Month</FieldLabel><input type="month" style={inputStyle} value={filters.month ?? ""} onChange={(e) => updateFilter("month", e.target.value || undefined)} /></div>
          <div><FieldLabel>Client</FieldLabel>
            <select style={inputStyle} value={filters.clientId ?? ""} onChange={(e) => updateFilter("clientId", e.target.value || undefined)}>
              <option value="">All</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </div>
          <div><FieldLabel>Status</FieldLabel>
            <select style={inputStyle} value={filters.status ?? "all"} onChange={(e) => updateFilter("status", e.target.value as any)}>
              <option value="all">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><FieldLabel>Priority</FieldLabel>
            <select style={inputStyle} value={filters.priority ?? "all"} onChange={(e) => updateFilter("priority", e.target.value as any)}>
              <option value="all">All</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><FieldLabel>Owner</FieldLabel><input style={inputStyle} value={filters.followupOwner ?? ""} onChange={(e) => updateFilter("followupOwner", e.target.value || undefined)} placeholder="Owner name" /></div>
          <div><FieldLabel>Due From</FieldLabel><input type="date" style={inputStyle} value={filters.dueFrom ?? ""} onChange={(e) => updateFilter("dueFrom", e.target.value || undefined)} /></div>
          <div><FieldLabel>Due To</FieldLabel><input type="date" style={inputStyle} value={filters.dueTo ?? ""} onChange={(e) => updateFilter("dueTo", e.target.value || undefined)} /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={!!filters.overdueOnly} onChange={(e) => updateFilter("overdueOnly", e.target.checked || undefined)} />
              Overdue only
            </label>
            <button className="btn-sm" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
        <MetricCard accent={totalPending > 0 ? "amber" : "green"} label="Total Outstanding" value={formatINR(totalPending)} />
        <MetricCard accent={overdueAmt > 0 ? "red" : "green"} label="Overdue Amount" value={formatINR(overdueAmt)} />
        <MetricCard accent="gold" label="Due This Week" value={formatINR(dueWeek)} />
        <MetricCard accent="green" label="Collected" value={formatINR(collectedThisMonth)} delta={filters.month ? formatMonthLabel(filters.month) : "All time"} />
      </div>

      {/* Risk Board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 18 }}>
        <RiskColumn title="High Risk" tone="red" items={buckets.high} clientName={clientName} onAction={(f) => setDrawer(f)} />
        <RiskColumn title="Medium Risk" tone="amber" items={buckets.medium} clientName={clientName} onAction={(f) => setDrawer(f)} />
        <RiskColumn title="Low Risk" tone="green" items={buckets.low} clientName={clientName} onAction={(f) => setDrawer(f)} />
      </div>

      {/* Table / Cards */}
      {loading ? (
        <LoadingState rows={5} />
      ) : !rows.length ? (
        <EmptyState
          icon="✅"
          title="No pending collections"
          message="There are no outstanding client payments for the selected filters."
          action={<Link to="/brands/marketizers/revenue" className="btn-sm btn-primary">Back to Marketizers Dashboard</Link>}
        />
      ) : isNarrow ? (
        <div>
          {paged.map((f) => (
            <MobileRecordCard
              key={f.id}
              title={clientName(f.client_id)}
              subtitle={<span className={`status-pill ${getFollowupStatusPill(f.status)}`}>{getFollowupStatusLabel(f.status)}</span>}
              fields={[
                { label: "Month", value: formatMonthLabel(f.month), mono: true },
                { label: "Outstanding", value: formatINR(calculateOutstandingAmount(f.pending_amount, f.amount_recovered)), mono: true },
                { label: "Due", value: formatDateIndian(f.due_date), mono: true },
                { label: "Owner", value: f.followup_owner ?? "—" },
                { label: "Priority", value: f.priority },
                { label: "Next FU", value: formatDateIndian(f.next_followup_date), mono: true },
              ]}
              actions={
                <>
                  <button className="btn-sm" onClick={() => navigate({ to: "/brands/marketizers/revenue/clients/$clientId", params: { clientId: f.client_id } })}>View Client</button>
                  {canEdit && <button className="btn-sm" onClick={() => setDrawer(f)}>Edit</button>}
                  {canEdit && <button className="btn-sm" onClick={() => handleMarkFollowedUp(f)}>Followed Up</button>}
                  {canEdit && <button className="btn-sm" onClick={() => handleMarkPromised(f)}>Promised</button>}
                  {canEdit && <button className="btn-sm" onClick={() => handleMarkPartial(f)}>Partial</button>}
                  {canEdit && <button className="btn-sm" onClick={() => handleMarkCollected(f)}>Collected</button>}
                  {canEdit && <button className="btn-sm" onClick={() => handleDelete(f)}>Delete</button>}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <div className="panel">
          <div style={{ padding: "0 26px" }}>
            <ScrollableTable minWidth={1200}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Client", "Month", "Pending", "Recovered", "Outstanding", "Due", "Days", "Owner", "Status", "Priority", "Next FU", "Actions"].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i >= 2 && i <= 6 ? "right" : i === 11 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((f, i) => {
                    const out = calculateOutstandingAmount(f.pending_amount, f.amount_recovered);
                    const days = getDaysPending(f.due_date);
                    return (
                      <tr key={f.id} style={{ borderBottom: i === paged.length - 1 ? "none" : "1px solid var(--parchment2)" }}>
                        <td style={tdL}>
                          <Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: f.client_id }} style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "none" }}>
                            {clientName(f.client_id)}
                          </Link>
                        </td>
                        <td style={tdL}>{formatMonthLabel(f.month)}</td>
                        <td style={tdNum}>{formatINR(f.pending_amount)}</td>
                        <td style={tdNum}>{formatINR(f.amount_recovered)}</td>
                        <td style={tdNum}>{formatINR(out)}</td>
                        <td style={tdNum}>{formatDateIndian(f.due_date)}</td>
                        <td style={tdNum}>{days === null ? "—" : days > 0 ? `${days}d` : "—"}</td>
                        <td style={tdL}>{f.followup_owner ?? "—"}</td>
                        <td style={tdL}><span className={`status-pill ${getFollowupStatusPill(f.status)}`}>{getFollowupStatusLabel(f.status)}</span></td>
                        <td style={tdL}>{f.priority}</td>
                        <td style={tdL}>{formatDateIndian(f.next_followup_date)}</td>
                        <td style={{ ...tdL, textAlign: "right", whiteSpace: "nowrap" }}>
                          {canEdit && <button className="btn-sm" style={{ marginRight: 4 }} onClick={() => setDrawer(f)}>Edit</button>}
                          {canEdit && <button className="btn-sm" style={{ marginRight: 4 }} onClick={() => handleMarkFollowedUp(f)}>FU</button>}
                          {canEdit && <button className="btn-sm" style={{ marginRight: 4 }} onClick={() => handleMarkPromised(f)}>Promise</button>}
                          {canEdit && <button className="btn-sm" style={{ marginRight: 4 }} onClick={() => handleMarkPartial(f)}>Partial</button>}
                          {canEdit && <button className="btn-sm" style={{ marginRight: 4 }} onClick={() => handleMarkCollected(f)}>Collected</button>}
                          {canEdit && <button className="btn-sm" onClick={() => handleDelete(f)}>Delete</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
            {pageCount > 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 0" }}>
                <button className="btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span style={{ fontSize: 12, color: "var(--ink4)", alignSelf: "center" }}>{page + 1} / {pageCount}</span>
                <button className="btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {drawer && (
        <FollowupDrawer
          initial={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); refetch(); void countPendingEntriesWithoutFollowup().then(setPendingNoFu); }}
        />
      )}
    </div>
  );
}

function RiskColumn({
  title, tone, items, clientName, onAction,
}: {
  title: string;
  tone: "red" | "amber" | "green";
  items: CollectionFollowup[];
  clientName: (id: string) => string;
  onAction: (f: CollectionFollowup) => void;
}) {
  const accent = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "var(--green)";
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700 }}>{title}</div>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: accent }}>{items.length}</span>
      </div>
      {!items.length ? (
        <div style={{ fontSize: 12, color: "var(--ink4)", padding: "8px 0" }}>None.</div>
      ) : (
        items.slice(0, 6).map((f) => (
          <div key={f.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--parchment2)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName(f.client_id)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "var(--ink4)", marginTop: 2 }}>
                {formatMonthLabel(f.month)} · {formatINR(calculateOutstandingAmount(f.pending_amount, f.amount_recovered))}
                {f.followup_owner ? ` · ${f.followup_owner}` : ""}
              </div>
            </div>
            <button className="btn-sm" onClick={() => onAction(f)} style={{ flexShrink: 0 }}>Follow-up</button>
          </div>
        ))
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 0", borderBottom: "1px solid var(--border)", fontWeight: 400 };
const tdL: React.CSSProperties = { padding: "12px 8px 12px 0", fontSize: 13, color: "var(--ink2)" };
const tdNum: React.CSSProperties = { ...tdL, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 };
