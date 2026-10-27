import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  getMarketizersClients,
  getAllMarketizersClients,
  softDeleteMarketizersClient,
  restoreMarketizersClient,
} from "@/services/marketizers/clientsService";
import { MarketizersAccessGuard, canEditMarketizersFinance } from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, FieldLabel, inputStyle, ErrorBanner, EmptyState, LoadingState, ScrollableTable, MobileRecordCard, useIsNarrow } from "@/components/marketizers/ui";
import { type Client, exportToCSV } from "@/lib/marketizersFinanceUtils";
import { ClientDeleteDialog } from "@/components/marketizers/ClientDeleteDialog";
import { toast } from "sonner";

const AddClientDrawer = lazy(() =>
  import("@/components/marketizers/AddClientDrawer").then((m) => ({ default: m.AddClientDrawer })),
);

import { cached, invalidateCache } from "@/lib/cacheTtl";

export const Route = createFileRoute("/brands/marketizers/revenue/clients")({
  validateSearch: (s: Record<string, unknown>): { addClient?: string } => {
    const out: { addClient?: string } = {};
    if (s.addClient === "1" || s.addClient === 1 || s.addClient === true) out.addClient = "1";
    return out;
  },
  loader: () => {
    void cached("mz:clients", () => getMarketizersClients());
  },
  component: () => (
    <MarketizersAccessGuard>
      <ClientAccountsRoute />
    </MarketizersAccessGuard>
  ),
});

const STATUSES = ["active", "paused", "closed", "trial"];

function ClientAccountsRoute() {
  const location = useLocation();
  return location.pathname === "/brands/marketizers/revenue/clients" ? <ClientAccountsPage /> : <Outlet />;
}

function ClientAccountsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewFilter, setViewFilter] = useState<"active" | "deleted" | "all">("active");
  const [drawerClient, setDrawerClient] = useState<Client | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const isNarrow = useIsNarrow(820);
  const canEdit = canEditMarketizersFinance();

  useEffect(() => { document.title = "Client Accounts | Marketizers | GWV Vision Center"; }, []);

  // Auto-open Add Client drawer when arriving with ?addClient=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("addClient") === "1" && canEdit) {
      setDrawerClient(null);
      setDrawerOpen(true);
      params.delete("addClient");
      const next = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
    }
  }, [canEdit]);

  const load = async (force = false) => {
    setLoading(true); setError(null);
    try {
      if (force) invalidateCache("mz:clients");
      const data = viewFilter === "active"
        ? await cached("mz:clients", () => getMarketizersClients())
        : await cached("mz:clients:all", () => getAllMarketizersClients());
      setClients(data);
    } catch (e: any) {
      setError(e?.message ?? "Could not load clients.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [viewFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (viewFilter === "deleted" && !c.is_deleted) return false;
      if (viewFilter === "all") { /* show all */ }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = [c.client_name, c.founder_name, c.niche, c.revenue_model]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, search, statusFilter, viewFilter]);

  const openNew = () => { setDrawerClient(null); setDrawerOpen(true); };
  const openEdit = (c: Client) => { setDrawerClient(c); setDrawerOpen(true); };

  const confirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await softDeleteMarketizersClient(deleteTarget.id, reason);
      toast.success(`"${deleteTarget.client_name}" deleted. Finance history preserved.`);
      setDeleteTarget(null);
      load(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed.");
    }
  };

  const restore = async (c: Client) => {
    try {
      await restoreMarketizersClient(c.id);
      toast.success(`"${c.client_name}" restored.`);
      load(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Restore failed.");
    }
  };

  const handleExport = () => {
    exportToCSV("marketizers-clients", filtered.map((c) => ({
      client_name: c.client_name, founder: c.founder_name ?? "", niche: c.niche ?? "",
      revenue_model: c.revenue_model, status: c.status,
      assigned_manager: c.assigned_manager ?? "", start_date: c.start_date ?? "",
    })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Marketizers Master Data"
        title="Client Accounts"
        subtitle="Manage reusable client and partner accounts used in monthly revenue tracking."
        actions={
          <>
            <input style={{ ...inputStyle, width: 220, padding: "6px 10px", fontSize: 12 }} placeholder="Search name, founder, niche…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select-mini" value={viewFilter} onChange={(e) => setViewFilter(e.target.value as any)}>
              <option value="active">Active only</option>
              <option value="deleted">Deleted only</option>
              <option value="all">All (incl. deleted)</option>
            </select>
            <select className="select-mini" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-sm" onClick={handleExport} disabled={!filtered.length}>Export CSV</button>
            {canEdit && <button className="btn-sm btn-primary" onClick={openNew}>+ Add Client</button>}
          </>
        }
      />

      {error && <ErrorBanner message={`Could not load client accounts. ${error}`} onRetry={load} />}

      <div className="panel">
        <div style={{ padding: "0 26px" }}>
          {loading ? (
            <LoadingState rows={4} />
          ) : !filtered.length ? (
            <div style={{ padding: "32px 0" }}>
              <EmptyState
                icon="👥"
                title="No client accounts yet"
                message="Add your first Marketizers client to start monthly revenue tracking."
                action={canEdit ? <button className="btn-sm btn-primary" onClick={openNew}>+ Add Client</button> : null}
              />
            </div>
          ) : isNarrow ? (
            <div style={{ padding: "16px 0" }}>
              {filtered.map((c) => (
                <MobileRecordCard
                  key={c.id}
                  title={c.client_name}
                  subtitle={c.founder_name ?? c.niche ?? undefined}
                  fields={[
                    { label: "Niche", value: c.niche ?? "—" },
                    { label: "Model", value: <span className="status-pill sp-warn">{c.revenue_model}</span> },
                    { label: "Status", value: <span className={`status-pill ${c.status === "active" ? "sp-profit" : c.status === "trial" ? "sp-warn" : "sp-loss"}`}>{c.status}</span> },
                    { label: "Manager", value: c.assigned_manager ?? "—" },
                    { label: "Start", value: c.start_date ?? "—", mono: true },
                  ]}
                  actions={
                    <>
                      <button className="btn-sm" onClick={() => navigate({ to: "/brands/marketizers/revenue/clients/$clientId", params: { clientId: c.id } })}>Details</button>
                      {canEdit && !c.is_deleted && <button className="btn-sm" onClick={() => openEdit(c)}>Edit</button>}
                      {canEdit && !c.is_deleted && <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(c)}>Delete</button>}
                      {canEdit && c.is_deleted && <button className="btn-sm" onClick={() => restore(c)}>Restore</button>}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <ScrollableTable minWidth={860}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Client", "Founder", "Niche", "Revenue Model", "Status", "Manager", "Start", "Actions"].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i >= 6 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i === filtered.length - 1 ? "none" : "1px solid var(--parchment2)" }}>
                      <td style={tdL}>
                        <Link to="/brands/marketizers/revenue/clients/$clientId" params={{ clientId: c.id }} style={{ textDecoration: "none" }}>
                          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{c.client_name}</div>
                        </Link>
                      </td>
                      <td style={tdL}>{c.founder_name ?? "—"}</td>
                      <td style={tdL}>{c.niche ?? "—"}</td>
                      <td style={tdL}><span className="status-pill sp-warn">{c.revenue_model}</span></td>
                      <td style={tdL}>
                        <span className={`status-pill ${c.status === "active" ? "sp-profit" : c.status === "trial" ? "sp-warn" : "sp-loss"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={tdL}>{c.assigned_manager ?? "—"}</td>
                      <td style={{ ...tdL, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "var(--ink4)" }}>{c.start_date ?? "—"}</td>
                      <td style={{ ...tdL, textAlign: "right" }}>
                        <button className="btn-sm" style={{ marginRight: 6 }} onClick={() => navigate({ to: "/brands/marketizers/revenue/clients/$clientId", params: { clientId: c.id } })}>Details</button>
                        {canEdit && !c.is_deleted && <button className="btn-sm" style={{ marginRight: 6 }} onClick={() => openEdit(c)}>Edit</button>}
                        {canEdit && !c.is_deleted && <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(c)}>Delete</button>}
                        {canEdit && c.is_deleted && <button className="btn-sm" onClick={() => restore(c)}>Restore</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>
      </div>

      {drawerOpen && (
        <Suspense fallback={null}>
          <AddClientDrawer
            open={drawerOpen}
            onClose={() => { setDrawerOpen(false); setDrawerClient(null); }}
            initial={drawerClient}
            onSaved={() => { setDrawerOpen(false); setDrawerClient(null); load(true); }}
            onSavedAndAddEntry={(clientId) => {
              setDrawerOpen(false);
              setDrawerClient(null);
              load(true);
              navigate({ to: "/brands/marketizers/revenue/entry", search: { clientId } as any });
            }}
          />
        </Suspense>
      )}
      {deleteTarget && (
        <ClientDeleteDialog
          clientName={deleteTarget.client_name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 0",
  borderBottom: "1px solid var(--border)", fontWeight: 400,
};
const tdL: React.CSSProperties = { padding: "13px 8px 13px 0", verticalAlign: "middle", fontSize: 13, color: "var(--ink2)" };
