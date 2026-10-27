// Marketizers ROAS Import Wizard — CSV upload / paste flow.
// 5 steps: Source → Preview → Mapping → Review → Complete.
// Reuses computeRoas formulas + saveRoasSession (no duplicate formula system).
import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { WizardStepper, WizardStep, WizardFooter, WizardReviewRow, useWizard } from "@/components/ui/WizardForm";
import { QuickSaveSelect } from "@/components/marketizers/QuickSaveSelect";
import { SearchableCombobox, type ComboOption } from "@/components/marketizers/SearchableCombobox";
import { getMarketizersClients } from "@/services/marketizers/clientsService";
import { getTeamMembers as getDirectoryTeamMembers } from "@/services/teamDirectoryService";
import { computeRoas, num, inr, dec } from "@/lib/marketizers/roasFormulas";
import {
  listImportMappings,
  saveImportMapping,
  deleteImportMapping,
  touchImportMapping,
  findDuplicateRoasSession,
  importRoasRow,
  type ImportMappingTemplate,
} from "@/services/marketizers/roasImportService";
import { downloadCSV } from "@/utils/export/csv";

// ============================================================
// ROAS field catalogue (target fields). Keys map to saveRoasSession payload.
// ============================================================
type FieldDef = { key: string; label: string; required?: boolean; type: "date" | "dateList" | "number" | "text" };
const FIELDS: FieldDef[] = [
  { key: "campaign_date_from", label: "Campaign Date From", required: true, type: "date" },
  { key: "campaign_date_to", label: "Campaign Date To", required: true, type: "date" },
  { key: "event_dates", label: "Event / Webinar / Bootcamp Date(s)", required: true, type: "dateList" },
  { key: "event_day_pattern", label: "Event Day Pattern", type: "text" },
  { key: "campaign_name", label: "Campaign Name", type: "text" },
  { key: "event_name", label: "Event Name", type: "text" },
  { key: "ad_spend", label: "Ad Spend", required: true, type: "number" },
  { key: "leads", label: "Leads", required: true, type: "number" },
  { key: "token_purchases", label: "Token Purchases", type: "number" },
  { key: "final_purchases", label: "Final Purchases", type: "number" },
  { key: "token_amount", label: "Token Amount", type: "number" },
  { key: "product_final_value", label: "Product Value", type: "number" },
  { key: "manual_revenue_override", label: "Total Revenue (override)", type: "number" },
  { key: "cpm", label: "CPM", type: "number" },
  { key: "cpc", label: "CPC", type: "number" },
  { key: "ctr", label: "CTR", type: "number" },
  { key: "showup_count", label: "Show-up Count", type: "number" },
  { key: "offer_showup_count", label: "Offer Show-up Count", type: "number" },
  { key: "heard_count", label: "Heard Count", type: "number" },
  { key: "sales_count", label: "Sales Count", type: "number" },
  { key: "lead_drop_rate", label: "Lead Drop Rate", type: "number" },
  { key: "cpl_drop_percent", label: "CPL Drop %", type: "number" },
  { key: "meta_ad_account", label: "Ad Account", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

// Aliases for auto-mapping. Lowercase, alphanumeric only.
const ALIAS: Record<string, string[]> = {
  campaign_date_from: ["datefrom", "campaigndatefrom", "startdate", "from", "campaignstart"],
  campaign_date_to: ["dateto", "campaigndateto", "enddate", "to", "campaignend"],
  event_dates: ["eventdate", "bootcampdate", "webinardate", "seminardate", "workshopdate", "challengedate", "eventdates"],
  event_day_pattern: ["eventday", "daypattern", "eventdays"],
  campaign_name: ["campaign", "campaignname", "adcampaign"],
  event_name: ["event", "eventname", "webinarname", "bootcampname"],
  ad_spend: ["adspend", "spend", "amountspent", "totaladspend", "cost"],
  leads: ["leads", "totalleads", "leadscount", "leadsgenerated"],
  token_purchases: ["tokenpurchases", "tokenpurchase", "purchase10k", "tokensales", "tokencount"],
  final_purchases: ["finalpurchases", "finalpurchase", "purchasefinal", "finalsales", "purchases"],
  token_amount: ["tokenamount", "tokenvalue", "tokenprice"],
  product_final_value: ["productvalue", "productfinalvalue", "dealvalue", "productprice"],
  manual_revenue_override: ["revenue", "totalrevenue", "grossrevenue", "salesrevenue"],
  cpm: ["cpm"],
  cpc: ["cpc"],
  ctr: ["ctr"],
  showup_count: ["showup", "showupcount", "attendance", "attended"],
  offer_showup_count: ["offershowup", "offershowupcount"],
  heard_count: ["heard", "heardcount"],
  sales_count: ["sales", "salescount"],
  lead_drop_rate: ["leaddroprate", "dropoff"],
  cpl_drop_percent: ["cpldrop", "cpldroppercent"],
  meta_ad_account: ["adaccount", "metaadaccount", "account"],
  notes: ["notes", "remarks", "comment", "comments"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function autoMap(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  const normedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const f of FIELDS) {
    const aliases = ALIAS[f.key] ?? [];
    const hit = normedHeaders.find((h) => aliases.includes(h.n) || h.n === norm(f.key));
    if (hit) m[f.key] = hit.raw;
  }
  return m;
}

// ============================================================
// CSV parser — handles quoted fields, commas, tabs (auto-detect).
// ============================================================
function detectDelim(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const tabs = (head.match(/\t/g) || []).length;
  const commas = (head.match(/,/g) || []).length;
  const semis = (head.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function parseCSV(text: string, delim?: string): string[][] {
  const d = delim ?? detectDelim(text);
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === d) { cur.push(cell); cell = ""; }
      else if (c === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ============================================================
// Value parsing per type
// ============================================================
function parseDate(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // DD/MM/YYYY or D/M/YYYY
  const m1 = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    let [_, dd, mm, yy] = m1;
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return null;
}
function parseDateList(s: string): string[] {
  if (!s) return [];
  return s.split(/[,;|]/).map((x) => parseDate(x)).filter((x): x is string => !!x);
}
function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[₹$,\s]/g, "").replace(/[^\d\.\-]/g, "");
  return num(cleaned);
}

// ============================================================
// Build a ROAS payload from a CSV row using the mapping.
// ============================================================
type BuiltRow = {
  rowIdx: number;
  payload: any;
  status: "ready" | "missing" | "duplicate" | "warning";
  warnings: string[];
  duplicateId?: string;
};

function buildPayload(
  row: string[],
  headers: string[],
  mapping: Record<string, string>,
  base: { client_id: string | null; client_name: string | null; media_buyer_id: string | null; media_buyer_name: string | null; event_type: string | null },
): { payload: any; warnings: string[]; missing: string[] } {
  const idxOf = (h: string) => headers.indexOf(h);
  const get = (field: string) => {
    const col = mapping[field];
    if (!col) return "";
    const i = idxOf(col);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  const payload: any = { ...base, source_type: "import_csv", currency: "INR" };
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const f of FIELDS) {
    const raw = get(f.key);
    if (f.required && !raw) {
      missing.push(f.label);
      continue;
    }
    if (!raw) continue;
    if (f.type === "date") {
      const d = parseDate(raw);
      if (!d) { warnings.push(`${f.label}: could not parse "${raw}"`); continue; }
      payload[f.key] = d;
    } else if (f.type === "dateList") {
      const ds = parseDateList(raw);
      if (!ds.length) { warnings.push(`${f.label}: could not parse "${raw}"`); continue; }
      payload[f.key] = ds;
    } else if (f.type === "number") {
      payload[f.key] = parseNum(raw);
    } else {
      payload[f.key] = raw;
    }
  }

  // Compute ROAS internally (overrides any imported ROAS/PNL).
  const calc = computeRoas({
    ad_spend: payload.ad_spend ?? 0,
    leads: payload.leads ?? 0,
    token_purchases: payload.token_purchases ?? 0,
    final_purchases: payload.final_purchases ?? 0,
    token_amount: payload.token_amount ?? 0,
    product_final_value: payload.product_final_value ?? 0,
    manual_revenue_override: payload.manual_revenue_override ?? null,
    showup_count: payload.showup_count ?? null,
    offer_showup_count: payload.offer_showup_count ?? null,
    heard_count: payload.heard_count ?? null,
    sales_count: payload.sales_count ?? null,
  });
  payload.cpl = calc.cpl;
  payload.cpp = calc.cpp;
  payload.token_revenue = calc.token_revenue;
  payload.final_revenue = calc.final_revenue;
  payload.total_revenue = calc.total_revenue;
  payload.roas = calc.roas;
  payload.pnl = calc.pnl;
  payload.final_purchase_conversion = calc.final_purchase_conversion;
  payload.revenue_per_lead = calc.revenue_per_lead;
  payload.profit_per_lead = calc.profit_per_lead;
  payload.showup_percent = calc.showup_percent;
  payload.offer_showup_percent = calc.offer_showup_percent;

  return { payload, warnings, missing };
}

// ============================================================
// Component
// ============================================================
const STEPS = [
  { key: "source", label: "Source" },
  { key: "preview", label: "Preview" },
  { key: "mapping", label: "Mapping" },
  { key: "review", label: "Review" },
  { key: "done", label: "Complete" },
];

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(20,15,8,0.55)", zIndex: 60,
  display: "flex", alignItems: "stretch", justifyContent: "center", padding: 16,
};
const panel: CSSProperties = {
  background: "var(--parchment)", borderRadius: 12, border: "1px solid var(--gold-border)",
  width: "min(1100px, 100%)", maxHeight: "100%", overflowY: "auto", padding: 20,
};
const inputStyle: CSSProperties = {
  padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13,
  background: "var(--parchment)", width: "100%", fontFamily: "inherit",
};

export function RoasImportWizard({ onClose, onImported }: { onClose: () => void; onImported?: () => void }) {
  const { current, next, prev, jump, isLast } = useWizard(STEPS.map((s) => s.key));

  // ---- Source step ----
  const [importType, setImportType] = useState<"paste" | "upload" | "sheet">("paste");
  const [clients, setClients] = useState<ComboOption[]>([]);
  const [buyers, setBuyers] = useState<ComboOption[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [buyerId, setBuyerId] = useState<string>("");
  const [buyerName, setBuyerName] = useState<string>("");
  const [eventType, setEventType] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [sheetTab, setSheetTab] = useState<string>("");
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [dataStartRow, setDataStartRow] = useState<number>(2);
  const [fileName, setFileName] = useState<string>("");

  // ---- Parsed data ----
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // ---- Mapping ----
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<ImportMappingTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [templateName, setTemplateName] = useState<string>("");

  // ---- Review ----
  const [built, setBuilt] = useState<BuiltRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{
    parsed: number; imported: number; skipped: number; duplicates: number; errors: number;
    totalAdSpend: number; totalLeads: number; totalRevenue: number; avgRoas: number; totalPnl: number;
    errorRows: BuiltRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load dropdowns + templates
  useEffect(() => {
    getMarketizersClients().then((rows) => {
      setClients(rows.map((c: any) => ({ id: c.id, label: c.client_name, sublabel: c.niche ?? null, meta: c.client_name })));
    }).catch(() => {});
    getDirectoryTeamMembers({ positionContains: "media buyer" }).then(async (rows) => {
      if (rows.length === 0) rows = await getDirectoryTeamMembers();
      setBuyers(rows.map((m) => ({ id: m.id, label: m.name, sublabel: m.position_name ?? null, meta: m.name })));
    }).catch(() => {});
    listImportMappings().then(setTemplates).catch(() => {});
  }, []);

  const headers = useMemo(() => {
    if (rawRows.length === 0) return [];
    const idx = Math.max(0, headerRow - 1);
    return (rawRows[idx] ?? []).map((h) => (h ?? "").trim());
  }, [rawRows, headerRow]);

  const dataRows = useMemo(() => {
    if (rawRows.length === 0) return [];
    const start = Math.max(0, dataStartRow - 1);
    return rawRows.slice(start);
  }, [rawRows, dataStartRow]);

  // -- File upload --
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setPastedText(text);
    };
    reader.readAsText(f);
  };

  // -- Parse handler --
  const handleParse = () => {
    setParseError(null);
    setRawRows([]);
    if (importType === "sheet") {
      setParseError("Google Sheet URL import requires API setup. Please use CSV upload or paste CSV for now.");
      return;
    }
    if (!pastedText.trim()) {
      setParseError("No data found. Paste CSV text or upload a CSV file.");
      return;
    }
    try {
      const rows = parseCSV(pastedText);
      if (rows.length === 0) {
        setParseError("Could not parse CSV. Please check the format.");
        return;
      }
      setRawRows(rows);
      next();
    } catch (e: any) {
      setParseError("Could not parse CSV. Please check the format.");
    }
  };

  // -- Auto-map when headers change --
  useEffect(() => {
    if (headers.length > 0 && Object.keys(mapping).length === 0) {
      setMapping(autoMap(headers));
    }
  }, [headers]); // eslint-disable-line

  // -- Build review rows --
  const handleBuildReview = async () => {
    setError(null);
    const base = {
      client_id: clientId || null,
      client_name: clientName || null,
      media_buyer_id: buyerId || null,
      media_buyer_name: buyerName || null,
      event_type: eventType || null,
    };
    const out: BuiltRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      if (r.every((c) => !c || !c.trim())) continue;
      const { payload, warnings, missing } = buildPayload(r, headers, mapping, base);
      let status: BuiltRow["status"] = "ready";
      if (missing.length) status = "missing";
      else if (warnings.length) status = "warning";
      out.push({
        rowIdx: i + dataStartRow,
        payload: { ...payload, ...(missing.length ? { _missing: missing } : {}) },
        status,
        warnings: missing.length ? [`Missing: ${missing.join(", ")}`, ...warnings] : warnings,
      });
    }
    // Dup detection (best-effort, sequential to avoid hammer)
    for (const b of out) {
      if (b.status === "missing") continue;
      try {
        const dupId = await findDuplicateRoasSession({
          client_id: b.payload.client_id,
          client_name: b.payload.client_name,
          campaign_date_from: b.payload.campaign_date_from,
          campaign_date_to: b.payload.campaign_date_to,
          event_dates: b.payload.event_dates,
          event_name: b.payload.event_name,
          campaign_name: b.payload.campaign_name,
        });
        if (dupId) { b.status = "duplicate"; b.duplicateId = dupId; }
      } catch {}
    }
    setBuilt(out);
    setSelected(new Set(out.filter((r) => r.status === "ready" || r.status === "warning").map((_, i) => i)));
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    let imported = 0, skipped = 0, duplicates = 0, errors = 0;
    let totalAdSpend = 0, totalLeads = 0, totalRevenue = 0, totalPnl = 0;
    const roasVals: number[] = [];
    const errorRows: BuiltRow[] = [];
    for (let i = 0; i < built.length; i++) {
      const b = built[i];
      if (!selected.has(i)) { skipped++; continue; }
      if (b.status === "duplicate" && skipDuplicates) { duplicates++; continue; }
      if (b.status === "missing") { errors++; errorRows.push(b); continue; }
      try {
        const { _missing, ...rest } = b.payload;
        await importRoasRow(rest);
        imported++;
        totalAdSpend += Number(rest.ad_spend || 0);
        totalLeads += Number(rest.leads || 0);
        totalRevenue += Number(rest.total_revenue || 0);
        totalPnl += Number(rest.pnl || 0);
        if (rest.roas && Number.isFinite(rest.roas)) roasVals.push(rest.roas);
      } catch (e: any) {
        errors++; errorRows.push({ ...b, warnings: [...b.warnings, e?.message ?? "Insert failed"] });
      }
    }
    setSummary({
      parsed: built.length, imported, skipped, duplicates, errors,
      totalAdSpend, totalLeads, totalRevenue,
      avgRoas: roasVals.length ? roasVals.reduce((s, n) => s + n, 0) / roasVals.length : 0,
      totalPnl, errorRows,
    });
    setImporting(false);
    onImported?.();
    next();
  };

  // -- Template handlers --
  const handleApplyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMapping({ ...t.mapping });
    setActiveTemplateId(id);
    touchImportMapping(id).catch(() => {});
  };
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { setError("Enter a template name."); return; }
    try {
      const id = await saveImportMapping({
        id: activeTemplateId || undefined,
        template_name: templateName.trim(),
        client_id: clientId || null,
        event_type: eventType || null,
        mapping,
      });
      const fresh = await listImportMappings();
      setTemplates(fresh);
      setActiveTemplateId(id);
      setError(null);
    } catch (e: any) { setError(e?.message ?? "Could not save template."); }
  };
  const handleDeleteTemplate = async () => {
    if (!activeTemplateId) return;
    try {
      await deleteImportMapping(activeTemplateId);
      setTemplates(await listImportMappings());
      setActiveTemplateId("");
    } catch (e: any) { setError(e?.message ?? "Could not delete template."); }
  };

  const downloadErrors = () => {
    if (!summary?.errorRows.length) return;
    downloadCSV(
      "ROAS Import - errors,Row,Reason\n" +
      summary.errorRows.map((r) => `,${r.rowIdx},"${r.warnings.join(" | ").replace(/"/g, '""')}"`).join("\n"),
      `roas-import-errors-${Date.now()}.csv`,
    );
  };

  const downloadSummary = () => {
    if (!summary) return;
    const lines = [
      "Metric,Value",
      `Rows parsed,${summary.parsed}`,
      `Rows imported,${summary.imported}`,
      `Rows skipped,${summary.skipped}`,
      `Duplicate rows,${summary.duplicates}`,
      `Error rows,${summary.errors}`,
      `Total ad spend,${dec(summary.totalAdSpend)}`,
      `Total leads,${summary.totalLeads}`,
      `Total revenue,${dec(summary.totalRevenue)}`,
      `Average ROAS,${dec(summary.avgRoas)}`,
      `Total PNL,${dec(summary.totalPnl)}`,
    ];
    downloadCSV(lines.join("\n"), `roas-import-summary-${Date.now()}.csv`);
  };

  // ============================================================
  // Step gates
  // ============================================================
  const sourceValid =
    (clientId || clientName) &&
    (importType === "sheet" || pastedText.trim().length > 0);
  const previewValid = headers.length > 0 && dataRows.length > 0;
  const mappingValid = FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key]);

  const sectionTitle: CSSProperties = {
    fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em",
    textTransform: "uppercase", color: "var(--ink4)",
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "var(--ink)" }}>
              Import ROAS Data
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink4)" }}>
              Upload CSV or paste sheet data to create ROAS records faster.
            </div>
          </div>
          <button className="btn-sm" onClick={onClose}>Close</button>
        </div>

        <WizardStepper steps={STEPS} current={current} onJump={jump} />

        {error && (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-b)", color: "var(--red)", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}

        {/* ============ STEP 1: SOURCE ============ */}
        {current === 0 && (
          <WizardStep title="Import Source" description="Pick how you want to bring rows in.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {([
                { k: "paste", l: "Paste CSV" },
                { k: "upload", l: "Upload CSV" },
                { k: "sheet", l: "Google Sheet URL" },
              ] as const).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setImportType(o.k)}
                  style={{
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${importType === o.k ? "var(--ink)" : "var(--border)"}`,
                    background: importType === o.k ? "var(--ink)" : "var(--ivory)",
                    color: importType === o.k ? "var(--parchment)" : "var(--ink)",
                    fontSize: 13,
                  }}
                >
                  {o.l}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={sectionTitle}>Client *</div>
                <SearchableCombobox
                  options={clients}
                  value={clientName}
                  onChange={(opt) => { setClientId(opt?.id ?? ""); setClientName(opt?.label ?? ""); }}
                  placeholder="Search client…"
                />
              </div>
              <div>
                <div style={sectionTitle}>Media Buyer</div>
                <SearchableCombobox
                  options={buyers}
                  value={buyerName}
                  onChange={(opt) => { setBuyerId(opt?.id ?? ""); setBuyerName(opt?.label ?? ""); }}
                  placeholder="Search media buyer…"
                />
              </div>
              <div>
                <div style={sectionTitle}>Event Type</div>
                <QuickSaveSelect
                  label="Event Type"
                  group="roas_event_type"
                  value={eventType}
                  onChange={setEventType}
                  defaults={["Webinar", "Seminar", "Bootcamp", "Workshop", "Challenge", "Custom"]}
                  placeholder="Select event type…"
                />
              </div>
            </div>

            {importType === "upload" && (
              <div>
                <div style={sectionTitle}>CSV File</div>
                <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} />
                {fileName && <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 4 }}>{fileName}</div>}
              </div>
            )}

            {importType === "paste" && (
              <div>
                <div style={sectionTitle}>Paste CSV (or tab-separated)</div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={10}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
                  placeholder={"Date From,Date To,Bootcamp Date,Ad Spend,Leads,Revenue\n2026-04-01,2026-04-03,2026-04-05,25000,420,180000"}
                />
              </div>
            )}

            {importType === "sheet" && (
              <>
                <div>
                  <div style={sectionTitle}>Google Sheet URL</div>
                  <input style={inputStyle} value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                </div>
                <div>
                  <div style={sectionTitle}>Sheet Tab Name</div>
                  <input style={inputStyle} value={sheetTab} onChange={(e) => setSheetTab(e.target.value)} placeholder="Sheet1" />
                </div>
                <div style={{ background: "var(--gold-bg)", border: "1px solid var(--gold-border)", padding: 10, borderRadius: 6, fontSize: 12.5, color: "var(--ink)" }}>
                  Google Sheet URL import requires API setup. Please use CSV upload or paste CSV for now.
                </div>
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={sectionTitle}>Header Row Number</div>
                <input style={inputStyle} type="number" min={1} value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, parseInt(e.target.value || "1", 10)))} />
              </div>
              <div>
                <div style={sectionTitle}>Data Start Row</div>
                <input style={inputStyle} type="number" min={2} value={dataStartRow} onChange={(e) => setDataStartRow(Math.max(2, parseInt(e.target.value || "2", 10)))} />
              </div>
            </div>

            {parseError && (
              <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-b)", color: "var(--red)", padding: "8px 12px", borderRadius: 6, fontSize: 12 }}>
                {parseError}
              </div>
            )}

            <WizardFooter
              onCancel={onClose}
              onNext={handleParse}
              nextDisabled={!sourceValid || importType === "sheet"}
            />
          </WizardStep>
        )}

        {/* ============ STEP 2: PREVIEW ============ */}
        {current === 1 && (
          <WizardStep title="Preview Rows" description={`Detected ${headers.length} columns and ${dataRows.length} rows.`}>
            {!previewValid && (
              <div style={{ color: "var(--ink4)", fontSize: 13 }}>No rows detected. Go back and check the format.</div>
            )}
            {previewValid && (
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                  <thead style={{ background: "var(--ivory)" }}>
                    <tr>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>#</th>
                      {headers.map((h, i) => (
                        <th key={i} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h || `(col ${i + 1})`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 8px", color: "var(--ink4)" }}>{i + dataStartRow}</td>
                        {headers.map((_, j) => (
                          <td key={j} style={{ padding: "6px 8px", borderTop: "1px solid var(--border)", whiteSpace: "nowrap" }}>{r[j] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <WizardFooter onCancel={onClose} onPrev={prev} onNext={next} nextDisabled={!previewValid} />
          </WizardStep>
        )}

        {/* ============ STEP 3: MAPPING ============ */}
        {current === 2 && (
          <WizardStep title="Column Mapping" description="Match CSV columns to ROAS fields. Required fields are marked.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <div>
                <div style={sectionTitle}>Apply Template</div>
                <select style={inputStyle} value={activeTemplateId} onChange={(e) => e.target.value ? handleApplyTemplate(e.target.value) : setActiveTemplateId("")}>
                  <option value="">— None —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.template_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={sectionTitle}>Template Name (for save)</div>
                <input style={inputStyle} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Aparnaa Bootcamp ROAS Sheet" />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-sm" onClick={handleSaveTemplate}>Save Template</button>
                {activeTemplateId && <button type="button" className="btn-sm" onClick={handleDeleteTemplate}>Delete</button>}
                <button type="button" className="btn-sm" onClick={() => setMapping(autoMap(headers))}>Auto-Map</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", background: "var(--ivory)", ...sectionTitle, borderBottom: "1px solid var(--border)" }}>ROAS Field</div>
              <div style={{ padding: "8px 12px", background: "var(--ivory)", ...sectionTitle, borderBottom: "1px solid var(--border)" }}>CSV Column</div>
              {FIELDS.map((f) => (
                <div key={f.key} style={{ display: "contents" }}>
                  <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                    {f.label} {f.required && <span style={{ color: "var(--red)" }}>*</span>}
                  </div>
                  <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)" }}>
                    <select
                      style={inputStyle}
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h || `(col ${i + 1})`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <WizardFooter
              onCancel={onClose}
              onPrev={prev}
              onNext={async () => { await handleBuildReview(); next(); }}
              nextDisabled={!mappingValid}
            />
          </WizardStep>
        )}

        {/* ============ STEP 4: REVIEW ============ */}
        {current === 3 && (
          <WizardStep title="Import Review" description="Review calculated ROAS/PNL. Pick rows to import.">
            <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12.5 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> Skip duplicates
              </label>
              <button type="button" className="btn-sm" onClick={() => setSelected(new Set(built.map((_, i) => i)))}>Select all</button>
              <button type="button" className="btn-sm" onClick={() => setSelected(new Set(built.filter((b) => b.status === "ready" || b.status === "warning").map((_, i) => i)))}>Select valid</button>
              <button type="button" className="btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              <span style={{ color: "var(--ink4)" }}>{selected.size} of {built.length} selected</span>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6, maxHeight: 360 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead style={{ background: "var(--ivory)", position: "sticky", top: 0 }}>
                  <tr>
                    {["", "Row", "Client", "Event Date", "From → To", "Ad Spend", "Leads", "Revenue", "ROAS", "PNL", "Final P.", "Status"].map((h, i) => (
                      <th key={i} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {built.map((b, i) => {
                    const p = b.payload;
                    const evDate = Array.isArray(p.event_dates) ? p.event_dates.join(", ") : "";
                    const statusColor = b.status === "ready" ? "var(--ink)"
                      : b.status === "warning" ? "var(--gold)"
                      : b.status === "duplicate" ? "var(--ink4)"
                      : "var(--red)";
                    return (
                      <tr key={i} title={b.warnings.join("\n")}>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
                          <input type="checkbox" checked={selected.has(i)} onChange={(e) => {
                            const ns = new Set(selected);
                            if (e.target.checked) ns.add(i); else ns.delete(i);
                            setSelected(ns);
                          }} />
                        </td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{b.rowIdx}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{p.client_name ?? "—"}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{evDate || "—"}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{(p.campaign_date_from ?? "—") + " → " + (p.campaign_date_to ?? "—")}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>₹{inr(p.ad_spend ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{inr(p.leads ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>₹{inr(p.total_revenue ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{dec(p.roas ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>₹{inr(p.pnl ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>{inr(p.final_purchases ?? 0)}</td>
                        <td style={{ padding: "6px 8px", borderTop: "1px solid var(--border)", color: statusColor, textTransform: "capitalize" }}>{b.status}</td>
                      </tr>
                    );
                  })}
                  {built.length === 0 && (
                    <tr><td colSpan={12} style={{ padding: 14, color: "var(--ink4)", textAlign: "center" }}>No rows to review.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <WizardFooter
              onCancel={onClose}
              onPrev={prev}
              onSave={handleImport}
              isLast={false}
              saveDisabled={importing || selected.size === 0}
              saveLabel={importing ? "Importing…" : `Import ${selected.size} row(s)`}
              busy={importing}
              extraActions={
                <button
                  type="button" className="btn-sm" onClick={handleImport} disabled={importing || selected.size === 0}
                  style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}
                >
                  {importing ? "Importing…" : `Import ${selected.size} row(s) →`}
                </button>
              }
            />
          </WizardStep>
        )}

        {/* ============ STEP 5: COMPLETE ============ */}
        {current === 4 && summary && (
          <WizardStep title="Import Complete" description="Summary of the import batch.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
              {[
                ["Parsed", String(summary.parsed)],
                ["Imported", String(summary.imported)],
                ["Skipped", String(summary.skipped)],
                ["Duplicates", String(summary.duplicates)],
                ["Errors", String(summary.errors)],
                ["Total Ad Spend", `₹${inr(summary.totalAdSpend)}`],
                ["Total Leads", inr(summary.totalLeads)],
                ["Total Revenue", `₹${inr(summary.totalRevenue)}`],
                ["Avg ROAS", dec(summary.avgRoas)],
                ["Total PNL", `₹${inr(summary.totalPnl)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <div style={sectionTitle}>{k}</div>
                  <div style={{ fontSize: 18, color: "var(--ink)", fontFamily: "'Cormorant Garamond',serif" }}>{v}</div>
                </div>
              ))}
            </div>

            {summary.errorRows.length > 0 && (
              <div>
                <div style={{ ...sectionTitle, marginBottom: 4 }}>Errors</div>
                <ul style={{ fontSize: 12, color: "var(--red)", paddingLeft: 16 }}>
                  {summary.errorRows.slice(0, 10).map((r, i) => (
                    <li key={i}>Row {r.rowIdx}: {r.warnings.join(" · ")}</li>
                  ))}
                </ul>
              </div>
            )}

            <WizardFooter
              onCancel={onClose}
              extraActions={
                <>
                  <button type="button" className="btn-sm" onClick={downloadSummary}>Download Summary</button>
                  {summary.errorRows.length > 0 && (
                    <button type="button" className="btn-sm" onClick={downloadErrors}>Download Error Report</button>
                  )}
                  <a href="/brands/marketizers/team-performance/media-buyer-performance/reports-history">
                    <button type="button" className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)", borderColor: "var(--ink)" }}>
                      View Reports & History →
                    </button>
                  </a>
                  <button
                    type="button" className="btn-sm"
                    onClick={() => {
                      setSummary(null); setBuilt([]); setRawRows([]); setPastedText(""); setFileName("");
                      setSelected(new Set()); setMapping({}); jump(0);
                    }}
                  >
                    Import More Rows
                  </button>
                </>
              }
            />
          </WizardStep>
        )}
      </div>
    </div>
  );
}
