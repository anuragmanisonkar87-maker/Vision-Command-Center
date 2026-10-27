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
  HealthPill,
  useIsNarrow,
} from "@/components/marketizers/ui";
import { useMarketizersClientDetail } from "@/hooks/marketizers/useMarketizersClientDetail";
import {
  calculateNetProfit,
  calculateProfitMargin,
  calculateClientROAS,
  calculateCPL,
  calculateCostPerSale,
  calculateLeadToSalePercent,
  calculateGrowthPercent,
  calculateCollectionPercent,
  getClientHealthStatus,
} from "@/utils/calculations/financeCalculations";
import {
  calculateClientLifetimeRevenue,
  calculateClientLifetimeProfit,
  calculateClientLifetimePending,
  calculateAverageMonthlyMargin,
  calculateOutstandingAmount,
  getDaysPending,
  getFollowupStatusLabel,
  getFollowupStatusPill,
} from "@/utils/calculations/collectionUtils";
import {
  formatINR,
  formatNumber,
  formatPercent,
  formatMonthLabel,
  formatDateIndian,
} from "@/utils/formatters/format";
import { exportToCSV } from "@/utils/export/csv";
import { softDeleteMarketizersMonthlyEntry } from "@/services/marketizers/monthlyEntriesService";
import type { CollectionFollowup, MonthlyEntry } from "@/types/marketizers";
import { FollowupDrawer } from "@/components/marketizers/FollowupDrawer";

export const Route = createFileRoute("/brands/marketizers/revenue/clients/$clientId")({
  component: () => (
    <MarketizersAccessGuard>
      <ClientDetailPage />
    </MarketizersAccessGuard>
  ),
});

type TabKey = "overview" | "entries" | "collections" | "performance" | "notes";

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useMarketizersClientDetail(clientId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [followupDraft, setFollowupDraft] = useState<Partial<CollectionFollowup> | null>(null);
  const isNarrow = useIsNarrow(820);
  const canEdit = canEditMarketizersFinance();

  useEffect(() => {
    document.title = data?.client
      ? `${data.client.client_name} | Marketizers | GWV Vision Center`
      : "Client | Marketizers | GWV Vision Center";
  }, [data?.client]);

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Marketizers Client Intelligence" title="Loading…" />
        <LoadingState rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Marketizers Client Intelligence" title="Client Detail" />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div>
        <PageHeader eyebrow="Marketizers Client Intelligence" title="Client not found" />
        <EmptyState
          icon="🔍"
          title="Client not found"
          message="This client account may have been archived or the link is incorrect."
          action={
            <Link to="/brands/marketizers/revenue/clients" className="btn-sm btn-primary">
              ← Back to Client Accounts
            </Link>
          }
        />
      </div>
    );
  }

  const { client, entries, followups } = data;
  const sortedEntries = [...entries].sort((a, b) => a.month.localeCompare(b.month));
  const lifetimeRevenue = calculateClientLifetimeRevenue(entries);
  const lifetimeProfit = calculateClientLifetimeProfit(entries);
  const lifetimePending = calculateClientLifetimePending(entries);
  const recoveredFromFollowups = followups.reduce(
    (s, f) => s + (f.amount_recovered || 0),
    0,
  );
  const netPending = Math.max(0, lifetimePending - recoveredFromFollowups);
  const avgMargin = calculateAverageMonthlyMargin(entries);

  const lastEntry = sortedEntries[sortedEntries.length - 1] ?? null;
  const prevEntry = sortedEntries[sortedEntries.length - 2] ?? null;
  const health = lastEntry ? getClientHealthStatus(lastEntry, prevEntry) : null;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "entries", label: "Monthly Entries" },
    { key: "collections", label: "Collections" },
    { key: "performance", label: "Performance" },
    { key: "notes", label: "Notes" },
  ];

  const exportEntries = () => {
    const slug = client.client_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    exportToCSV(
      `marketizers-client-${slug}-entries`,
      entries.map((e) => ({
        month: e.month,
        revenue: e.marketizers_revenue,
        collected: e.amount_collected,
        pending: e.amount_pending,
        client_gross_revenue: e.client_gross_revenue,
        ad_spend: e.ad_spend,
        leads_generated: e.leads_generated,
        qualified_leads: e.qualified_leads,
        sales_closed: e.sales_closed,
        total_direct_expense: e.total_direct_expense,
        net_profit: calculateNetProfit(e.marketizers_revenue, e.total_direct_expense),
        is_locked: e.is_locked,
      })),
    );
  };

  const exportCollections = () => {
    const slug = client.client_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    exportToCSV(
      `marketizers-client-${slug}-collections`,
      followups.map((f) => ({
        month: f.month,
        pending_amount: f.pending_amount,
        amount_recovered: f.amount_recovered,
        outstanding: calculateOutstandingAmount(f.pending_amount, f.amount_recovered),
        due_date: f.due_date,
        days_pending: getDaysPending(f.due_date) ?? "",
        owner: f.followup_owner,
        status: f.status,
        priority: f.priority,
        last_followup_date: f.last_followup_date,
        next_followup_date: f.next_followup_date,
        promise_to_pay_date: f.promise_to_pay_date,
        notes: f.notes,
      })),
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Client Intelligence"
        title={client.client_name}
        subtitle={[
          client.niche || null,
          client.revenue_model || null,
          client.start_date ? `Since ${formatDateIndian(client.start_date)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Link to="/brands/marketizers/revenue/clients" className="btn-sm">
              ← Clients
            </Link>
            <Link
              to="/brands/marketizers/revenue/clients/$clientId/ledger"
              params={{ clientId }}
              className="btn-sm"
            >
              Open Ledger
            </Link>
            <button className="btn-sm" onClick={exportEntries} disabled={!entries.length}>
              Export CSV
            </button>
            {canEdit && (
              <button
                className="btn-sm btn-primary"
                onClick={() =>
                  navigate({
                    to: "/brands/marketizers/revenue/entry",
                    search: {},
                  })
                }
              >
                + Add Monthly Entry
              </button>
            )}
          </>
        }
      />

      {/* Profile strip */}
      <div className="panel" style={{ padding: "20px 26px", marginBottom: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 18,
          }}
        >
          <ProfileField label="Founder" value={client.founder_name ?? "—"} />
          <ProfileField label="Niche" value={client.niche ?? "—"} />
          <ProfileField label="Model" value={client.revenue_model} />
          <ProfileField
            label="Status"
            value={
              <span
                className={`status-pill ${
                  client.status === "active"
                    ? "sp-profit"
                    : client.status === "trial"
                      ? "sp-warn"
                      : "sp-loss"
                }`}
              >
                {client.status}
              </span>
            }
          />
          <ProfileField label="Manager" value={client.assigned_manager ?? "—"} />
          <ProfileField
            label="Start"
            value={client.start_date ? formatDateIndian(client.start_date) : "—"}
            mono
          />
          {health && <ProfileField label="Health" value={<HealthPill status={health} />} />}
        </div>
        {client.notes && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--parchment2)" }}>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 9,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--ink4)",
                marginBottom: 6,
              }}
            >
              Notes
            </div>
            <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>
              {client.notes}
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <MetricCard
          accent="gold"
          label="Lifetime Revenue"
          value={formatINR(lifetimeRevenue)}
          delta={`Across ${entries.length} month${entries.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          accent={lifetimeProfit >= 0 ? "green" : "red"}
          label="Lifetime Net Profit"
          value={formatINR(lifetimeProfit)}
          delta={
            lifetimeRevenue
              ? `Margin ${formatPercent((lifetimeProfit / lifetimeRevenue) * 100)}`
              : "No revenue yet"
          }
          deltaTone={lifetimeProfit >= 0 ? "up" : "dn"}
        />
        <MetricCard
          accent={netPending > 0 ? "amber" : "green"}
          label="Pending Collection"
          value={formatINR(netPending)}
          delta={
            recoveredFromFollowups
              ? `Recovered ${formatINR(recoveredFromFollowups)}`
              : "No recoveries logged"
          }
          deltaTone={netPending > 0 ? "dn" : "up"}
        />
        <MetricCard
          accent={
            avgMargin === null
              ? "amber"
              : avgMargin >= 25
                ? "green"
                : avgMargin >= 10
                  ? "amber"
                  : "red"
          }
          label="Avg Monthly Margin"
          value={formatPercent(avgMargin)}
          delta={`Across ${entries.length} month${entries.length === 1 ? "" : "s"}`}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          borderBottom: "1px solid var(--border)",
          marginBottom: 22,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 14px",
              border: "none",
              background: "transparent",
              fontFamily: "'Figtree',sans-serif",
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? "var(--ink)" : "var(--ink4)",
              borderBottom: tab === t.key ? "2px solid var(--gold3)" : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab
          entries={sortedEntries}
          lastEntry={lastEntry}
          prevEntry={prevEntry}
          followups={followups}
        />
      )}
      {tab === "entries" && (
        <EntriesTab
          entries={entries}
          isNarrow={isNarrow}
          canEdit={canEdit}
          onChanged={refetch}
        />
      )}
      {tab === "collections" && (
        <CollectionsTab
          followups={followups}
          isNarrow={isNarrow}
          canEdit={canEdit}
          onAdd={() =>
            setFollowupDraft({
              client_id: client.id,
              month: new Date().toISOString().slice(0, 7),
              status: "pending",
              priority: "medium",
              pending_amount: 0,
            })
          }
          onEdit={(f) => setFollowupDraft(f)}
          onChanged={refetch}
          onExport={exportCollections}
        />
      )}
      {tab === "performance" && <PerformanceTab entries={entries} isNarrow={isNarrow} />}
      {tab === "notes" && <NotesTab client={client} entries={entries} followups={followups} />}

      {followupDraft && (
        <FollowupDrawer
          initial={followupDraft}
          fixedClientId={client.id}
          onClose={() => setFollowupDraft(null)}
          onSaved={() => {
            setFollowupDraft(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 9,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--ink4)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--ink)",
          fontFamily: mono ? "'DM Mono',monospace" : undefined,
          fontWeight: mono ? 400 : 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============== TAB: OVERVIEW ==============
function OverviewTab({
  entries,
  lastEntry,
  prevEntry,
  followups,
}: {
  entries: MonthlyEntry[];
  lastEntry: MonthlyEntry | null;
  prevEntry: MonthlyEntry | null;
  followups: CollectionFollowup[];
}) {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <RevenueTrendPanel entries={entries.slice(-6)} />
      <HealthSummaryPanel last={lastEntry} prev={prevEntry} entries={entries} />
      <RecentActivityPanel entries={entries} followups={followups} />
    </div>
  );
}

function RevenueTrendPanel({ entries }: { entries: MonthlyEntry[] }) {
  if (entries.length < 2) {
    return (
      <div className="panel">
        <div className="ph">
          <div>
            <div className="panel-title">Revenue & Profit Trend</div>
            <div className="panel-sub">Last 6 months</div>
          </div>
        </div>
        <div style={{ padding: "32px 26px", color: "var(--ink4)", fontSize: 13 }}>
          Need more months to show trend.
        </div>
      </div>
    );
  }

  const max = Math.max(
    ...entries.map((e) =>
      Math.max(
        e.marketizers_revenue || 0,
        Math.abs(calculateNetProfit(e.marketizers_revenue, e.total_direct_expense)),
      ),
    ),
    1,
  );

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <div className="panel-title">Revenue & Profit Trend</div>
          <div className="panel-sub">Last {entries.length} months · CSS-only chart</div>
        </div>
      </div>
      <div style={{ padding: "20px 26px 26px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${entries.length}, 1fr)`,
            gap: 12,
            alignItems: "end",
            height: 180,
          }}
        >
          {entries.map((e) => {
            const net = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
            const revH = ((e.marketizers_revenue || 0) / max) * 100;
            const netH = (Math.abs(net) / max) * 100;
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                    alignItems: "end",
                    height: "100%",
                  }}
                >
                  <div
                    title={`Revenue ${formatINR(e.marketizers_revenue)}`}
                    style={{
                      height: `${revH}%`,
                      background: "var(--gold3)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: 2,
                    }}
                  />
                  <div
                    title={`Net Profit ${formatINR(net)}`}
                    style={{
                      height: `${netH}%`,
                      background: net >= 0 ? "var(--green)" : "var(--red)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${entries.length}, 1fr)`,
            gap: 12,
            marginTop: 10,
          }}
        >
          {entries.map((e) => (
            <div
              key={`l-${e.id}`}
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 9.5,
                color: "var(--ink4)",
                textAlign: "center",
                letterSpacing: ".06em",
              }}
            >
              {e.month.slice(5)}/{e.month.slice(2, 4)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 11.5, color: "var(--ink3)" }}>
          <Legend color="var(--gold3)" label="Revenue" />
          <Legend color="var(--green)" label="Net Profit (positive)" />
          <Legend color="var(--red)" label="Net Loss" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function HealthSummaryPanel({
  last,
  prev,
  entries,
}: {
  last: MonthlyEntry | null;
  prev: MonthlyEntry | null;
  entries: MonthlyEntry[];
}) {
  if (!last) {
    return (
      <div className="panel" style={{ padding: 26 }}>
        <div style={{ color: "var(--ink4)", fontSize: 13 }}>
          No monthly entries yet — health summary will appear after the first month is recorded.
        </div>
      </div>
    );
  }
  const net = calculateNetProfit(last.marketizers_revenue, last.total_direct_expense);
  const margin = calculateProfitMargin(net, last.marketizers_revenue);
  const collection = calculateCollectionPercent(last.amount_collected, last.marketizers_revenue);
  const growth = prev
    ? calculateGrowthPercent(last.marketizers_revenue, prev.marketizers_revenue)
    : null;
  const roas = calculateClientROAS(last.client_gross_revenue, last.ad_spend);
  const cpl = calculateCPL(last.ad_spend, last.leads_generated);

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <div className="panel-title">Client Health Summary</div>
          <div className="panel-sub">Snapshot from {formatMonthLabel(last.month)}</div>
        </div>
        <HealthPill status={getClientHealthStatus(last, prev)} />
      </div>
      <div style={{ padding: "0 26px 22px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 14,
          }}
        >
          <KV label="Collection %" value={formatPercent(collection)} />
          <KV label="Profit Margin" value={formatPercent(margin)} />
          <KV label="Revenue Growth" value={formatPercent(growth)} />
          <KV label="Client ROAS" value={roas === null ? "—" : `${roas.toFixed(2)}x`} />
          <KV label="CPL" value={cpl === null ? "—" : formatINR(cpl)} />
          <KV label="Last month" value={formatMonthLabel(last.month)} />
          <KV label="Months tracked" value={String(entries.length)} />
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 9,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--ink4)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

type ActivityItem = { ts: string; label: string; meta?: string };
function RecentActivityPanel({
  entries,
  followups,
}: {
  entries: MonthlyEntry[];
  followups: CollectionFollowup[];
}) {
  const items: ActivityItem[] = [];
  entries.forEach((e) => {
    if (e.created_at)
      items.push({
        ts: e.created_at,
        label: `Monthly entry recorded for ${formatMonthLabel(e.month)}`,
        meta: formatINR(e.marketizers_revenue),
      });
    if (e.updated_at && e.updated_at !== e.created_at)
      items.push({
        ts: e.updated_at,
        label: `Monthly entry updated (${formatMonthLabel(e.month)})`,
      });
  });
  followups.forEach((f) => {
    if (f.created_at)
      items.push({
        ts: f.created_at,
        label: `Follow-up added — ${getFollowupStatusLabel(f.status)}`,
        meta: `${formatMonthLabel(f.month)} · ${formatINR(f.pending_amount)}`,
      });
  });
  const sorted = items
    .filter((i) => i.ts)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 8);

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <div className="panel-title">Recent Activity</div>
          <div className="panel-sub">Last {sorted.length || 0} events</div>
        </div>
      </div>
      <div style={{ padding: "0 26px 22px" }}>
        {sorted.length === 0 ? (
          <div style={{ color: "var(--ink4)", fontSize: 13, padding: "12px 0" }}>
            No activity yet.
          </div>
        ) : (
          sorted.map((it, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 0",
                borderBottom: i === sorted.length - 1 ? "none" : "1px solid var(--parchment2)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "var(--ink2)" }}>{it.label}</div>
                {it.meta && (
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10.5,
                      color: "var(--ink4)",
                      marginTop: 2,
                    }}
                  >
                    {it.meta}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10.5,
                  color: "var(--ink4)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatDateIndian(it.ts)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============== TAB: ENTRIES ==============
function EntriesTab({
  entries,
  isNarrow,
  canEdit,
  onChanged,
}: {
  entries: MonthlyEntry[];
  isNarrow: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!entries.length) {
    return (
      <EmptyState
        icon="📅"
        title="No monthly entries yet"
        message="Add the first monthly entry to start tracking this client's revenue and profit."
        action={
          canEdit ? (
            <button
              className="btn-sm btn-primary"
              onClick={() => navigate({ to: "/brands/marketizers/revenue/entry", search: {} as any })}
            >
              + Add Monthly Entry
            </button>
          ) : null
        }
      />
    );
  }

  const editEntry = (id: string) =>
    navigate({
      to: "/brands/marketizers/revenue/entry",
      search: { entry: id } as any,
    });

  const softDelete = async (id: string) => {
    if (!confirm("Soft-delete this monthly entry? It can be restored from the database.")) return;
    setBusyId(id);
    try {
      await softDeleteMarketizersMonthlyEntry(id);
      onChanged();
    } catch (e: any) {
      alert(e?.message ?? "Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (isNarrow) {
    return (
      <div>
        {entries.map((e) => {
          const net = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
          const margin = calculateProfitMargin(net, e.marketizers_revenue);
          return (
            <MobileRecordCard
              key={e.id}
              title={formatMonthLabel(e.month)}
              subtitle={e.is_locked ? "Locked" : undefined}
              fields={[
                { label: "Revenue", value: formatINR(e.marketizers_revenue), mono: true },
                { label: "Collected", value: formatINR(e.amount_collected), mono: true },
                { label: "Pending", value: formatINR(e.amount_pending), mono: true },
                { label: "Net Profit", value: formatINR(net), mono: true },
                { label: "Margin", value: formatPercent(margin), mono: true },
                { label: "Leads / Sales", value: `${e.leads_generated} / ${e.sales_closed}`, mono: true },
              ]}
              actions={
                <>
                  {canEdit && !e.is_locked && (
                    <button className="btn-sm" onClick={() => editEntry(e.id)}>Edit</button>
                  )}
                  {canEdit && (
                    <button className="btn-sm" disabled={busyId === e.id} onClick={() => softDelete(e.id)}>
                      Delete
                    </button>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="panel">
      <div style={{ padding: "0 26px" }}>
        <ScrollableTable minWidth={1080}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Month",
                  "Revenue",
                  "Collected",
                  "Pending",
                  "Client Gross",
                  "Ad Spend",
                  "Leads",
                  "Sales",
                  "Direct Exp",
                  "Net Profit",
                  "Margin",
                  "Status",
                  "Actions",
                ].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i >= 1 && i <= 10 ? "right" : i === 12 ? "right" : "left" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const net = calculateNetProfit(e.marketizers_revenue, e.total_direct_expense);
                const margin = calculateProfitMargin(net, e.marketizers_revenue);
                return (
                  <tr
                    key={e.id}
                    style={{ borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--parchment2)" }}
                  >
                    <td style={tdL}>{formatMonthLabel(e.month)}</td>
                    <td style={tdNum}>{formatINR(e.marketizers_revenue)}</td>
                    <td style={tdNum}>{formatINR(e.amount_collected)}</td>
                    <td style={tdNum}>{formatINR(e.amount_pending)}</td>
                    <td style={tdNum}>{formatINR(e.client_gross_revenue)}</td>
                    <td style={tdNum}>{formatINR(e.ad_spend)}</td>
                    <td style={tdNum}>{formatNumber(e.leads_generated)}</td>
                    <td style={tdNum}>{formatNumber(e.sales_closed)}</td>
                    <td style={tdNum}>{formatINR(e.total_direct_expense)}</td>
                    <td style={{ ...tdNum, color: net >= 0 ? "var(--green)" : "var(--red)" }}>{formatINR(net)}</td>
                    <td style={tdNum}>{formatPercent(margin)}</td>
                    <td style={tdL}>
                      <span className={`status-pill ${e.is_locked ? "sp-warn" : "sp-profit"}`}>
                        {e.is_locked ? "Locked" : "Open"}
                      </span>
                    </td>
                    <td style={{ ...tdL, textAlign: "right" }}>
                      {canEdit && !e.is_locked && (
                        <button className="btn-sm" style={{ marginRight: 6 }} onClick={() => editEntry(e.id)}>
                          Edit
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-sm" disabled={busyId === e.id} onClick={() => softDelete(e.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}

// ============== TAB: COLLECTIONS ==============
function CollectionsTab({
  followups,
  isNarrow,
  canEdit,
  onAdd,
  onEdit,
  onChanged,
  onExport,
}: {
  followups: CollectionFollowup[];
  isNarrow: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (f: CollectionFollowup) => void;
  onChanged: () => void;
  onExport: () => void;
}) {
  const totalPending = followups.reduce(
    (s, f) => s + calculateOutstandingAmount(f.pending_amount, f.amount_recovered),
    0,
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdue = followups
    .filter((f) => f.due_date && f.due_date < today && f.status !== "collected" && f.status !== "written_off")
    .reduce((s, f) => s + calculateOutstandingAmount(f.pending_amount, f.amount_recovered), 0);
  const next = followups
    .filter((f) => f.next_followup_date)
    .sort((a, b) => (a.next_followup_date! < b.next_followup_date! ? -1 : 1))[0];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <MetricCard accent={totalPending > 0 ? "amber" : "green"} label="Total Outstanding" value={formatINR(totalPending)} />
        <MetricCard accent={overdue > 0 ? "red" : "green"} label="Overdue Amount" value={formatINR(overdue)} />
        <MetricCard
          accent="gold"
          label="Next Follow-up"
          value={next ? formatDateIndian(next.next_followup_date) : "—"}
          delta={next?.followup_owner ?? undefined}
        />
        <MetricCard accent="gold" label="Records" value={String(followups.length)} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn-sm" onClick={onExport} disabled={!followups.length}>
          Export CSV
        </button>
        {canEdit && (
          <button className="btn-sm btn-primary" onClick={onAdd}>
            + Add Follow-up
          </button>
        )}
      </div>

      {!followups.length ? (
        <EmptyState
          icon="✅"
          title="No pending collection for this client"
          message="All payments are settled or no follow-ups have been recorded."
        />
      ) : isNarrow ? (
        <div>
          {followups.map((f) => (
            <FollowupCard key={f.id} f={f} canEdit={canEdit} onEdit={onEdit} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <div style={{ padding: "0 26px" }}>
            <ScrollableTable minWidth={1080}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Month", "Pending", "Recovered", "Outstanding", "Due", "Days", "Owner", "Status", "Priority", "Next FU", "Actions"].map(
                      (h, i) => (
                        <th key={h} style={{ ...thStyle, textAlign: i >= 1 && i <= 5 ? "right" : i === 10 ? "right" : "left" }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {followups.map((f, i) => {
                    const outstanding = calculateOutstandingAmount(f.pending_amount, f.amount_recovered);
                    const days = getDaysPending(f.due_date);
                    return (
                      <tr
                        key={f.id}
                        style={{ borderBottom: i === followups.length - 1 ? "none" : "1px solid var(--parchment2)" }}
                      >
                        <td style={tdL}>{formatMonthLabel(f.month)}</td>
                        <td style={tdNum}>{formatINR(f.pending_amount)}</td>
                        <td style={tdNum}>{formatINR(f.amount_recovered)}</td>
                        <td style={tdNum}>{formatINR(outstanding)}</td>
                        <td style={tdNum}>{formatDateIndian(f.due_date)}</td>
                        <td style={tdNum}>{days === null ? "—" : days > 0 ? `${days}d` : "—"}</td>
                        <td style={tdL}>{f.followup_owner ?? "—"}</td>
                        <td style={tdL}>
                          <span className={`status-pill ${getFollowupStatusPill(f.status)}`}>
                            {getFollowupStatusLabel(f.status)}
                          </span>
                        </td>
                        <td style={tdL}>{f.priority}</td>
                        <td style={tdL}>{formatDateIndian(f.next_followup_date)}</td>
                        <td style={{ ...tdL, textAlign: "right" }}>
                          {canEdit && (
                            <button className="btn-sm" onClick={() => onEdit(f)}>
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowupCard({
  f,
  canEdit,
  onEdit,
}: {
  f: CollectionFollowup;
  canEdit: boolean;
  onEdit: (f: CollectionFollowup) => void;
  onChanged: () => void;
}) {
  const outstanding = calculateOutstandingAmount(f.pending_amount, f.amount_recovered);
  const days = getDaysPending(f.due_date);
  return (
    <MobileRecordCard
      title={formatMonthLabel(f.month)}
      subtitle={
        <span className={`status-pill ${getFollowupStatusPill(f.status)}`}>
          {getFollowupStatusLabel(f.status)}
        </span>
      }
      fields={[
        { label: "Outstanding", value: formatINR(outstanding), mono: true },
        { label: "Pending", value: formatINR(f.pending_amount), mono: true },
        { label: "Recovered", value: formatINR(f.amount_recovered), mono: true },
        { label: "Due", value: formatDateIndian(f.due_date), mono: true },
        { label: "Days", value: days === null ? "—" : days > 0 ? `${days}d` : "—", mono: true },
        { label: "Owner", value: f.followup_owner ?? "—" },
        { label: "Priority", value: f.priority },
        { label: "Next FU", value: formatDateIndian(f.next_followup_date), mono: true },
      ]}
      actions={canEdit ? <button className="btn-sm" onClick={() => onEdit(f)}>Edit</button> : null}
    />
  );
}

// ============== TAB: PERFORMANCE ==============
function PerformanceTab({ entries, isNarrow }: { entries: MonthlyEntry[]; isNarrow: boolean }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon="📈"
        title="No performance data yet"
        message="Add monthly entries with leads, sales, and ad spend to populate performance metrics."
      />
    );
  }
  const totalAd = entries.reduce((s, e) => s + (e.ad_spend || 0), 0);
  const totalLeads = entries.reduce((s, e) => s + (e.leads_generated || 0), 0);
  const totalQ = entries.reduce((s, e) => s + (e.qualified_leads || 0), 0);
  const totalSales = entries.reduce((s, e) => s + (e.sales_closed || 0), 0);
  const totalGross = entries.reduce((s, e) => s + (e.client_gross_revenue || 0), 0);
  const avgCPL = totalLeads ? totalAd / totalLeads : null;
  const avgROAS = totalAd ? totalGross / totalAd : null;
  const leadToSale = totalLeads ? (totalSales / totalLeads) * 100 : null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <MetricCard accent="gold" label="Average CPL" value={avgCPL === null ? "—" : formatINR(avgCPL)} />
        <MetricCard accent="green" label="Average ROAS" value={avgROAS === null ? "—" : `${avgROAS.toFixed(2)}x`} />
        <MetricCard accent="gold" label="Lead → Sale %" value={formatPercent(leadToSale)} />
        <MetricCard accent="gold" label="Total Leads" value={formatNumber(totalLeads)} />
        <MetricCard accent="green" label="Total Sales" value={formatNumber(totalSales)} />
        <MetricCard accent="amber" label="Total Ad Spend" value={formatINR(totalAd)} />
      </div>

      {isNarrow ? (
        <div>
          {entries.map((e) => (
            <MobileRecordCard
              key={e.id}
              title={formatMonthLabel(e.month)}
              fields={[
                { label: "Ad Spend", value: formatINR(e.ad_spend), mono: true },
                { label: "Leads", value: formatNumber(e.leads_generated), mono: true },
                { label: "Qualified", value: formatNumber(e.qualified_leads), mono: true },
                { label: "Sales", value: formatNumber(e.sales_closed), mono: true },
                { label: "CPL", value: formatINR(calculateCPL(e.ad_spend, e.leads_generated)), mono: true },
                { label: "Cost/Sale", value: formatINR(calculateCostPerSale(e.ad_spend, e.sales_closed)), mono: true },
                { label: "ROAS", value: (() => { const r = calculateClientROAS(e.client_gross_revenue, e.ad_spend); return r === null ? "—" : `${r.toFixed(2)}x`; })(), mono: true },
                { label: "L→S %", value: formatPercent(calculateLeadToSalePercent(e.sales_closed, e.leads_generated)), mono: true },
              ]}
            />
          ))}
        </div>
      ) : (
        <div className="panel">
          <div style={{ padding: "0 26px" }}>
            <ScrollableTable minWidth={920}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Month", "Ad Spend", "Leads", "Qualified", "Sales", "CPL", "Cost/Sale", "ROAS", "L→S %"].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i === 0 ? "left" : "right" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => {
                    const r = calculateClientROAS(e.client_gross_revenue, e.ad_spend);
                    return (
                      <tr
                        key={e.id}
                        style={{ borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--parchment2)" }}
                      >
                        <td style={tdL}>{formatMonthLabel(e.month)}</td>
                        <td style={tdNum}>{formatINR(e.ad_spend)}</td>
                        <td style={tdNum}>{formatNumber(e.leads_generated)}</td>
                        <td style={tdNum}>{formatNumber(e.qualified_leads)}</td>
                        <td style={tdNum}>{formatNumber(e.sales_closed)}</td>
                        <td style={tdNum}>{formatINR(calculateCPL(e.ad_spend, e.leads_generated))}</td>
                        <td style={tdNum}>{formatINR(calculateCostPerSale(e.ad_spend, e.sales_closed))}</td>
                        <td style={tdNum}>{r === null ? "—" : `${r.toFixed(2)}x`}</td>
                        <td style={tdNum}>{formatPercent(calculateLeadToSalePercent(e.sales_closed, e.leads_generated))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== TAB: NOTES ==============
function NotesTab({
  client,
  entries,
  followups,
}: {
  client: { notes: string | null };
  entries: MonthlyEntry[];
  followups: CollectionFollowup[];
}) {
  const entryNotes = entries.filter((e) => e.notes);
  const followupNotes = followups.filter((f) => f.notes);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="panel" style={{ padding: 22 }}>
        <SectionTitle>Client Notes</SectionTitle>
        <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>
          {client.notes || <span style={{ color: "var(--ink4)" }}>No client notes yet.</span>}
        </div>
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <SectionTitle>Monthly Entry Notes</SectionTitle>
        {!entryNotes.length ? (
          <div style={{ color: "var(--ink4)", fontSize: 13 }}>None.</div>
        ) : (
          entryNotes.map((e) => (
            <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--parchment2)" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)", marginBottom: 4 }}>
                {formatMonthLabel(e.month)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink2)" }}>{e.notes}</div>
            </div>
          ))
        )}
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <SectionTitle>Follow-up Notes</SectionTitle>
        {!followupNotes.length ? (
          <div style={{ color: "var(--ink4)", fontSize: 13 }}>None.</div>
        ) : (
          followupNotes.map((f) => (
            <div key={f.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--parchment2)" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)", marginBottom: 4 }}>
                {formatMonthLabel(f.month)} · {getFollowupStatusLabel(f.status)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink2)" }}>{f.notes}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 18,
        fontWeight: 700,
        color: "var(--ink)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

// ============== styles ==============
const thStyle: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 8.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink4)",
  padding: "12px 8px 12px 0",
  borderBottom: "1px solid var(--border)",
  fontWeight: 400,
};
const tdL: React.CSSProperties = { padding: "12px 8px 12px 0", fontSize: 13, color: "var(--ink2)" };
const tdNum: React.CSSProperties = {
  ...tdL,
  textAlign: "right",
  fontFamily: "'DM Mono',monospace",
  fontSize: 12,
  color: "var(--ink2)",
};
