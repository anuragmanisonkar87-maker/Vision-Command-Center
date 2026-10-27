import { useEffect, useMemo, useState } from "react";
import {
  bulkCreateLedgerEntries,
  listMappingTemplates,
  saveMappingTemplate,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerImportRow,
  type MappingTemplate,
} from "@/services/marketizers/clientLedgerService";
import { formatINR, formatMonthLabel } from "@/utils/formatters/format";
import { supabase } from "@/integrations/supabase/client";


type Field =
  | "ignore"
  | "entry_type"
  | "entry_date"
  | "name"
  | "category"
  | "amount_inclusive_gst"
  | "amount_excluding_gst"
  | "source"
  | "notes";

const FIELD_LABELS: Record<Field, string> = {
  ignore: "— Ignore —",
  entry_type: "Type (income/expense)",
  entry_date: "Date",
  name: "Name / Payer / Expense",
  category: "Category",
  amount_inclusive_gst: "Amount Incl GST / Received",
  amount_excluding_gst: "Amount Excl GST",
  source: "Source / Paid By",
  notes: "Notes / Remarks",
};

const HEADER_HINTS: Array<[RegExp, Field]> = [
  [/^(type|entry.?type|kind)$/i, "entry_type"],
  [/(date|day|received.?on|paid.?on)/i, "entry_date"],
  [/(incl.*gst|inclusive|payment.?received|received|amount.?incl|gross.?amount)/i, "amount_inclusive_gst"],
  [/(excl.*gst|excluding|amount.?excl|net.?amount|excluding.?gst.*charges?)/i, "amount_excluding_gst"],
  // Source / paid-by / vendor — must run BEFORE name, so "Vendor"/"Paid By" don't get pulled into name.
  [/^(vendor|paid.?by|source|remark|remarks|mode|channel)$/i, "source"],
  // Name candidates — expense-side first, then client/payer.
  [/^(expense.?name|expense|description|particulars?|item|item.?name)$/i, "name"],
  [/^(client|student|payer|customer|name|payer.?name|client.?name)$/i, "name"],
  // Category — strict: only real category-style headers, never "head" / "header".
  [/^(category|expense.?category|type.?of.?expense)$/i, "category"],
  [/(note|comment)/i, "notes"],
];


function detectField(header: string): Field {
  const h = header.trim();
  for (const [rx, f] of HEADER_HINTS) if (rx.test(h)) return f;
  return "ignore";
}

function parsePaste(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const split = (line: string): string[] => {
    if (sep === "\t") return line.split("\t").map((c) => c.trim());
    // simple CSV (handles quoted values)
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

function parseNum(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[₹,\s]/g, "").replace(/[^\d.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function dedupeKey(r: {
  entry_type: string;
  entry_date: string | null;
  name: string | null;
  amount_excluding_gst: number;
  source: string | null;
}): string {
  return [
    r.entry_type,
    r.entry_date ?? "",
    (r.name ?? "").trim().toLowerCase(),
    r.amount_excluding_gst.toFixed(2),
    (r.source ?? "").trim().toLowerCase(),
  ].join("|");
}

export function LedgerImportDialog({
  open,
  onOpenChange,
  clientId,
  month,
  existingEntries,
  defaultType,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  month: string;
  existingEntries: LedgerEntry[];
  defaultType: LedgerEntryType;
  onImported: (rows: LedgerEntry[]) => void;
}) {
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paste, setPaste] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [rowType, setRowType] = useState<LedgerEntryType>(defaultType);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  // AI Smart Import state
  const [aiPaste, setAiPaste] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRows, setAiRows] = useState<(LedgerImportRow & { _approved: boolean })[]>([]);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [aiDupNotes, setAiDupNotes] = useState<string[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listMappingTemplates(clientId).then(setTemplates).catch(() => {});
  }, [open, clientId]);

  const reset = () => {
    setTab("manual");
    setStep(1);
    setPaste("");
    setHeaders([]);
    setRawRows([]);
    setMapping([]);
    setRowType(defaultType);
    setImporting(false);
    setErr(null);
    setSourceName("");
    setSaveTemplateName("");
    setAiPaste("");
    setAiLoading(false);
    setAiRows([]);
    setAiWarnings([]);
    setAiDupNotes([]);
    setAiConfidence(null);
    setAiAnalyzed(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const applyTemplate = (tpl: MappingTemplate) => {
    // Map by header name; fall back to detected
    const next = headers.map((h) => {
      const idx = tpl.headers.findIndex(
        (th) => th.trim().toLowerCase() === h.trim().toLowerCase(),
      );
      return (idx >= 0 ? (tpl.mapping[idx] as Field) : detectField(h)) ?? "ignore";
    });
    setMapping(next);
    setRowType(tpl.default_row_type);
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    setSavingTpl(true);
    try {
      const t = await saveMappingTemplate(
        saveTemplateName.trim(),
        headers,
        mapping as string[],
        rowType,
        clientId,
      );
      setTemplates((p) => [t, ...p]);
      setSaveTemplateName("");
    } catch (e: any) {
      setErr(e?.message ?? "Could not save template.");
    } finally {
      setSavingTpl(false);
    }
  };


  const handleParse = () => {
    const { headers: h, rows: r } = parsePaste(paste);
    if (!h.length) {
      setErr("No data detected. Paste a header row followed by data rows.");
      return;
    }
    setHeaders(h);
    setRawRows(r);
    setMapping(h.map(detectField));
    setErr(null);
    setStep(2);
  };

  const prepared = useMemo<{
    valid: LedgerImportRow[];
    skipped: number;
    duplicates: number;
  }>(() => {
    if (step < 3 && step !== 2) return { valid: [], skipped: 0, duplicates: 0 };
    const typeIdx = mapping.findIndex((m) => m === "entry_type");
    const dateIdx = mapping.findIndex((m) => m === "entry_date");
    const nameIdx = mapping.findIndex((m) => m === "name");
    const catIdx = mapping.findIndex((m) => m === "category");
    const inclIdx = mapping.findIndex((m) => m === "amount_inclusive_gst");
    const exclIdx = mapping.findIndex((m) => m === "amount_excluding_gst");
    const srcIdx = mapping.findIndex((m) => m === "source");
    const noteIdx = mapping.findIndex((m) => m === "notes");

    const existingKeys = new Set(
      existingEntries.map((e) =>
        dedupeKey({
          entry_type: e.entry_type,
          entry_date: e.entry_date,
          name: e.name,
          amount_excluding_gst: Number(e.amount_excluding_gst || 0),
          source: e.source,
        }),
      ),
    );

    const seen = new Set<string>();
    const valid: LedgerImportRow[] = [];
    let skipped = 0;
    let duplicates = 0;

    for (const row of rawRows) {
      if (row.every((c) => !c || !c.trim())) {
        continue;
      }
      let type: LedgerEntryType = rowType;
      if (typeIdx >= 0) {
        const v = (row[typeIdx] ?? "").toLowerCase();
        if (v.startsWith("inc")) type = "income";
        else if (v.startsWith("exp")) type = "expense";
      }
      const incl = inclIdx >= 0 ? parseNum(row[inclIdx]) : 0;
      const excl = exclIdx >= 0 ? parseNum(row[exclIdx]) : incl;
      const finalIncl = incl || excl;
      const finalExcl = excl || incl;
      if (!finalIncl && !finalExcl) {
        skipped++;
        continue;
      }
      const prepared: LedgerImportRow = {
        entry_type: type,
        entry_date: dateIdx >= 0 ? parseDate(row[dateIdx]) : null,
        name: nameIdx >= 0 ? row[nameIdx] || null : null,
        category: catIdx >= 0 ? row[catIdx] || null : null,
        amount_inclusive_gst: finalIncl,
        amount_excluding_gst: finalExcl,
        source: srcIdx >= 0 ? row[srcIdx] || null : null,
        notes: noteIdx >= 0 ? row[noteIdx] || null : null,
      };
      const key = dedupeKey(prepared);
      if (existingKeys.has(key) || seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      valid.push(prepared);
    }
    return { valid, skipped, duplicates };
  }, [step, mapping, rawRows, existingEntries, rowType]);

  const stats = useMemo(() => {
    const incomeRows = prepared.valid.filter((r) => r.entry_type === "income");
    const expenseRows = prepared.valid.filter((r) => r.entry_type === "expense");
    const incomeTotal = incomeRows.reduce((s, r) => s + r.amount_excluding_gst, 0);
    const expenseTotal = expenseRows.reduce((s, r) => s + r.amount_excluding_gst, 0);
    return {
      incomeCount: incomeRows.length,
      expenseCount: expenseRows.length,
      incomeTotal,
      expenseTotal,
      grossProfitImpact: incomeTotal - expenseTotal,
    };
  }, [prepared]);

  const handleImport = async () => {
    setImporting(true);
    setErr(null);
    try {
      const { entries: created } = await bulkCreateLedgerEntries(
        clientId,
        month,
        prepared.valid,
        {
          source_name: sourceName.trim() || null,
          rows_skipped: prepared.skipped,
          duplicates_skipped: prepared.duplicates,
        },
      );
      onImported(created);

      reset();
      onOpenChange(false);
    } catch (e: any) {
      setErr(e?.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  // === AI Smart Import ===
  const handleAnalyzeAi = async () => {
    if (!aiPaste.trim()) return;
    setAiLoading(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("You must be signed in.");
      const url = `${(supabase as any).supabaseUrl}/functions/v1/ai-ledger-import`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paste: aiPaste,
          defaultMonth: month,
          defaultType: rowType,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "ai_not_configured") {
          throw new Error("AI import is not configured yet.");
        }
        throw new Error(json?.message || json?.error || `AI request failed (${res.status})`);
      }
      const draft = json?.draft ?? {};
      const income = Array.isArray(draft.income_rows) ? draft.income_rows : [];
      const expense = Array.isArray(draft.expense_rows) ? draft.expense_rows : [];
      const mapToRow = (r: any, t: LedgerEntryType) => {
        const incl = Number(r.amount_inclusive_gst) || 0;
        const excl = Number(r.amount_excluding_gst) || 0;
        const finalIncl = incl || excl;
        const finalExcl = excl || incl;
        return {
          entry_type: t,
          entry_date: r.entry_date ?? null,
          name: r.name ?? null,
          category: r.category ?? null,
          amount_inclusive_gst: finalIncl,
          amount_excluding_gst: finalExcl,
          source: r.source ?? null,
          notes: r.notes ?? null,
          _approved: true,
        };
      };
      const rows = [
        ...income.map((r: any) => mapToRow(r, "income" as LedgerEntryType)),
        ...expense.map((r: any) => mapToRow(r, "expense" as LedgerEntryType)),
      ];
      setAiRows(rows);
      setAiWarnings(Array.isArray(draft.warnings) ? draft.warnings : []);
      setAiDupNotes(Array.isArray(draft.duplicate_risk_notes) ? draft.duplicate_risk_notes : []);
      setAiConfidence(typeof draft.confidence_score === "number" ? draft.confidence_score : null);
      setAiAnalyzed(true);
    } catch (e: any) {
      setErr(e?.message ?? "AI analysis failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const updateAiRow = (i: number, patch: Partial<(typeof aiRows)[number]>) => {
    setAiRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeAiRow = (i: number) => {
    setAiRows((rows) => rows.filter((_, idx) => idx !== i));
  };

  const aiApprovedRows: LedgerImportRow[] = useMemo(
    () =>
      aiRows
        .filter((r) => r._approved && (r.amount_inclusive_gst > 0 || r.amount_excluding_gst > 0))
        .map(({ _approved, ...rest }) => rest),
    [aiRows],
  );

  const handleAiImport = async () => {
    if (!aiApprovedRows.length) return;
    setImporting(true);
    setErr(null);
    try {
      // Duplicate prevention — match manual import behaviour
      const existingKeys = new Set(
        existingEntries.map((e) =>
          dedupeKey({
            entry_type: e.entry_type,
            entry_date: e.entry_date,
            name: e.name,
            amount_excluding_gst: Number(e.amount_excluding_gst || 0),
            source: e.source,
          }),
        ),
      );
      const seen = new Set<string>();
      const deduped: LedgerImportRow[] = [];
      let duplicates = 0;
      for (const r of aiApprovedRows) {
        const key = dedupeKey(r);
        if (existingKeys.has(key) || seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        deduped.push(r);
      }
      if (!deduped.length) {
        setErr(`All ${duplicates} approved row(s) match existing ledger entries — nothing to import.`);
        setImporting(false);
        return;
      }
      const label = sourceName.trim()
        ? `AI Smart Import: ${sourceName.trim()}`
        : "AI Smart Import";
      const { entries: created } = await bulkCreateLedgerEntries(
        clientId,
        month,
        deduped,
        {
          source_name: label,
          rows_skipped: aiRows.length - aiApprovedRows.length,
          duplicates_skipped: duplicates,
        },
      );
      onImported(created);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      setErr(e?.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  };


  if (!open) return null;

  return (
    <div
      onClick={() => handleClose(false)}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 80,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--parchment)", borderRadius: 10, width: "min(820px, 100%)",
          maxHeight: "88vh", overflowY: "auto",
          border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,.4)",
        }}
      >
        <div style={{ padding: "20px 24px 12px", borderBottom: "1px solid var(--border)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Import Rows · {formatMonthLabel(month)}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink4)", marginBottom: 10 }}>
            {tab === "manual"
              ? `Step ${step} of 3 — ${step === 1 ? "Paste data" : step === 2 ? "Map columns" : "Preview & import"}`
              : "AI Smart Import — paste messy data, review AI suggestions, import."}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["manual", "ai"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setErr(null); }}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  background: tab === t ? "var(--ink)" : "transparent",
                  color: tab === t ? "var(--parchment)" : "var(--ink4)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === "manual" ? "Manual Import" : "✨ AI Smart Import"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {err && (
          <div style={{ color: "var(--red)", fontSize: 12.5, padding: "6px 10px", background: "rgba(255,0,0,0.05)", border: "1px solid rgba(255,0,0,0.2)", borderRadius: 6 }}>
            {err}
          </div>
        )}

        {tab === "ai" && (
          <AiSmartImportPanel
            paste={aiPaste}
            setPaste={setAiPaste}
            loading={aiLoading}
            onAnalyze={handleAnalyzeAi}
            analyzed={aiAnalyzed}
            rows={aiRows}
            updateRow={updateAiRow}
            removeRow={removeAiRow}
            warnings={aiWarnings}
            dupNotes={aiDupNotes}
            confidence={aiConfidence}
            sourceName={sourceName}
            setSourceName={setSourceName}
          />
        )}

        {tab === "manual" && step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink4)" }}>
              Paste rows from Google Sheets / Excel / CSV. Include a header row.
              Default type for rows: <strong>{rowType}</strong> (overridden if a Type column is mapped).
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ fontSize: 12 }}>
                <input
                  type="radio"
                  checked={rowType === "income"}
                  onChange={() => setRowType("income")}
                />{" "}
                Income
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="radio"
                  checked={rowType === "expense"}
                  onChange={() => setRowType("expense")}
                />{" "}
                Expense
              </label>
            </div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Date\tName\tIncl GST\tExcl GST\tSource\n2026-06-01\tAcme\t10000\t8475\tRazorpay"}
              rows={10}
              style={{
                width: "100%",
                fontFamily: "'DM Mono',monospace",
                fontSize: 12,
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--parchment)",
                color: "var(--ink)",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--ink4)" }}>
              Or upload a CSV file:{" "}
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setPaste(await f.text());
                }}
              />
            </div>
            <label style={{ fontSize: 11.5, color: "var(--ink4)", display: "flex", flexDirection: "column", gap: 4 }}>
              Source name (e.g. "June Sheet", "Razorpay export")
              <input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Optional label for this import batch"
                style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              />
            </label>
          </div>
        )}

        {tab === "manual" && step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {templates.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 10px", background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 6 }}>
                <span style={{ color: "var(--ink4)" }}>Apply saved mapping:</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                    e.target.value = "";
                  }}
                  style={{ padding: 4, fontSize: 12 }}
                >
                  <option value="">— Select template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: "var(--ink4)" }}>
              Detected {headers.length} columns and {rawRows.length} data rows. Map each column.
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid var(--border)" }}>Source Column</th>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid var(--border)" }}>Sample</th>
                  <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid var(--border)" }}>Map To</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{h}</td>
                    <td style={{ padding: 6, borderBottom: "1px solid var(--border)", color: "var(--ink4)", fontFamily: "'DM Mono',monospace" }}>
                      {rawRows[0]?.[i] ?? "—"}
                    </td>
                    <td style={{ padding: 6, borderBottom: "1px solid var(--border)" }}>
                      <select
                        value={mapping[i] ?? "ignore"}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as Field;
                          setMapping(next);
                        }}
                        style={{ padding: 4, fontSize: 12 }}
                      >
                        {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12.5, color: "var(--ink4)" }}>
              Preview after mapping: {prepared.valid.length} valid · {prepared.duplicates} duplicate · {prepared.skipped} skipped
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
              <span style={{ color: "var(--ink4)" }}>Save this mapping as template:</span>
              <input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="Template name"
                style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, flex: 1 }}
              />
              <button
                className="btn-sm"
                onClick={() => void handleSaveTemplate()}
                disabled={!saveTemplateName.trim() || savingTpl || !headers.length}
              >
                {savingTpl ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}


        {tab === "manual" && step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <Stat label="Rows detected" value={String(rawRows.length)} />
              <Stat label="Valid to import" value={String(prepared.valid.length)} />
              <Stat label="Income rows" value={String(stats.incomeCount)} />
              <Stat label="Expense rows" value={String(stats.expenseCount)} />
              <Stat label="Duplicates skipped" value={String(prepared.duplicates)} />
              <Stat label="Empty/invalid skipped" value={String(prepared.skipped)} />
              <Stat label="Income total (excl GST)" value={formatINR(stats.incomeTotal)} />
              <Stat label="Expense total (excl GST)" value={formatINR(stats.expenseTotal)} />
              <Stat label="Gross profit impact" value={formatINR(stats.grossProfitImpact)} emphasis />
            </div>
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "var(--parchment2)" }}>
                    <th style={pHead}>Type</th>
                    <th style={pHead}>Date</th>
                    <th style={pHead}>Name</th>
                    <th style={pHead}>Category</th>
                    <th style={{ ...pHead, textAlign: "right" }}>Incl</th>
                    <th style={{ ...pHead, textAlign: "right" }}>Excl</th>
                    <th style={pHead}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {prepared.valid.map((r, i) => (
                    <tr key={i}>
                      <td style={pCell}>{r.entry_type}</td>
                      <td style={pCell}>{r.entry_date ?? "—"}</td>
                      <td style={pCell}>{r.name ?? "—"}</td>
                      <td style={pCell}>{r.category ?? "—"}</td>
                      <td style={{ ...pCell, textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{formatINR(r.amount_inclusive_gst)}</td>
                      <td style={{ ...pCell, textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{formatINR(r.amount_excluding_gst)}</td>
                      <td style={pCell}>{r.source ?? "—"}</td>
                    </tr>
                  ))}
                  {prepared.valid.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--ink4)" }}>
                        Nothing to import.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--ivory)", display: "flex", justifyContent: "flex-end", gap: 8, borderRadius: "0 0 10px 10px", flexWrap: "wrap" }}>
          {tab === "manual" && step > 1 && (
            <button className="btn-sm" onClick={() => setStep((step - 1) as 1 | 2)} disabled={importing}>
              ← Back
            </button>
          )}
          <button className="btn-sm" onClick={() => handleClose(false)} disabled={importing}>
            Cancel
          </button>
          {tab === "manual" && step === 1 && (
            <button className="btn-sm btn-primary" onClick={handleParse} disabled={!paste.trim()}>
              Parse →
            </button>
          )}
          {tab === "manual" && step === 2 && (
            <button className="btn-sm btn-primary" onClick={() => setStep(3)}>
              Preview →
            </button>
          )}
          {tab === "manual" && step === 3 && (
            <button
              className="btn-sm btn-primary"
              onClick={handleImport}
              disabled={importing || prepared.valid.length === 0}
            >
              {importing ? "Importing…" : `Import ${prepared.valid.length} rows`}
            </button>
          )}
          {tab === "ai" && aiAnalyzed && (
            <button
              className="btn-sm btn-primary"
              onClick={handleAiImport}
              disabled={importing || aiApprovedRows.length === 0}
            >
              {importing ? "Importing…" : `Import ${aiApprovedRows.length} approved rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)" }}>
      <span style={{ color: "var(--ink4)" }}>{label}</span>
      <span style={{ fontWeight: emphasis ? 700 : 500, fontFamily: "'DM Mono',monospace" }}>{value}</span>
    </div>
  );
}

const pHead: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  color: "var(--ink4)",
  fontFamily: "'DM Mono',monospace",
};

const pCell: React.CSSProperties = {
  padding: "5px 8px",
  borderBottom: "1px solid var(--border)",
};

type AiRow = LedgerImportRow & { _approved: boolean };

function AiSmartImportPanel({
  paste,
  setPaste,
  loading,
  onAnalyze,
  analyzed,
  rows,
  updateRow,
  removeRow,
  warnings,
  dupNotes,
  confidence,
  sourceName,
  setSourceName,
}: {
  paste: string;
  setPaste: (v: string) => void;
  loading: boolean;
  onAnalyze: () => void;
  analyzed: boolean;
  rows: AiRow[];
  updateRow: (i: number, patch: Partial<AiRow>) => void;
  removeRow: (i: number) => void;
  warnings: string[];
  dupNotes: string[];
  confidence: number | null;
  sourceName: string;
  setSourceName: (v: string) => void;
}) {
  const approvedCount = rows.filter((r) => r._approved).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--ink4)", lineHeight: 1.5 }}>
        Paste messy sheet/CSV/table data — including mixed income & expense columns. AI suggests clean rows for your review.
        Nothing is saved until you click <strong>Import Approved Rows</strong>.
      </div>
      {!analyzed && (
        <>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Paste anything — Razorpay export, mixed expense sheet, screenshots-as-text, etc.\nAI will figure out income vs expense, categories, and totals."}
            rows={10}
            style={{
              width: "100%",
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--parchment)",
              color: "var(--ink)",
            }}
          />
          <label style={{ fontSize: 11.5, color: "var(--ink4)", display: "flex", flexDirection: "column", gap: 4 }}>
            Source name (optional — e.g. "May Razorpay sheet")
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Label for this AI import batch"
              style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn-sm btn-primary"
              onClick={onAnalyze}
              disabled={loading || !paste.trim()}
            >
              {loading ? "Analyzing…" : "✨ Analyze with AI"}
            </button>
            <span style={{ fontSize: 11, color: "var(--ink4)" }}>
              AI returns a draft for you to review and edit. Manual approval required.
            </span>
          </div>
        </>
      )}
      {analyzed && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12 }}>
            <span style={{ padding: "4px 8px", background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 4 }}>
              {rows.length} suggested · <strong>{approvedCount} approved</strong>
            </span>
            {confidence != null && (
              <span style={{ padding: "4px 8px", background: confidence >= 0.7 ? "rgba(0,150,0,.08)" : "rgba(200,140,0,.1)", border: "1px solid var(--border)", borderRadius: 4 }}>
                Confidence: {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {(warnings.length > 0 || dupNotes.length > 0) && (
            <div style={{ padding: 10, background: "rgba(200,140,0,.08)", border: "1px solid rgba(200,140,0,.3)", borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ AI warnings</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink2)" }}>
                {warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
                {dupNotes.map((w, i) => <li key={`d${i}`}>Possible duplicate: {w}</li>)}
              </ul>
            </div>
          )}
          <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "var(--parchment2)" }}>
                  <th style={pHead}>✓</th>
                  <th style={pHead}>Type</th>
                  <th style={pHead}>Date</th>
                  <th style={pHead}>Name</th>
                  <th style={pHead}>Category</th>
                  <th style={{ ...pHead, textAlign: "right" }}>Incl</th>
                  <th style={{ ...pHead, textAlign: "right" }}>Excl</th>
                  <th style={pHead}>Source</th>
                  <th style={pHead}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ opacity: r._approved ? 1 : 0.45 }}>
                    <td style={pCell}>
                      <input
                        type="checkbox"
                        checked={r._approved}
                        onChange={(e) => updateRow(i, { _approved: e.target.checked })}
                      />
                    </td>
                    <td style={pCell}>
                      <select
                        value={r.entry_type}
                        onChange={(e) => updateRow(i, { entry_type: e.target.value as LedgerEntryType })}
                        style={{ fontSize: 11, padding: 2 }}
                      >
                        <option value="income">income</option>
                        <option value="expense">expense</option>
                      </select>
                    </td>
                    <td style={pCell}>
                      <input
                        value={r.entry_date ?? ""}
                        onChange={(e) => updateRow(i, { entry_date: e.target.value || null })}
                        placeholder="YYYY-MM-DD"
                        style={cellInput}
                      />
                    </td>
                    <td style={pCell}>
                      <input
                        value={r.name ?? ""}
                        onChange={(e) => updateRow(i, { name: e.target.value || null })}
                        style={cellInput}
                      />
                    </td>
                    <td style={pCell}>
                      <input
                        value={r.category ?? ""}
                        onChange={(e) => updateRow(i, { category: e.target.value || null })}
                        style={cellInput}
                      />
                    </td>
                    <td style={pCell}>
                      <input
                        type="number"
                        value={r.amount_inclusive_gst}
                        onChange={(e) => updateRow(i, { amount_inclusive_gst: Number(e.target.value) || 0 })}
                        style={{ ...cellInput, textAlign: "right", fontFamily: "'DM Mono',monospace" }}
                      />
                    </td>
                    <td style={pCell}>
                      <input
                        type="number"
                        value={r.amount_excluding_gst}
                        onChange={(e) => updateRow(i, { amount_excluding_gst: Number(e.target.value) || 0 })}
                        style={{ ...cellInput, textAlign: "right", fontFamily: "'DM Mono',monospace" }}
                      />
                    </td>
                    <td style={pCell}>
                      <input
                        value={r.source ?? ""}
                        onChange={(e) => updateRow(i, { source: e.target.value || null })}
                        style={cellInput}
                      />
                    </td>
                    <td style={pCell}>
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => removeRow(i)}
                        style={{ fontSize: 10, padding: "2px 6px" }}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "var(--ink4)" }}>
                      AI did not extract any rows. Try a different paste.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink4)" }}>
            Review each row before importing. Uncheck rows you don't want, or click ✕ to drop them.
          </div>
        </>
      )}
    </div>
  );
}

const cellInput: React.CSSProperties = {
  fontSize: 11.5,
  padding: "3px 5px",
  border: "1px solid var(--border)",
  borderRadius: 3,
  width: "100%",
  background: "var(--parchment)",
};
