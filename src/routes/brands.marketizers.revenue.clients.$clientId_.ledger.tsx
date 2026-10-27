import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarketizersAccessGuard,
  canEditMarketizersFinance,
} from "@/components/marketizers/MarketizersAccessGuard";
import { PageHeader, MetricCard, LoadingState, ErrorBanner } from "@/components/marketizers/ui";
import { getMarketizersClientById } from "@/services/marketizers/clientsService";
import {
  listLedgerEntries,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  listProfitSplits,
  createProfitSplit,
  updateProfitSplit,
  deleteProfitSplit,
  getMonthlyEntryPushStatus,
  pushMarketizersShareToMonthlyEntry,
  listImportBatches,
  undoImportBatch,
  listLedgerCategories,
  createLedgerCategory,
  listLedgerSources,
  createLedgerSource,
  insertBlankLedgerEntry,
  duplicateLedgerEntry,
  type LedgerEntry,
  type ProfitSplit,
  type LedgerPushStatus,
  type LedgerImportBatch,
  type LedgerCategory,
  type LedgerSource,
} from "@/services/marketizers/clientLedgerService";



import { formatINR, formatMonthLabel } from "@/utils/formatters/format";
import type { Client } from "@/types/marketizers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LedgerImportDialog } from "@/components/marketizers/LedgerImportDialog";

export const Route = createFileRoute(
  "/brands/marketizers/revenue/clients/$clientId_/ledger",
)({
  component: () => (
    <MarketizersAccessGuard>
      <ClientLedgerPage />
    </MarketizersAccessGuard>
  ),
});

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out.reverse();
}

type EntryMeta = NonNullable<LedgerEntry["metadata"]>;

function readMeta(row: LedgerEntry): EntryMeta {
  return (row.metadata ?? {}) as EntryMeta;
}

/** Compute the Excl-GST / net amount for a row, honoring per-row metadata
 *  (GST applicable, GST rate, deductions) and manual overrides. */
function computeNetExcl(
  row: LedgerEntry,
  defaults: { gstRate: number; autoExcl: boolean },
): number {
  const m = readMeta(row);
  // Manual override wins.
  if (m.auto_excl === false) return Number(row.amount_excluding_gst || 0);

  const incl = Number(row.amount_inclusive_gst || 0);
  const gstApplicable = m.gst_applicable ?? defaults.autoExcl;
  const gstRate = m.gst_rate ?? defaults.gstRate;

  let base = incl;
  const ded = m.deduction;
  if (ded && Number(ded.amount) > 0) {
    const dedAmt = ded.type === "percent"
      ? incl * (Number(ded.amount) / 100)
      : Number(ded.amount);
    base = incl - dedAmt;
  }
  const net = gstApplicable ? base / (1 + (Number(gstRate) || 0) / 100) : base;
  return Math.round(net);
}

function computeDeductionAmount(row: LedgerEntry): number {
  const m = readMeta(row);
  const ded = m.deduction;
  if (!ded || !Number(ded.amount)) return 0;
  const incl = Number(row.amount_inclusive_gst || 0);
  return ded.type === "percent"
    ? Math.round(incl * (Number(ded.amount) / 100))
    : Number(ded.amount);
}



function ClientLedgerPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const canEdit = canEditMarketizersFinance();

  const [client, setClient] = useState<Client | null>(null);
  const [month, setMonth] = useState<string>(currentMonth());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [splits, setSplits] = useState<ProfitSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<LedgerPushStatus | null>(null);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"income" | "expense">("income");
  const [batches, setBatches] = useState<LedgerImportBatch[]>([]);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);
  const [undoBatchTarget, setUndoBatchTarget] = useState<LedgerImportBatch | null>(null);

  // Categories & sources shared between income/expense tables
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [sources, setSources] = useState<LedgerSource[]>([]);


  // GST settings (per-client, localStorage)
  const gstKey = `mkz_ledger_gst:${clientId}`;
  const [gstRate, setGstRate] = useState<number>(18);
  const [autoExcl, setAutoExcl] = useState<boolean>(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(gstKey);
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v.rate === "number") setGstRate(v.rate);
        if (typeof v.auto === "boolean") setAutoExcl(v.auto);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  useEffect(() => {
    try {
      localStorage.setItem(gstKey, JSON.stringify({ rate: gstRate, auto: autoExcl }));
    } catch {}
  }, [gstKey, gstRate, autoExcl]);

  // Centralized debounced save tracker for entries + splits
  type SaveKind = "entry" | "split";
  const pendingRef = useRef<Map<string, { kind: SaveKind; patch: any; timer: ReturnType<typeof setTimeout> | null }>>(new Map());
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const [pendingCount, setPendingCount] = useState(0);

  const updatePendingCount = () => setPendingCount(pendingRef.current.size);

  const commitOne = useCallback(async (key: string) => {
    const item = pendingRef.current.get(key);
    if (!item) return;
    pendingRef.current.delete(key);
    updatePendingCount();
    const [kind, id] = key.split(":");
    try {
      if (kind === "entry") await updateLedgerEntry(id, item.patch);
      else if (kind === "split") await updateProfitSplit(id, item.patch);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed.");
    }
  }, []);

  const enqueueSave = useCallback((kind: SaveKind, id: string, patch: any) => {
    const key = `${kind}:${id}`;
    const prev = pendingRef.current.get(key);
    if (prev?.timer) clearTimeout(prev.timer);
    const merged = { ...(prev?.patch ?? {}), ...patch };
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      void commitOne(key).then(() => {
        if (pendingRef.current.size === 0) setSaveStatus("saved");
      });
    }, 600);
    pendingRef.current.set(key, { kind, patch: merged, timer });
    updatePendingCount();
  }, [commitOne]);

  const flushAll = useCallback(async () => {
    const keys = Array.from(pendingRef.current.keys());
    if (keys.length === 0) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    for (const k of keys) {
      const item = pendingRef.current.get(k);
      if (item?.timer) clearTimeout(item.timer);
    }
    await Promise.all(keys.map((k) => commitOne(k)));
    setSaveStatus("saved");
  }, [commitOne]);

  // Expanded panel mode
  const [expandMode, setExpandMode] = useState<"split" | "income" | "expense">("split");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [c, ents, sp, ps, bs, cats, srcs] = await Promise.all([
        getMarketizersClientById(clientId),
        listLedgerEntries(clientId, month),
        listProfitSplits(clientId),
        getMonthlyEntryPushStatus(clientId, month),
        canEdit ? listImportBatches(clientId, month) : Promise.resolve([] as LedgerImportBatch[]),
        listLedgerCategories().catch(() => [] as LedgerCategory[]),
        listLedgerSources().catch(() => [] as LedgerSource[]),
      ]);
      setClient(c);
      setEntries(ents);
      setSplits(sp);
      setPushStatus(ps);
      setBatches(bs);
      setCategories(cats);
      setSources(srcs);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load ledger.");
    } finally {
      setLoading(false);
    }
  }, [clientId, month, canEdit]);

  const addCategory = useCallback(async (type: "income" | "expense", name: string) => {
    const cat = await createLedgerCategory(type, name);
    setCategories((prev) => (prev.some((c) => c.id === cat.id) ? prev : [...prev, cat]));
    return cat;
  }, []);

  const addSource = useCallback(async (type: "income" | "expense", name: string) => {
    const src = await createLedgerSource(type, name);
    setSources((prev) => (prev.some((s) => s.id === src.id) ? prev : [...prev, src]));
    return src;
  }, []);



  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = client
      ? `Ledger · ${client.client_name} | Marketizers`
      : "Client Ledger | Marketizers";
  }, [client]);

  const income = useMemo(() => entries.filter((e) => e.entry_type === "income"), [entries]);
  const expenses = useMemo(() => entries.filter((e) => e.entry_type === "expense"), [entries]);

  const totals = useMemo(() => {
    const defaults = { gstRate, autoExcl };
    const incomeIncl = income.reduce((s, e) => s + Number(e.amount_inclusive_gst || 0), 0);
    const incomeExcl = income.reduce((s, e) => s + computeNetExcl(e, defaults), 0);
    const expIncl = expenses.reduce((s, e) => s + Number(e.amount_inclusive_gst || 0), 0);
    const expExcl = expenses.reduce((s, e) => s + computeNetExcl(e, defaults), 0);
    const grossProfit = incomeExcl - expExcl;
    return { incomeIncl, incomeExcl, expIncl, expExcl, grossProfit };
  }, [income, expenses, gstRate, autoExcl]);


  const splitTotalPercent = splits.reduce((s, x) => s + Number(x.split_percent || 0), 0);
  const splitWarning = Math.abs(splitTotalPercent - 100) > 0.01;

  const marketizersShare = splits
    .filter((s) => s.is_marketizers_revenue)
    .reduce((s, x) => s + (Number(x.split_percent || 0) / 100) * totals.grossProfit, 0);
  const partnerShare = totals.grossProfit - marketizersShare;

  const handleAddRow = async (type: "income" | "expense") => {
    try {
      const row = await createLedgerEntry(clientId, month, type);
      setEntries((prev) => [...prev, row]);
    } catch (e: any) {
      setErr(e?.message ?? "Could not add row.");
    }
  };

  const handleInsertRow = async (refRow: LedgerEntry) => {
    try {
      const row = await insertBlankLedgerEntry(clientId, month, refRow.entry_type, refRow.entry_date);
      setEntries((prev) => [...prev, row]);
    } catch (e: any) {
      setErr(e?.message ?? "Could not insert row.");
    }
  };

  const handleDuplicateRow = async (refRow: LedgerEntry) => {
    try {
      const row = await duplicateLedgerEntry(refRow);
      setEntries((prev) => [...prev, row]);
    } catch (e: any) {
      setErr(e?.message ?? "Could not duplicate row.");
    }
  };

  const handleUpdate = (id: string, patch: Partial<LedgerEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    enqueueSave("entry", id, patch);
  };



  const handleDelete = (id: string) => {
    setRowToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!rowToDelete) return;
    const id = rowToDelete;
    setDeleteDialogOpen(false);
    setRowToDelete(null);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteLedgerEntry(id);
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete row.");
      void load();
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setRowToDelete(null);
  };

  const hasMarketizersSplit = splits.some((s) => s.is_marketizers_revenue);
  const splitTotalIs100 = !splitWarning;
  const canPush =
    canEdit &&
    !!month &&
    splitTotalIs100 &&
    hasMarketizersSplit &&
    marketizersShare > 0;

  const driftedAfterPush =
    !!pushStatus?.exists &&
    pushStatus.ledgerPushedAmount != null &&
    Math.abs(Number(pushStatus.ledgerPushedAmount) - marketizersShare) > 0.5;

  const handleConfirmPush = async () => {
    setPushing(true);
    setPushError(null);
    try {
      const next = await pushMarketizersShareToMonthlyEntry(clientId, month, marketizersShare);
      setPushStatus(next);
      setPushDialogOpen(false);
    } catch (e: any) {
      setPushError(e?.message ?? "Could not push to Monthly Entry.");
    } finally {
      setPushing(false);
    }
  };

  const handleUndoBatch = async (batchId: string) => {
    setUndoingBatchId(batchId);
    try {
      await undoImportBatch(batchId);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not undo import.");
    } finally {
      setUndoingBatchId(null);
      setUndoBatchTarget(null);
    }
  };


  const undoneSincePush = useMemo(() => {
    if (!pushStatus?.exists || !pushStatus.ledgerPushedAt) return false;
    const pushedAt = new Date(pushStatus.ledgerPushedAt).getTime();
    return batches.some(
      (b) => b.is_undone && b.undone_at && new Date(b.undone_at).getTime() > pushedAt,
    );
  }, [batches, pushStatus]);




  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Client Finance Ledger" title="Loading…" />
        <LoadingState rows={6} />
      </div>
    );
  }
  if (err && !client) {
    return (
      <div>
        <PageHeader eyebrow="Client Finance Ledger" title="Could not load ledger" />
        <ErrorBanner message={err} onRetry={load} />
      </div>
    );
  }
  if (!client) {
    return (
      <div>
        <PageHeader eyebrow="Client Finance Ledger" title="Client not found" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Client Finance Ledger"
        title={client.client_name}
        subtitle={`${formatMonthLabel(month)} · live ledger`}
        actions={
          <>
            <Link
              to="/brands/marketizers/revenue/clients/$clientId"
              params={{ clientId }}
              className="btn-sm"
            >
              ← Client
            </Link>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="btn-sm"
              style={{ padding: "6px 10px" }}
            >
              {monthOptions().map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                className="btn-sm"
                onClick={() => {
                  setImportType("income");
                  setImportOpen(true);
                }}
              >
                Import Rows
              </button>
            )}
          </>
        }
      />

      {err && <ErrorBanner message={err} onRetry={load} />}

      {/* GST + Save toolbar */}
      <div
        className="panel"
        style={{
          padding: "10px 16px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11.5, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".1em" }}>
              GST Rate %
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              value={gstRate}
              disabled={!canEdit}
              onChange={(e) => setGstRate(Number(e.target.value) || 0)}
              style={{ width: 70, padding: "4px 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)", fontFamily: "'DM Mono',monospace" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink3)" }}>
            <input
              type="checkbox"
              checked={autoExcl}
              disabled={!canEdit}
              onChange={(e) => setAutoExcl(e.target.checked)}
            />
            Auto-calc Excl GST from Incl GST
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SaveStatusBadge status={saveStatus} pending={pendingCount} />
          {canEdit && (
            <button
              className="btn-sm btn-primary"
              disabled={pendingCount === 0 && saveStatus !== "unsaved"}
              onClick={() => void flushAll()}
              style={(pendingCount === 0 && saveStatus !== "unsaved") ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              Save All
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <MetricCard accent="green" label="Income Excl GST" value={formatINR(totals.incomeExcl)} helper={`Incl GST ${formatINR(totals.incomeIncl)}`} />
        <MetricCard accent="amber" label="Expenses Excl GST" value={formatINR(totals.expExcl)} helper={`Incl GST ${formatINR(totals.expIncl)}`} />
        <MetricCard accent={totals.grossProfit >= 0 ? "green" : "red"} label="Gross Profit" value={formatINR(totals.grossProfit)} emphasis />
        <MetricCard accent="gold" label="Marketizers Share" value={formatINR(marketizersShare)} />
        <MetricCard accent="gold" label="Partner Share" value={formatINR(partnerShare)} />
      </div>

      {/* Split / Expanded screen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            expandMode === "split" ? "1fr 1fr" : "1fr",
          gap: 18,
          marginBottom: 22,
        }}
      >
        {(expandMode === "split" || expandMode === "income") && (
          <LedgerTable
            title="Income / Payments Received"
            type="income"
            clientId={clientId}
            rows={income}
            canEdit={canEdit}
            categories={categories.filter((c) => c.category_type === "income")}
            sources={sources.filter((s) => s.source_type === "income" || s.source_type === "both")}
            onAddCategory={(name) => addCategory("income", name)}
            onAddSource={(name) => addSource("income", name)}
            gstRate={gstRate}
            autoExcl={autoExcl}
            expanded={expandMode === "income"}
            onToggleExpand={() => setExpandMode(expandMode === "income" ? "split" : "income")}
            onAdd={() => handleAddRow("income")}
            onInsert={handleInsertRow}
            onDuplicate={handleDuplicateRow}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
        {(expandMode === "split" || expandMode === "expense") && (
          <LedgerTable
            title="Expenses"
            type="expense"
            clientId={clientId}
            rows={expenses}
            canEdit={canEdit}
            categories={categories.filter((c) => c.category_type === "expense")}
            sources={sources.filter((s) => s.source_type === "expense" || s.source_type === "both")}
            onAddCategory={(name) => addCategory("expense", name)}
            onAddSource={(name) => addSource("expense", name)}
            gstRate={gstRate}
            autoExcl={autoExcl}
            expanded={expandMode === "expense"}
            onToggleExpand={() => setExpandMode(expandMode === "expense" ? "split" : "expense")}
            onAdd={() => handleAddRow("expense")}
            onInsert={handleInsertRow}
            onDuplicate={handleDuplicateRow}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}

      </div>

      {/* Profit split */}
      <ProfitSplitsPanel
        clientId={clientId}
        splits={splits}
        setSplits={setSplits}
        grossProfit={totals.grossProfit}
        canEdit={canEdit}
        warning={splitWarning}
        totalPercent={splitTotalPercent}
        enqueueSave={enqueueSave}
      />


      {/* Category breakdowns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginTop: 22,
        }}
      >
        <CategoryBreakdown title="Income by Category" rows={income} />
        <CategoryBreakdown title="Expenses by Category" rows={expenses} />
      </div>

      {/* Push to monthly entry */}
      <div className="panel" style={{ marginTop: 22, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            Push <strong>Marketizers Share</strong> ({formatINR(marketizersShare)}) into the Monthly Entry for {formatMonthLabel(month)}.
          </div>
          {pushStatus?.exists && pushStatus.ledgerPushedAt && (
            <div style={{ fontSize: 12, color: "var(--ink4)" }}>
              ✓ Pushed {formatINR(Number(pushStatus.ledgerPushedAmount ?? 0))} on{" "}
              {new Date(pushStatus.ledgerPushedAt).toLocaleString()}
              {" · "}
              <Link
                to="/brands/marketizers/revenue/entry"
                className="link"
              >
                View Monthly Entry
              </Link>
            </div>
          )}
          {driftedAfterPush && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>
              ⚠ Ledger changed after push. Push update again.
            </div>
          )}
          {!canPush && canEdit && (
            <div style={{ fontSize: 11.5, color: "var(--ink4)" }}>
              {!splitTotalIs100 && "Profit split must total 100%. "}
              {!hasMarketizersSplit && "Mark a split row as Marketizers Revenue. "}
              {marketizersShare <= 0 && "Marketizers Share must be greater than 0. "}
            </div>
          )}
        </div>
        <button
          className="btn-sm btn-primary"
          disabled={!canPush}
          onClick={() => {
            setPushError(null);
            setPushDialogOpen(true);
          }}
          style={!canPush ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
        >
          Push Marketizers Share to Monthly Entry
        </button>
      </div>

      <div style={{ height: 40 }} />
      <button className="btn-sm" onClick={() => navigate({ to: "/brands/marketizers/revenue/clients" })}>
        ← Back to Clients
      </button>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setRowToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete row?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the ledger row. The totals will update immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ background: "var(--red)" }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Push confirmation dialog */}
      <AlertDialog
        open={pushDialogOpen}
        onOpenChange={(open) => {
          if (!pushing) setPushDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Push Marketizers Share to Monthly Entry?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <Row2 label="Client" value={client.client_name} />
                <Row2 label="Ledger month" value={formatMonthLabel(month)} />
                <Row2 label="Gross Profit" value={formatINR(totals.grossProfit)} />
                <Row2 label="Marketizers Share" value={formatINR(marketizersShare)} emphasis />
                <Row2
                  label="Existing Monthly Entry"
                  value={pushStatus?.exists ? "Found" : "Not Found"}
                />
                <Row2
                  label="Action"
                  value={pushStatus?.exists ? "Update Monthly Entry" : "Create Monthly Entry"}
                />
                {pushError && (
                  <div style={{ color: "var(--red)", fontSize: 12 }}>{pushError}</div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pushing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmPush();
              }}
              disabled={pushing}
            >
              {pushing ? "Pushing…" : "Push to Monthly Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit && (
        <div className="panel" style={{ marginTop: 22, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="eyebrow">Import History · {formatMonthLabel(month)}</div>
            {undoneSincePush && (
              <div style={{ fontSize: 11.5, color: "var(--amber, #b07d2b)", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.25)", padding: "4px 8px", borderRadius: 4 }}>
                ⚠ Ledger changed after undo. Push update again.
              </div>
            )}
          </div>
          {batches.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink4)", padding: "8px 0" }}>No imports yet for this month.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>When</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Source</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Type</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Rows</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Income</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Expense</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Status</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{new Date(b.created_at).toLocaleString()}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{b.source_name ?? "—"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{b.import_type}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{b.rows_imported}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{formatINR(Number(b.income_total_excl_gst || 0))}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{formatINR(Number(b.expense_total_excl_gst || 0))}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", color: b.is_undone ? "var(--ink4)" : "var(--green, #2a7d3a)" }}>
                      {b.is_undone ? "undone" : "active"}
                    </td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      {!b.is_undone && (
                        <button
                          className="btn-sm"
                          onClick={() => setUndoBatchTarget(b)}
                          disabled={undoingBatchId === b.id}
                        >
                          {undoingBatchId === b.id ? "Undoing…" : "Undo"}
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Undo import confirmation dialog */}
      <AlertDialog
        open={!!undoBatchTarget}
        onOpenChange={(open) => {
          if (!open && !undoingBatchId) setUndoBatchTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoBatchTarget
                ? `${undoBatchTarget.rows_imported} row${undoBatchTarget.rows_imported === 1 ? "" : "s"} from "${undoBatchTarget.source_name ?? "this import"}" will be soft-deleted. Manual rows and other imports stay intact.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!undoingBatchId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (undoBatchTarget) void handleUndoBatch(undoBatchTarget.id);
              }}
              disabled={!!undoingBatchId}
              style={{ background: "var(--red)" }}
            >
              {undoingBatchId ? "Undoing…" : "Undo Import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>





      <LedgerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        clientId={clientId}
        month={month}
        existingEntries={entries}
        defaultType={importType}
        onImported={(created) => {
          setEntries((prev) => [...prev, ...created]);
          void load();
        }}
      />
    </div>
  );
}

function Row2({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>
      <span style={{ color: "var(--ink4)" }}>{label}</span>
      <span style={{ fontWeight: emphasis ? 700 : 500, color: "var(--ink)", fontFamily: "'DM Mono',monospace" }}>{value}</span>
    </div>
  );
}

/* ─────────────────────────────── Ledger Table ─────────────────────────────── */

const cellStyle: React.CSSProperties = {
  padding: "6px 8px",
  background: "transparent",
  border: "none",
  fontSize: 12.5,
  width: "100%",
  fontFamily: "'Figtree',sans-serif",
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};

const numCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontFamily: "'DM Mono',monospace",
  textAlign: "right",
};

const headStyle: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 9,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink4)",
  padding: "8px",
  borderBottom: "1px solid var(--border)",
  background: "var(--parchment2)",
  textAlign: "left",
  position: "relative",
  userSelect: "none",
};

function SaveStatusBadge({ status, pending }: { status: "idle" | "unsaved" | "saving" | "saved"; pending: number }) {
  const map = {
    idle: { label: "All synced", color: "var(--ink4)", dot: "var(--ink5, #aaa)" },
    unsaved: { label: `Unsaved changes${pending ? ` (${pending})` : ""}`, color: "var(--amber, #b07d2b)", dot: "#e0a02b" },
    saving: { label: "Saving…", color: "var(--ink3)", dot: "#3b82f6" },
    saved: { label: "Saved", color: "var(--green, #2a7d3a)", dot: "#2a7d3a" },
  } as const;
  const s = map[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: s.color }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

/* ───────── Keyboard cell navigation helpers ───────── */

const EDITABLE_COLS = 7; // date,name,category,incl,excl,source,notes

function moveFocus(table: HTMLElement | null, r: number, c: number) {
  if (!table) return;
  const el = table.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`);
  if (el) {
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== "date") {
      try { el.select(); } catch {}
    }
  }
}

function handleCellKey(
  e: React.KeyboardEvent<HTMLElement>,
  r: number,
  c: number,
  totalRows: number,
) {
  const target = e.currentTarget as HTMLInputElement;
  const isInput = target instanceof HTMLInputElement;
  const atStart = !isInput || (target.selectionStart === 0 && target.selectionEnd === 0);
  const atEnd = !isInput || (target.selectionStart === (target.value?.length ?? 0) && target.selectionEnd === (target.value?.length ?? 0));
  const table = (e.currentTarget.closest("table") as HTMLElement | null);
  if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(table, Math.min(totalRows - 1, r + 1), c); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(table, Math.max(0, r - 1), c); }
  else if (e.key === "ArrowRight" && atEnd) { e.preventDefault(); moveFocus(table, r, Math.min(EDITABLE_COLS - 1, c + 1)); }
  else if (e.key === "ArrowLeft" && atStart) { e.preventDefault(); moveFocus(table, r, Math.max(0, c - 1)); }
  else if (e.key === "Enter") { e.preventDefault(); moveFocus(table, Math.min(totalRows - 1, r + 1), c); }
  else if (e.key === "Escape") { (e.target as HTMLElement).blur(); }
}

/* ───────── Resizable column widths ───────── */

const DEFAULT_WIDTHS: Record<string, number> = {
  date: 110, name: 180, category: 170, incl: 130, excl: 130, source: 170, notes: 240, actions: 44,
};
const MIN_W = 70;
const MAX_W = 800;

function useColumnWidths(storageKey: string) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch {}
  }, [storageKey, widths]);
  const setOne = useCallback((k: string, v: number) => {
    setWidths((prev) => ({ ...prev, [k]: Math.max(MIN_W, Math.min(MAX_W, Math.round(v))) }));
  }, []);
  const reset = useCallback(() => setWidths(DEFAULT_WIDTHS), []);
  return { widths, setOne, reset };
}

function ColResizer({ onSet }: { onSet: (newWidth: number) => void }) {
  return (
    <span
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = e.currentTarget.parentElement as HTMLElement;
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        const move = (ev: MouseEvent) => onSet(startW + (ev.clientX - startX));
        const up = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
          document.body.style.cursor = "";
        };
        document.body.style.cursor = "col-resize";
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      }}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        position: "absolute", top: 0, right: -3, bottom: 0, width: 6,
        cursor: "col-resize", zIndex: 5, userSelect: "none",
      }}
      title="Drag to resize · double-click to reset"
    />
  );
}

/* ───────── Searchable dropdown cell (categories & sources) ───────── */

function LookupCell({
  value,
  options,
  readOnly,
  cellKey,
  rowIndex,
  colIndex,
  totalRows,
  addLabel,
  onChange,
  onAdd,
}: {
  value: string;
  options: { id: string; name: string }[];
  readOnly: boolean;
  cellKey: string;
  rowIndex: number;
  colIndex: number;
  totalRows: number;
  addLabel: string;
  onChange: (next: string) => void;
  onAdd: (name: string) => Promise<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) setQuery(value); }, [value, open]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);
  const exactMatch = options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());
  const select = (name: string) => { onChange(name); setQuery(name); setOpen(false); };
  const handleAdd = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const item = await onAdd(name);
      select(item.name);
    } catch {
      select(name);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        data-cell={`${rowIndex}:${colIndex}`}
        data-key={cellKey}
        value={query}
        readOnly={readOnly}
        placeholder="—"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => { if (query !== value) onChange(query); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[0] && filtered[0].name.toLowerCase() === query.trim().toLowerCase()) select(filtered[0].name);
            else if (query.trim() && !exactMatch) void handleAdd();
            else if (filtered[0]) select(filtered[0].name);
            else handleCellKey(e, rowIndex, colIndex, totalRows);
          } else if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLElement).blur();
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab") {
            if (!open) handleCellKey(e, rowIndex, colIndex, totalRows);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            handleCellKey(e, rowIndex, colIndex, totalRows);
          }
        }}
        style={cellStyle}
      />
      {open && !readOnly && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2,
            background: "var(--ivory)", border: "1px solid var(--border)",
            borderRadius: 6, boxShadow: "0 12px 30px -12px rgba(0,0,0,.25)",
            maxHeight: 220, overflowY: "auto", zIndex: 80,
          }}
        >
          {filtered.length === 0 && !query.trim() && (
            <div style={{ padding: 10, fontSize: 12, color: "var(--ink4)" }}>No {addLabel.toLowerCase()}s yet.</div>
          )}
          {filtered.map((o) => (
            <div
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); select(o.name); }}
              style={{ padding: "7px 10px", fontSize: 12.5, cursor: "pointer", borderBottom: "1px solid var(--parchment2)" }}
            >
              {o.name}
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              onMouseDown={(e) => { e.preventDefault(); void handleAdd(); }}
              style={{ padding: "8px 10px", fontSize: 12, cursor: "pointer", color: "var(--green, #2a7d3a)", fontWeight: 600 }}
            >
              + Save {addLabel.toLowerCase()} “{query.trim()}”
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Row actions menu ───────── */

function RowActionsMenu({
  onInsert,
  onDuplicate,
  onDelete,
}: {
  onInsert: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const item: React.CSSProperties = { padding: "7px 12px", fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" };
  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Row actions"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink3)", fontSize: 16, padding: "2px 6px", lineHeight: 1 }}
      >
        ⋮
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 2,
            background: "var(--ivory)", border: "1px solid var(--border)",
            borderRadius: 6, boxShadow: "0 12px 30px -12px rgba(0,0,0,.25)",
            zIndex: 90, minWidth: 160,
          }}
        >
          <div style={item} onClick={() => { setOpen(false); onInsert(); }}>Insert row below</div>
          <div style={item} onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate row</div>
          <div style={{ ...item, color: "var(--red)", borderTop: "1px solid var(--parchment2)" }} onClick={() => { setOpen(false); onDelete(); }}>Delete row</div>
        </div>
      )}
    </div>
  );
}

function LedgerTable({
  title,
  type,
  clientId,
  rows,
  canEdit,
  categories,
  sources,
  onAddCategory,
  onAddSource,
  gstRate,
  autoExcl,
  expanded,
  onToggleExpand,
  onAdd,
  onInsert,
  onDuplicate,
  onUpdate,
  onDelete,
}: {
  title: string;
  type: "income" | "expense";
  clientId: string;
  rows: LedgerEntry[];
  canEdit: boolean;
  categories: LedgerCategory[];
  sources: LedgerSource[];
  onAddCategory: (name: string) => Promise<LedgerCategory>;
  onAddSource: (name: string) => Promise<LedgerSource>;
  gstRate: number;
  autoExcl: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAdd: () => void;
  onInsert: (refRow: LedgerEntry) => void;
  onDuplicate: (refRow: LedgerEntry) => void;
  onUpdate: (id: string, patch: Partial<LedgerEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const isIncome = type === "income";
  const { widths, setOne, reset } = useColumnWidths(`mkz_ledger_widths:${clientId}:${type}`);

  // Optional column visibility (localStorage per client+type)
  const visKey = `mkz_ledger_visible:${clientId}:${type}`;
  const [visibleOptional, setVisibleOptional] = useState<Record<OptionalColKey, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(visKey) : null;
      if (raw) return { gstApplicable: false, gstRate: false, deduction: false, dedLabel: false, dedNotes: false, ...JSON.parse(raw) };
    } catch {}
    return { gstApplicable: false, gstRate: false, deduction: false, dedLabel: false, dedNotes: false };
  });
  useEffect(() => {
    try { localStorage.setItem(visKey, JSON.stringify(visibleOptional)); } catch {}
  }, [visKey, visibleOptional]);

  // Custom columns (localStorage per client+type)
  const customKey = `mkz_ledger_custom_cols:${clientId}:${type}`;
  const [customCols, setCustomCols] = useState<CustomCol[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(customKey) : null;
      if (raw) return JSON.parse(raw) as CustomCol[];
    } catch {}
    return [];
  });
  useEffect(() => {
    try { localStorage.setItem(customKey, JSON.stringify(customCols)); } catch {}
  }, [customKey, customCols]);

  const [colsMenuOpen, setColsMenuOpen] = useState(false);
  const colsMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colsMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (colsMenuRef.current && !colsMenuRef.current.contains(e.target as Node)) setColsMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [colsMenuOpen]);

  const addCustomCol = () => {
    const label = window.prompt("Custom column label:");
    if (!label || !label.trim()) return;
    const id = `col_${Math.random().toString(36).slice(2, 10)}`;
    setCustomCols((prev) => [...prev, { id, label: label.trim() }]);
  };
  const removeCustomCol = (id: string) => {
    if (!window.confirm("Remove this custom column? Stored values stay in metadata but won't be shown.")) return;
    setCustomCols((prev) => prev.filter((c) => c.id !== id));
  };

  const requiredCols: { key: string; label: string; align?: "left" | "right" }[] = [
    { key: "date", label: "Date" },
    { key: "name", label: isIncome ? "Payer / Student" : "Expense Name" },
    { key: "category", label: "Category" },
    { key: "incl", label: isIncome ? "Received" : "Incl GST", align: "right" },
    { key: "excl", label: "Excl GST", align: "right" },
    { key: "source", label: isIncome ? "Source" : "Paid By" },
    { key: "notes", label: "Notes" },
  ];
  const optionalCols: { key: OptionalColKey; label: string; align?: "left" | "right"; width: number }[] = ([
    { key: "gstApplicable", label: "GST?", width: 70 },
    { key: "gstRate", label: "GST %", align: "right" as const, width: 80 },
    { key: "deduction", label: "Deduction", align: "right" as const, width: 110 },
    { key: "dedLabel", label: "Ded. Label", width: 130 },
    { key: "dedNotes", label: "Ded. Notes", width: 180 },
  ] as { key: OptionalColKey; label: string; align?: "left" | "right"; width: number }[]).filter((c) => visibleOptional[c.key]);

  const totalColCount = requiredCols.length + optionalCols.length + customCols.length + (canEdit ? 1 : 0);

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", gap: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <button className="btn-sm" onClick={reset} title="Reset column widths">↻ Widths</button>
          <div ref={colsMenuRef} style={{ position: "relative" }}>
            <button className="btn-sm" onClick={() => setColsMenuOpen((v) => !v)} title="Show/hide columns">⊞ Columns</button>
            {colsMenuOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4,
                background: "var(--ivory)", border: "1px solid var(--border)",
                borderRadius: 8, boxShadow: "0 12px 30px -12px rgba(0,0,0,.25)",
                zIndex: 100, minWidth: 240, padding: 10,
              }}>
                <div style={{ fontSize: 10.5, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
                  Optional columns
                </div>
                {([
                  { k: "gstApplicable" as const, label: "GST Applicable" },
                  { k: "gstRate" as const, label: "GST Rate" },
                  { k: "deduction" as const, label: "Deduction Amount" },
                  { k: "dedLabel" as const, label: "Deduction Label" },
                  { k: "dedNotes" as const, label: "Deduction Notes" },
                ]).map((o) => (
                  <label key={o.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={visibleOptional[o.k]}
                      onChange={(e) => setVisibleOptional((p) => ({ ...p, [o.k]: e.target.checked }))}
                    />
                    {o.label}
                  </label>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
                <div style={{ fontSize: 10.5, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
                  Custom columns (tracking only)
                </div>
                {customCols.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "var(--ink4)", padding: "2px 0 6px" }}>None yet.</div>
                )}
                {customCols.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: 12.5 }}>
                    <span>{c.label}</span>
                    <button className="btn-sm" onClick={() => removeCustomCol(c.id)} style={{ padding: "2px 8px", fontSize: 11 }}>Remove</button>
                  </div>
                ))}
                {canEdit && (
                  <button className="btn-sm" onClick={addCustomCol} style={{ marginTop: 6, width: "100%" }}>+ Add Custom Column</button>
                )}
              </div>
            )}
          </div>
          <button className="btn-sm" onClick={onToggleExpand} title={expanded ? "Show split view" : `Expand ${isIncome ? "income" : "expenses"}`}>
            {expanded ? "↹ Collapse" : `⤢ Expand ${isIncome ? "Income" : "Expenses"}`}
          </button>
          {canEdit && (
            <button className="btn-sm btn-primary" onClick={onAdd}>+ Add Row</button>
          )}
        </div>
      </div>
      <div style={{ overflowX: "auto", maxHeight: expanded ? "70vh" : 520, overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <colgroup>
            {requiredCols.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
            {optionalCols.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {customCols.map((c) => (
              <col key={c.id} style={{ width: 150 }} />
            ))}
            {canEdit && <col style={{ width: widths.actions }} />}
          </colgroup>
          <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              {requiredCols.map((c) => (
                <th key={c.key} style={{ ...headStyle, textAlign: c.align ?? "left", borderRight: "1px solid var(--border)" }}>
                  {c.label}
                  <ColResizer onSet={(w) => setOne(c.key, w)} />
                </th>
              ))}
              {optionalCols.map((c) => (
                <th key={c.key} style={{ ...headStyle, textAlign: c.align ?? "left", borderRight: "1px solid var(--border)" }}>
                  {c.label}
                </th>
              ))}
              {customCols.map((c) => (
                <th key={c.id} style={{ ...headStyle, textAlign: "left", borderRight: "1px solid var(--border)" }}>
                  {c.label}
                </th>
              ))}
              {canEdit && <th style={{ ...headStyle, width: widths.actions }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={totalColCount} style={{ padding: 24, textAlign: "center", color: "var(--ink4)", fontSize: 12.5 }}>
                  No {isIncome ? "income" : "expense"} rows yet. Click <strong>+ Add Row</strong> to start.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <Row
                key={row.id}
                row={row}
                rowIndex={idx}
                totalRows={rows.length}
                canEdit={canEdit}
                categories={categories}
                sources={sources}
                onAddCategory={onAddCategory}
                onAddSource={onAddSource}
                gstRate={gstRate}
                autoExcl={autoExcl}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onInsert={() => onInsert(row)}
                onDuplicate={() => onDuplicate(row)}
                visibleOptional={visibleOptional}
                customCols={customCols}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



type OptionalColKey = "gstApplicable" | "gstRate" | "deduction" | "dedLabel" | "dedNotes";
type CustomCol = { id: string; label: string };

function Row({
  row,
  rowIndex,
  totalRows,
  canEdit,
  categories,
  sources,
  onAddCategory,
  onAddSource,
  gstRate,
  autoExcl,
  onUpdate,
  onDelete,
  onInsert,
  onDuplicate,
  visibleOptional,
  customCols,
}: {
  row: LedgerEntry;
  rowIndex: number;
  totalRows: number;
  canEdit: boolean;
  categories: LedgerCategory[];
  sources: LedgerSource[];
  onAddCategory: (name: string) => Promise<LedgerCategory>;
  onAddSource: (name: string) => Promise<LedgerSource>;
  gstRate: number;
  autoExcl: boolean;
  onUpdate: (id: string, patch: Partial<LedgerEntry>) => void;
  onDelete: (id: string) => void;
  onInsert: () => void;
  onDuplicate: () => void;
  visibleOptional: Record<OptionalColKey, boolean>;
  customCols: CustomCol[];
}) {

  const overriddenRef = useRef(readMeta(row).auto_excl === false);
  const [exclDisplay, setExclDisplay] = useState<number>(
    computeNetExcl(row, { gstRate, autoExcl }),
  );
  // Recompute display whenever inputs or metadata change.
  useEffect(() => {
    overriddenRef.current = readMeta(row).auto_excl === false;
    setExclDisplay(computeNetExcl(row, { gstRate, autoExcl }));
  }, [row, gstRate, autoExcl]);

  const update = (patch: Partial<LedgerEntry>) => onUpdate(row.id, patch);

  const handleInclChange = (incl: number) => {
    if (!overriddenRef.current) {
      // Recompute excl using effective metadata + defaults.
      const synthetic: LedgerEntry = { ...row, amount_inclusive_gst: incl };
      const excl = computeNetExcl(synthetic, { gstRate, autoExcl });
      setExclDisplay(excl);
      update({ amount_inclusive_gst: incl, amount_excluding_gst: excl });
    } else {
      update({ amount_inclusive_gst: incl });
    }
  };

  const handleExclChange = (excl: number) => {
    overriddenRef.current = true;
    setExclDisplay(excl);
    const meta = { ...readMeta(row), auto_excl: false };
    update({ amount_excluding_gst: excl, metadata: meta });
  };

  const handleMetadataChange = (patch: Partial<EntryMeta>) => {
    const nextMeta: EntryMeta = { ...readMeta(row), ...patch };
    // Recompute excl unless user manually overrode.
    if (nextMeta.auto_excl !== false) {
      const synthetic: LedgerEntry = { ...row, metadata: nextMeta };
      const excl = computeNetExcl(synthetic, { gstRate, autoExcl });
      setExclDisplay(excl);
      update({ metadata: nextMeta, amount_excluding_gst: excl });
    } else {
      update({ metadata: nextMeta });
    }
  };

  const handleCustomChange = (colId: string, value: string) => {
    const meta = readMeta(row);
    const custom = { ...(meta.custom ?? {}), [colId]: value };
    update({ metadata: { ...meta, custom } });
  };


  const tdStyle: React.CSSProperties = {
    padding: 0,
    borderBottom: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
    overflow: "hidden",
  };
  const ro = !canEdit;
  const onKey = (c: number) => (e: React.KeyboardEvent<HTMLInputElement>) => handleCellKey(e, rowIndex, c, totalRows);
  const focusStyle: React.CSSProperties = { ...cellStyle };

  return (
    <tr
      style={{ transition: "background .12s" }}
      onMouseOver={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--parchment2)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
    >
      <td style={tdStyle}>
        <input
          data-cell={`${rowIndex}:0`}
          type="date"
          defaultValue={row.entry_date ?? ""}
          readOnly={ro}
          onChange={(e) => update({ entry_date: e.target.value || null })}
          onKeyDown={onKey(0)}
          style={focusStyle}
        />
      </td>
      <td style={tdStyle}>
        <input
          data-cell={`${rowIndex}:1`}
          defaultValue={row.name ?? ""}
          readOnly={ro}
          placeholder="—"
          onChange={(e) => update({ name: e.target.value })}
          onKeyDown={onKey(1)}
          style={focusStyle}
        />
      </td>
      <td style={tdStyle}>
        <LookupCell
          value={row.category ?? ""}
          options={categories}
          readOnly={ro}
          cellKey="category"
          rowIndex={rowIndex}
          colIndex={2}
          totalRows={totalRows}
          addLabel="Category"
          onChange={(name) => update({ category: name })}
          onAdd={(name) => onAddCategory(name)}
        />
      </td>
      <td style={tdStyle}>
        <input
          data-cell={`${rowIndex}:3`}
          type="number"
          step="0.01"
          defaultValue={row.amount_inclusive_gst ?? 0}
          readOnly={ro}
          onChange={(e) => handleInclChange(Number(e.target.value) || 0)}
          onKeyDown={onKey(3)}
          style={numCellStyle}
        />
      </td>
      <td style={tdStyle}>
        <input
          data-cell={`${rowIndex}:4`}
          type="number"
          step="0.01"
          value={exclDisplay}
          readOnly={ro}
          onChange={(e) => handleExclChange(Number(e.target.value) || 0)}
          onKeyDown={onKey(4)}
          style={numCellStyle}
          title={autoExcl ? "Auto-calculated from Incl GST. Type to override." : undefined}
        />
      </td>
      <td style={tdStyle}>
        <LookupCell
          value={row.source ?? ""}
          options={sources}
          readOnly={ro}
          cellKey="source"
          rowIndex={rowIndex}
          colIndex={5}
          totalRows={totalRows}
          addLabel="Source"
          onChange={(name) => update({ source: name })}
          onAdd={(name) => onAddSource(name)}
        />
      </td>
      <td style={tdStyle}>
        <input
          data-cell={`${rowIndex}:6`}
          defaultValue={row.notes ?? ""}
          readOnly={ro}
          placeholder="—"
          onChange={(e) => update({ notes: e.target.value })}
          onKeyDown={onKey(6)}
          style={focusStyle}
        />
      </td>
      {/* Optional metadata cells */}
      {visibleOptional.gstApplicable && (
        <td style={tdStyle}>
          <select
            value={String(readMeta(row).gst_applicable ?? autoExcl)}
            disabled={ro}
            onChange={(e) => handleMetadataChange({ gst_applicable: e.target.value === "true" })}
            style={cellStyle}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </td>
      )}
      {visibleOptional.gstRate && (
        <td style={tdStyle}>
          <input
            type="number"
            step="0.5"
            min={0}
            max={50}
            value={readMeta(row).gst_rate ?? gstRate}
            readOnly={ro}
            onChange={(e) => handleMetadataChange({ gst_rate: Number(e.target.value) || 0 })}
            style={numCellStyle}
          />
        </td>
      )}
      {visibleOptional.deduction && (
        <td style={tdStyle}>
          <input
            type="number"
            step="0.01"
            value={readMeta(row).deduction?.amount ?? 0}
            readOnly={ro}
            onChange={(e) => {
              const d = readMeta(row).deduction ?? {};
              handleMetadataChange({ deduction: { ...d, amount: Number(e.target.value) || 0, type: d.type ?? "flat" } });
            }}
            style={numCellStyle}
            title={`Effective: ${formatINR(computeDeductionAmount(row))}`}
          />
        </td>
      )}
      {visibleOptional.dedLabel && (
        <td style={tdStyle}>
          <input
            defaultValue={readMeta(row).deduction?.label ?? ""}
            readOnly={ro}
            placeholder="—"
            onChange={(e) => {
              const d = readMeta(row).deduction ?? {};
              handleMetadataChange({ deduction: { ...d, label: e.target.value } });
            }}
            style={focusStyle}
          />
        </td>
      )}
      {visibleOptional.dedNotes && (
        <td style={tdStyle}>
          <input
            defaultValue={readMeta(row).deduction?.notes ?? ""}
            readOnly={ro}
            placeholder="—"
            onChange={(e) => {
              const d = readMeta(row).deduction ?? {};
              handleMetadataChange({ deduction: { ...d, notes: e.target.value } });
            }}
            style={focusStyle}
          />
        </td>
      )}
      {/* Custom column cells (tracking-only, not used in totals) */}
      {customCols.map((c) => (
        <td key={c.id} style={tdStyle}>
          <input
            defaultValue={readMeta(row).custom?.[c.id] ?? ""}
            readOnly={ro}
            placeholder="—"
            onChange={(e) => handleCustomChange(c.id, e.target.value)}
            style={focusStyle}
          />
        </td>
      ))}
      {canEdit && (
        <td style={{ ...tdStyle, textAlign: "center", overflow: "visible" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <AdvancedPopover
              row={row}
              defaults={{ gstRate, autoExcl }}
              onChange={handleMetadataChange}
            />
            <RowActionsMenu
              onInsert={onInsert}
              onDuplicate={onDuplicate}
              onDelete={() => onDelete(row.id)}
            />
          </div>
        </td>
      )}
    </tr>
  );
}

function AdvancedPopover({
  row,
  defaults,
  onChange,
}: {
  row: LedgerEntry;
  defaults: { gstRate: number; autoExcl: boolean };
  onChange: (patch: Partial<EntryMeta>) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const meta = readMeta(row);
  const ded = meta.deduction ?? {};
  const gstApplicable = meta.gst_applicable ?? defaults.autoExcl;
  const gstRate = meta.gst_rate ?? defaults.gstRate;
  const autoCalc = meta.auto_excl !== false;
  const dedEffective = computeDeductionAmount(row);
  const net = computeNetExcl(row, defaults);

  const label: React.CSSProperties = { fontSize: 10.5, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 3, display: "block" };
  const inp: React.CSSProperties = { width: "100%", padding: "5px 8px", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 5, background: "var(--ivory)", fontFamily: "'Figtree',sans-serif" };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Advanced: GST + deductions"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink3)", fontSize: 14, padding: "2px 4px", lineHeight: 1 }}
      >
        ⚙
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4,
            background: "var(--ivory)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 12px 30px -12px rgba(0,0,0,.25)",
            zIndex: 100, width: 300, padding: 14, textAlign: "left",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, marginBottom: 8 }}>Row settings</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={label}>GST Applicable</label>
              <select
                value={String(gstApplicable)}
                onChange={(e) => onChange({ gst_applicable: e.target.value === "true" })}
                style={inp}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label style={label}>GST Rate %</label>
              <input
                type="number"
                min={0}
                max={50}
                step="0.5"
                value={gstRate}
                onChange={(e) => onChange({ gst_rate: Number(e.target.value) || 0 })}
                style={{ ...inp, fontFamily: "'DM Mono',monospace" }}
              />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink3)", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={autoCalc}
              onChange={(e) => onChange({ auto_excl: e.target.checked })}
            />
            Auto-calc Excl GST (uncheck to lock manual override)
          </label>

          <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0 10px" }} />
          <div style={{ fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Deduction</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={label}>Type</label>
              <select
                value={ded.type ?? "flat"}
                onChange={(e) => onChange({ deduction: { ...ded, type: e.target.value as "flat" | "percent" } })}
                style={inp}
              >
                <option value="flat">Flat ₹</option>
                <option value="percent">Percent %</option>
              </select>
            </div>
            <div>
              <label style={label}>Amount</label>
              <input
                type="number"
                step="0.01"
                value={ded.amount ?? 0}
                onChange={(e) => onChange({ deduction: { ...ded, amount: Number(e.target.value) || 0, type: ded.type ?? "flat" } })}
                style={{ ...inp, fontFamily: "'DM Mono',monospace" }}
              />
            </div>
          </div>
          <label style={label}>Label</label>
          <input
            value={ded.label ?? ""}
            onChange={(e) => onChange({ deduction: { ...ded, label: e.target.value } })}
            placeholder="e.g. Razorpay fee"
            style={{ ...inp, marginBottom: 8 }}
          />
          <label style={label}>Notes</label>
          <textarea
            value={ded.notes ?? ""}
            onChange={(e) => onChange({ deduction: { ...ded, notes: e.target.value } })}
            rows={2}
            style={{ ...inp, resize: "vertical" }}
          />

          <div style={{ borderTop: "1px solid var(--border)", margin: "10px 0 6px" }} />
          <div style={{ fontSize: 11.5, color: "var(--ink3)", display: "flex", justifyContent: "space-between" }}>
            <span>Effective deduction</span>
            <span style={{ fontFamily: "'DM Mono',monospace" }}>{formatINR(dedEffective)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)", display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span>Net / Excl GST</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{formatINR(net)}</span>
          </div>
        </div>
      )}
    </div>
  );
}





/* ─────────────────────────────── Profit Splits ─────────────────────────────── */

function ProfitSplitsPanel({
  clientId,
  splits,
  setSplits,
  grossProfit,
  canEdit,
  warning,
  totalPercent,
  enqueueSave,
}: {
  clientId: string;
  splits: ProfitSplit[];
  setSplits: React.Dispatch<React.SetStateAction<ProfitSplit[]>>;
  grossProfit: number;
  canEdit: boolean;
  warning: boolean;
  totalPercent: number;
  enqueueSave: (kind: "entry" | "split", id: string, patch: any) => void;
}) {
  const queue = (id: string, patch: Partial<ProfitSplit>) => {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    enqueueSave("split", id, patch);
  };

  const addSplit = async (preset?: Partial<ProfitSplit>) => {
    try {
      const next = await createProfitSplit(clientId, {
        receiver_name: preset?.receiver_name ?? "",
        receiver_type: preset?.receiver_type ?? "Partner",
        split_percent: preset?.split_percent ?? 0,
        is_marketizers_revenue: preset?.is_marketizers_revenue ?? false,
        sort_order: splits.length,
      });
      setSplits((prev) => [...prev, next]);
    } catch {}
  };

  const removeSplit = async (id: string) => {
    setSplits((prev) => prev.filter((s) => s.id !== id));
    void deleteProfitSplit(id).catch(() => {});
  };

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Profit Distribution</div>
          <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 2 }}>
            Splits apply to Gross Profit · Total {totalPercent.toFixed(2)}%
            {warning && (
              <span style={{ color: "var(--red)", marginLeft: 8 }}>
                ⚠ split total should equal 100%
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {splits.length === 0 && (
              <button
                className="btn-sm"
                onClick={() => {
                  void addSplit({ receiver_name: "Marketizers", receiver_type: "Marketizers", split_percent: 100, is_marketizers_revenue: true });
                }}
                title="Quick setup: Marketizers 100%"
              >
                ⚙ Set Profit Split
              </button>
            )}
            <button className="btn-sm btn-primary" onClick={() => void addSplit()}>
              + Add Receiver
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headStyle}>Receiver Name</th>
              <th style={headStyle}>Type</th>
              <th style={{ ...headStyle, textAlign: "right", width: 110 }}>Share %</th>
              <th style={{ ...headStyle, textAlign: "right", width: 140 }}>Amount</th>
              <th style={{ ...headStyle, width: 150 }}>Marketizers Revenue?</th>
              {canEdit && <th style={{ ...headStyle, width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {splits.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} style={{ padding: 24, textAlign: "center", color: "var(--ink4)", fontSize: 12.5 }}>
                  No split rules yet. Add receivers to distribute Gross Profit.
                </td>
              </tr>
            )}
            {splits.map((s) => {
              const amt = (Number(s.split_percent || 0) / 100) * grossProfit;
              return (
                <tr key={s.id}>
                  <td style={{ padding: 0, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                    <input
                      defaultValue={s.receiver_name}
                      readOnly={!canEdit}
                      placeholder="Name"
                      onChange={(e) => queue(s.id, { receiver_name: e.target.value })}
                      style={cellStyle}
                    />
                  </td>
                  <td style={{ padding: 0, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                    <select
                      defaultValue={s.receiver_type}
                      disabled={!canEdit}
                      onChange={(e) =>
                        queue(s.id, {
                          receiver_type: e.target.value as ProfitSplit["receiver_type"],
                          is_marketizers_revenue: e.target.value === "Marketizers",
                        })
                      }
                      style={cellStyle}
                    >
                      <option>Marketizers</option>
                      <option>Partner</option>
                      <option>Other</option>
                    </select>
                  </td>
                  <td style={{ padding: 0, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={s.split_percent}
                      readOnly={!canEdit}
                      onChange={(e) => queue(s.id, { split_percent: Number(e.target.value) || 0 })}
                      style={numCellStyle}
                    />
                  </td>
                  <td style={{ ...numCellStyle, padding: "8px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                    {formatINR(amt)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      defaultChecked={s.is_marketizers_revenue}
                      disabled={!canEdit}
                      onChange={(e) => queue(s.id, { is_marketizers_revenue: e.target.checked })}
                    />
                  </td>
                  {canEdit && (
                    <td style={{ borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                      <button
                        onClick={() => removeSplit(s.id)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14, padding: 4 }}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Category Breakdown ─────────────────────────────── */

function CategoryBreakdown({ title, rows }: { title: string; rows: LedgerEntry[] }) {
  const byCat = useMemo(() => {
    const map = new Map<string, { incl: number; excl: number }>();
    for (const r of rows) {
      const k = r.category?.trim() || "Uncategorized";
      const cur = map.get(k) ?? { incl: 0, excl: 0 };
      cur.incl += Number(r.amount_inclusive_gst || 0);
      cur.excl += Number(r.amount_excluding_gst || 0);
      map.set(k, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].excl - a[1].excl);
  }, [rows]);

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headStyle}>Category</th>
            <th style={{ ...headStyle, textAlign: "right" }}>Incl GST</th>
            <th style={{ ...headStyle, textAlign: "right" }}>Excl GST</th>
          </tr>
        </thead>
        <tbody>
          {byCat.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 18, textAlign: "center", color: "var(--ink4)", fontSize: 12.5 }}>
                No data.
              </td>
            </tr>
          )}
          {byCat.map(([cat, v]) => (
            <tr key={cat}>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>{cat}</td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                {formatINR(v.incl)}
              </td>
              <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                {formatINR(v.excl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
