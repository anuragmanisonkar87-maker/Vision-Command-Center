// Candidate Pool tab — primary source: Hiring Bible RPCs.
// Local gwv_hr_candidate_pool is shown only as a fallback section if HB is
// unreachable (kept via the legacy CandidatePoolTable below).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCandidatePoolFromHiringBible,
  getPoolHealthFromHiringBible,
  getCompanyPositionsFromHiringBible,
  getHiringBibleSyncHealth,
  buildPoolHealthFromCandidates,
  HIRING_BIBLE_URL,
} from "@/services/hr/hiringBibleIntegrationService";
import type { HbCandidate, HbPoolHealthRow, HbPoolHealthStatus } from "@/types/hr/hiringBible";
import { EmptyState, LoadingState, ErrorBanner } from "@/components/marketizers/ui";
import { CandidatePoolTable } from "./CandidatePoolTable";
import type { Candidate, PoolHealth } from "@/services/hr/hrCandidatePoolService";

type Props = {
  isAdminUser: boolean;
  // Local fallback data + handler so the existing legacy view still works
  // for Director/Admin if Hiring Bible is offline.
  localCandidates: Candidate[];
  localHealth: PoolHealth[];
  localLoading: boolean;
  onLocalChange: () => void;
};

const HEALTH_TONE: Record<HbPoolHealthStatus, string> = {
  Healthy: "sp-profit",
  Warning: "sp-warn",
  Critical: "sp-loss",
  Empty: "sp-loss",
};

const READINESS_TONE = (level: string | null | undefined): string => {
  const v = (level ?? "").toLowerCase();
  if (v.includes("ready_now") || v === "ready now") return "sp-profit";
  if (v.includes("ready_soon") || v === "ready soon") return "sp-profit";
  if (v.includes("future")) return "sp-warn";
  if (v.includes("hold")) return "sp-warn";
  return "";
};

const FRESHNESS_TONE = (s: string | null | undefined): string => {
  const v = (s ?? "").toLowerCase();
  if (v === "fresh") return "sp-profit";
  if (v === "warm") return "sp-warn";
  if (v === "cold") return "sp-warn";
  if (v === "expired") return "sp-loss";
  return "";
};

const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
const fmtDate = (v: string | null | undefined) =>
  !v ? "—" : new Date(v).toLocaleDateString();

export function HiringBibleCandidatePool({
  isAdminUser,
  localCandidates,
  localHealth,
  localLoading,
  onLocalChange,
}: Props) {
  const poolQ = useQuery({
    queryKey: ["hb-candidate-pool"],
    queryFn: getCandidatePoolFromHiringBible,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const positionsQ = useQuery({
    queryKey: ["hb-positions"],
    queryFn: getCompanyPositionsFromHiringBible,
    staleTime: 30_000,
  });
  const healthQ = useQuery({
    queryKey: ["hb-pool-health"],
    queryFn: getPoolHealthFromHiringBible,
    staleTime: 30_000,
  });
  const syncQ = useQuery({
    queryKey: ["hb-sync-health-pool"],
    queryFn: getHiringBibleSyncHealth,
    staleTime: 30_000,
  });

  const candidates: HbCandidate[] = poolQ.data ?? [];
  const positions = positionsQ.data ?? [];
  // Source of truth: aggregate health from live candidate pool joined to
  // positions. HB's own pool-health RPC drifts (different brand_key), so
  // we only use it as a backup if positions are empty.
  const computedHealth = positions.length > 0
    ? buildPoolHealthFromCandidates(positions, candidates)
    : (healthQ.data ?? []);
  const health: HbPoolHealthRow[] = computedHealth;

  const hbConnected = !!syncQ.data?.database_connected || candidates.length > 0 || health.length > 0;
  const hbFailed = !syncQ.isLoading && !hbConnected;

  // Filters
  const [brand, setBrand] = useState("");
  const [position, setPosition] = useState("");
  const [poolStatus, setPoolStatus] = useState<HbPoolHealthStatus | "">("");
  const [readiness, setReadiness] = useState("");
  const [freshness, setFreshness] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [search, setSearch] = useState("");

  const brands = useMemo(
    () => Array.from(new Set([...candidates.map((c) => c.brand_name), ...health.map((h) => h.brand_name)].filter(Boolean) as string[])).sort(),
    [candidates, health],
  );
  const positionNames = useMemo(
    () => Array.from(new Set([...candidates.map((c) => c.position_name), ...health.map((h) => h.position_name)].filter(Boolean) as string[])).sort(),
    [candidates, health],
  );
  const readinessValues = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.readiness_level).filter(Boolean) as string[])).sort(),
    [candidates],
  );
  const freshnessValues = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.freshness_status).filter(Boolean) as string[])).sort(),
    [candidates],
  );
  const workModes = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.work_mode).filter(Boolean) as string[])).sort(),
    [candidates],
  );

  const filteredHealth = health.filter((h) =>
    (!brand || h.brand_name === brand) &&
    (!position || h.position_name === position) &&
    (!poolStatus || h.pool_health_status === poolStatus),
  );

  const filteredCandidates = candidates.filter((c) => {
    if (brand && c.brand_name !== brand) return false;
    if (position && c.position_name !== position) return false;
    if (readiness && c.readiness_level !== readiness) return false;
    if (freshness && c.freshness_status !== freshness) return false;
    if (workMode && c.work_mode !== workMode) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = [c.candidate_name, c.phone, c.email].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const refreshAll = () => { poolQ.refetch(); healthQ.refetch(); syncQ.refetch(); };

  // ── Disconnected state — show fallback for admin only ──
  if (hbFailed) {
    return (
      <div>
        <ErrorBanner
          message="Hiring Bible sync failed. Candidate Pool is showing fallback/local data."
          onRetry={refreshAll}
        />
        {isAdminUser ? (
          <CandidatePoolTable
            candidates={localCandidates}
            health={localHealth}
            loading={localLoading}
            onChange={onLocalChange}
          />
        ) : (
          <EmptyState
            icon="🔌"
            title="Hiring Bible is not connected"
            message="Candidate Pool data could not be fetched. Please retry or contact your admin."
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Sync header */}
      <div style={{
        background: "var(--gold-bg)", border: "1px solid var(--gold-border)",
        borderLeft: "4px solid var(--gold3)", borderRadius: 9, padding: "12px 16px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
            Hiring Bible · Source of Truth
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.55, maxWidth: 680 }}>
            Candidate Pool data is fetched from Hiring Bible. Add or update candidate readiness using the <strong>+ Pool</strong> workflow inside Hiring Bible.
          </div>
          <div style={{ marginTop: 6, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Status: <strong style={{ color: "var(--green)" }}>Connected</strong></span>
            <span>Pool: <strong style={{ color: "var(--ink2)" }}>{candidates.length}</strong></span>
            <span>Positions tracked: <strong style={{ color: "var(--ink2)" }}>{health.length}</strong></span>
            <span>Last sync: <strong style={{ color: "var(--ink2)" }}>{syncQ.data?.last_candidate_pool_update ? new Date(syncQ.data.last_candidate_pool_update).toLocaleString() : "—"}</strong></span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a className="btn-sm" href={HIRING_BIBLE_URL} target="_blank" rel="noopener noreferrer"
            style={{ background: "var(--ink)", color: "var(--parchment)", textDecoration: "none", textAlign: "center" }}>
            Open Hiring Bible →
          </a>
          <button className="btn-sm" onClick={refreshAll}>Refresh Pool Data</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 8, marginBottom: 18,
      }}>
        <Filter label="Brand" value={brand} onChange={setBrand} options={brands} />
        <Filter label="Position" value={position} onChange={setPosition} options={positionNames} />
        <Filter label="Pool Health" value={poolStatus} onChange={(v) => setPoolStatus(v as any)} options={["Healthy","Warning","Critical","Empty"]} />
        <Filter label="Readiness" value={readiness} onChange={setReadiness} options={readinessValues} />
        <Filter label="Freshness" value={freshness} onChange={setFreshness} options={freshnessValues} />
        <Filter label="Work Mode" value={workMode} onChange={setWorkMode} options={workModes} />
      </div>

      {/* SECTION A — Pool Health by Position */}
      <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: "0 0 12px" }}>Pool Health by Position</h3>
      {healthQ.isLoading ? (
        <LoadingState />
      ) : filteredHealth.length === 0 ? (
        <EmptyState icon="📚" title="No pool health data" message="Hiring Bible has no positions matching the current filters." />
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 26 }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Brand","Position","Target","Total","Ready Now","Ready Soon","Future Fit","Hold","Fresh","Warm","Cold","Expired","Health"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHealth.map((h) => (
                <tr key={h.position_id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{fmt(h.brand_name)}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{h.position_name}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(h.target_pool_count)}</td>
                  <td style={{ padding: "10px 8px" }}>{h.total_active_pool}</td>
                  <td style={{ padding: "10px 8px" }}>{h.ready_now_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.ready_soon_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.future_fit_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.hold_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.fresh_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.warm_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.cold_count}</td>
                  <td style={{ padding: "10px 8px" }}>{h.expired_count}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`status-pill ${HEALTH_TONE[h.pool_health_status] ?? ""}`}>{h.pool_health_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION B — Candidate Pool Records */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, margin: 0 }}>Candidate Pool Records</h3>
        <input
          placeholder="Search by name, phone or email…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontSize: 12.5, minWidth: 240 }}
        />
      </div>

      {poolQ.isLoading ? (
        <LoadingState />
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          icon="🧑‍💼"
          title="No candidates found in Hiring Bible pool"
          message="Adjust filters, or add candidates using the + Pool workflow inside Hiring Bible."
          action={
            <a href={HIRING_BIBLE_URL} target="_blank" rel="noopener noreferrer" className="btn-sm"
              style={{ background: "var(--ink)", color: "var(--parchment)", textDecoration: "none" }}>
              Open Hiring Bible →
            </a>
          }
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1400, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name","Phone","Email","Brand","Position","Readiness","Ready From","Salary","Avail.","Location","Mode","Status","L1","L2","Final","HR","Freshness","Last Contact","Notes",""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c) => (
                <tr key={c.pool_id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{fmt(c.candidate_name)}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{fmt(c.phone)}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{fmt(c.email)}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{fmt(c.brand_name)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.position_name)}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {c.readiness_level
                      ? <span className={`status-pill ${READINESS_TONE(c.readiness_level)}`}>{c.readiness_level}</span>
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{fmtDate(c.ready_to_join_from)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.expected_salary)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.availability)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.location)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.work_mode)}</td>
                  <td style={{ padding: "10px 8px" }}>{fmt(c.interview_status)}</td>
                  <td style={{ padding: "10px 8px" }}>{c.l1_score ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{c.l2_score ?? "—"}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{c.final_score ?? "—"}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{fmt(c.hr_name)}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {c.freshness_status
                      ? <span className={`status-pill ${FRESHNESS_TONE(c.freshness_status)}`}>{c.freshness_status}</span>
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--ink4)", fontSize: 11 }}>{fmtDate(c.last_contacted_at)}</td>
                  <td style={{ padding: "10px 8px", color: "var(--ink4)", fontSize: 11, maxWidth: 220 }}>{fmt(c.pool_notes)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>
                    <a
                      href={HIRING_BIBLE_URL}
                      target="_blank" rel="noopener noreferrer"
                      title="Open Hiring Bible and search this candidate by phone."
                      className="btn-sm" style={{ textDecoration: "none" }}>
                      Open in HB
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual fallback — admin only */}
      {isAdminUser && (
        <details style={{ marginTop: 28, border: "1px dashed var(--border)", borderRadius: 9, padding: "10px 14px", background: "var(--parchment)" }}>
          <summary style={{ cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>
            Manual fallback (Director / Admin only)
          </summary>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink4)", marginBottom: 8 }}>
            Local candidate pool. Use only if Hiring Bible is unreachable. Hiring Bible remains source of truth.
          </div>
          <CandidatePoolTable
            candidates={localCandidates}
            health={localHealth}
            loading={localLoading}
            onChange={onLocalChange}
          />
        </details>
      )}
    </div>
  );
}

function Filter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--parchment)", fontSize: 12.5 }}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
