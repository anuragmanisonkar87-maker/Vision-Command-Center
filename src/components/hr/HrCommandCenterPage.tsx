// HR Command Center — main tabbed page.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin, isHr, canManageHrKpiSettings } from "@/utils/permissions/rolePermissions";
import { PageHeader, MetricCard, EmptyState, LoadingState } from "@/components/marketizers/ui";
import { loadKpiSettings, computeHiringMode, saveKpiSetting } from "@/services/hr/hrCommandCenterService";
import { listHiringRequirements, slaState } from "@/services/hr/hiringRequirementService";
import { listCandidates, computePoolHealth } from "@/services/hr/hrCandidatePoolService";
import { listReports } from "@/services/hr/hrDailyReportService";
import {
  getHiringBibleConnectionStatus,
  getCompanyPositionsFromHiringBible,
  getCandidatePoolFromHiringBible,
  getPoolHealthFromHiringBible,
  buildPoolHealthFromCandidates,
  HIRING_BIBLE_URL,
} from "@/services/hr/hiringBibleIntegrationService";
import { HiringRequirementDrawer } from "./HiringRequirementDrawer";
import { DailyHrReportDrawer } from "./DailyHrReportDrawer";
import { HiringBibleCandidatePool } from "./HiringBibleCandidatePool";
import { HrPerformanceScore } from "./HrPerformanceScore";
import { HrKpiSettings } from "./HrKpiSettings";
import { AccessDenied } from "@/components/access-control/AccessDenied";

type Tab = "overview" | "requests" | "report" | "pool" | "positions" | "performance" | "settings";

export function HrCommandCenterPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const hr = isHr(user);
  const canSettings = canManageHrKpiSettings(user);

  useEffect(() => { document.title = "HR Command Center | GWV Vision Center"; }, []);

  const [tab, setTab] = useState<Tab>("overview");
  const [reqDrawer, setReqDrawer] = useState<{ open: boolean; id?: string | null }>({ open: false });
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);

  const kpiQ = useQuery({ queryKey: ["hr-kpi"], queryFn: loadKpiSettings });
  const reqQ = useQuery({ queryKey: ["hr-reqs"], queryFn: () => listHiringRequirements() });
  const poolQ = useQuery({ queryKey: ["hr-pool"], queryFn: listCandidates, enabled: admin || hr });
  const reportsQ = useQuery({
    queryKey: ["hr-reports", admin, user?.id],
    queryFn: () => listReports(admin ? null : (user as any)?.id),
    enabled: admin || hr,
  });
  const hbQ = useQuery({ queryKey: ["hr-hb"], queryFn: getHiringBibleConnectionStatus });
  const hbPositionsQ = useQuery({ queryKey: ["hb-positions"], queryFn: getCompanyPositionsFromHiringBible, staleTime: 60_000 });
  const hbPoolQ = useQuery({ queryKey: ["hb-candidate-pool"], queryFn: getCandidatePoolFromHiringBible, staleTime: 30_000, enabled: admin || hr });
  const hbHealthRpcQ = useQuery({ queryKey: ["hb-pool-health-page"], queryFn: getPoolHealthFromHiringBible, staleTime: 60_000, enabled: admin || hr });

  if (!admin && !hr) return <AccessDenied moduleLabel="HR Command Center" />;

  const kpi = kpiQ.data ?? {};
  const reqs = reqQ.data ?? [];
  const open = reqs.filter((r) => !r.is_filled && !["closed","cancelled"].includes(r.status));
  const urgent = open.filter((r) => r.priority === "urgent");
  const slaSoon = open.filter((r) => slaState(r.deadline_date).daysLeft <= 1);

  const pool = poolQ.data ?? [];
  const poolTarget = Number(kpi.pool_target_per_position ?? 20);
  const minReady = Number(kpi.minimum_ready_now ?? 5);
  const localHealth = computePoolHealth(pool, poolTarget, minReady);

  // Compute Hiring Bible pool health client-side from live candidates joined
  // to positions. HB's own pool-health RPC sometimes aggregates with a
  // different brand_key than candidate rows, returning zeros — so we treat
  // the live join as source of truth and only fall back to the RPC if the
  // position registry is empty.
  const hbPositions = hbPositionsQ.data ?? [];
  const hbCandidates = hbPoolQ.data ?? [];
  const hbHealth = hbPositions.length > 0
    ? buildPoolHealthFromCandidates(hbPositions, hbCandidates)
    : (hbHealthRpcQ.data ?? []);
  const hbCriticalRows = hbHealth.filter((h) => h.pool_health_status === "Critical" || h.pool_health_status === "Empty");
  const hbConnected = hbPositions.length > 0 || hbCandidates.length > 0 || !!hbQ.data?.connected;
  const criticalPools = hbConnected
    ? hbCriticalRows.length
    : localHealth.filter((h) => h.health === "critical").length;

  const mode = computeHiringMode({
    openCount: open.length,
    urgentCount: urgent.length,
    slaDueIn48h: slaSoon.length,
    poolCriticalCount: criticalPools,
    override: typeof kpi.hiring_mode_override === "string" ? kpi.hiring_mode_override : "automatic",
    highTarget: Number(kpi.high_mode_interview_target ?? 6),
    normalTarget: Number(kpi.normal_mode_interview_target ?? 5),
    lowTarget: Number(kpi.low_mode_interview_target ?? 3),
    maintTarget: Number(kpi.maintenance_mode_interview_target ?? 1),
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysReport = (reportsQ.data ?? []).find(
    (r) => r.report_date === todayStr && (admin || r.hr_user_id === (user as any)?.id),
  );
  const todaysScore = Math.round(todaysReport?.score_total ?? 0);
  const interviewsToday = todaysReport?.interviews_conducted ?? 0;

  const TABS: { key: Tab; label: string; admin?: boolean }[] = [
    { key: "overview", label: "Today's Action Queue" },
    { key: "requests", label: "Hiring Requests" },
    { key: "report", label: "Daily HR Report" },
    { key: "pool", label: "Candidate Pool" },
    { key: "positions", label: "Position Registry" },
    { key: "performance", label: "HR Performance" },
    ...(canSettings ? [{ key: "settings" as Tab, label: "KPI Settings", admin: true }] : []),
  ];

  // Action queue (system-derived)
  type QItem = { priority: number; title: string; reason: string; tone: "critical"|"high"|"medium"|"low"; deadline?: string; cta?: { label: string; onClick: () => void } };
  const queue: QItem[] = [];
  if (interviewsToday < mode.target) queue.push({ priority: 1, title: `Conduct ${mode.target - interviewsToday} more interview(s)`, reason: `Today's target ${mode.target} (mode: ${mode.mode})`, tone: "high", deadline: "Before 7:00 PM", cta: { label: "Open Daily Report", onClick: () => setReportDrawerOpen(true) } });
  slaSoon.slice(0, 3).forEach((r, i) => queue.push({ priority: 2 + i, title: `SLA: ${r.position_name} ${slaState(r.deadline_date).label}`, reason: `${r.brand_name ?? "—"} · ${r.openings} opening(s)`, tone: "critical", cta: { label: "View Request", onClick: () => setTab("requests") } }));
  // Live pool gaps from Hiring Bible (per-position).
  if (hbConnected) {
    hbCriticalRows.slice(0, 3).forEach((h, i) => {
      const isEmpty = h.pool_health_status === "Empty";
      queue.push({
        priority: 5 + i,
        title: isEmpty ? `Build candidate pool for ${h.position_name}` : `Improve ${h.position_name} Ready Now pool`,
        reason: isEmpty
          ? `${h.brand_name ?? "—"} · No active candidates available.`
          : `${h.brand_name ?? "—"} · Ready Now ${h.ready_now_count} · Total ${h.total_active_pool}${h.target_pool_count ? ` / target ${h.target_pool_count}` : ""}`,
        tone: isEmpty ? "critical" : "high",
        cta: { label: "Open Pool", onClick: () => setTab("pool") },
      });
    });
  } else if (criticalPools > 0) {
    queue.push({ priority: 5, title: `Close ${criticalPools} critical pool gap(s)`, reason: "Add Ready Now candidates", tone: "high", cta: { label: "Open Pool", onClick: () => setTab("pool") } });
  }
  if (!todaysReport || todaysReport.report_status === "draft") queue.push({ priority: 9, title: "Submit Daily HR Report", reason: `Deadline ${kpi.report_deadline_hour ?? 20}:00 PM. Missing = Reporting Non-Compliant.`, tone: "medium", deadline: `Before ${kpi.report_deadline_hour ?? 20}:00`, cta: { label: "Submit Report", onClick: () => setReportDrawerOpen(true) } });
  if (queue.length === 0) queue.push({ priority: 1, title: "All clear — pool freshness only", reason: "No urgent tasks today", tone: "low" });

  // New requirement banners (status === "new")
  const newReqs = open.filter((r) => (r.status || "").toLowerCase() === "new").slice(0, 2);

  const reportPending = !todaysReport || todaysReport.report_status !== "submitted";
  const slaTone: "red" | "amber" | "green" = slaSoon.length > 0 ? "red" : open.length > 0 ? "amber" : "green";

  return (
    <div>
      <PageHeader
        eyebrow="Parent Company Function"
        title="HR Command Center"
        subtitle="Cross-brand HR operations: hiring requests, daily outcome report, candidate pool health, SLA tracking and HR performance score. KPI settings are director-only."
        actions={
          <>
            <button className="btn-sm"
              style={{ background: "var(--gold-bg)", borderColor: "var(--gold-border)", color: "var(--gold)" }}
              onClick={() => setReqDrawer({ open: true })}>+ New Hiring Requirement</button>
            <button className="btn-sm" onClick={() => setReportDrawerOpen(true)}>Daily Report</button>
            {canSettings && (
              <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)" }}
                onClick={() => setTab("settings")}>Director Settings</button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 18px", borderBottom: "1px solid var(--border)", marginBottom: 22 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
              border: "1px solid var(--border)",
              background: tab === t.key ? "var(--ink)" : "var(--ivory)",
              color: tab === t.key ? "var(--parchment)" : "var(--ink3)",
              cursor: "pointer",
            }}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* New requirement banners */}
          {newReqs.length > 0 && (
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {newReqs.map((r) => {
                const sla = slaState(r.deadline_date);
                return (
                  <div key={r.id} style={{
                    background: "var(--gold-bg)",
                    border: "1px solid var(--gold-border)",
                    borderLeft: "4px solid var(--gold3)",
                    borderRadius: 10, padding: "14px 18px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
                        New Hiring Requirement Received
                      </div>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
                        {r.position_name} <span style={{ color: "var(--ink4)", fontSize: 14, fontWeight: 400 }}>· {r.brand_name ?? "—"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>
                        SLA Deadline: <strong>{sla.label}</strong> · {r.openings} opening{r.openings !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button className="btn-sm" onClick={() => setReqDrawer({ open: true, id: r.id })}
                      style={{ background: "var(--ink)", color: "var(--parchment)" }}>Start Hiring →</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Command Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
            <CommandCard
              rail={mode.mode === "high" ? "var(--red)" : mode.mode === "normal" ? "var(--amber)" : "var(--gold3)"}
              label="Hiring Mode"
              value={mode.mode.toUpperCase()}
              subtitle={mode.reason}
              badge={kpi.hiring_mode_override && kpi.hiring_mode_override !== "automatic" ? "Director Override" : "Auto Calculated"}
            />
            <CommandCard
              rail={interviewsToday >= mode.target ? "var(--green)" : "var(--amber)"}
              label="Interview Target"
              value={`${interviewsToday} / ${mode.target}`}
              subtitle={interviewsToday >= mode.target ? "Target hit for today" : `${mode.target - interviewsToday} more interview(s) required today`}
              progress={Math.min(1, interviewsToday / Math.max(1, mode.target))}
            />
            <CommandCard
              rail={slaTone === "red" ? "var(--red)" : slaTone === "amber" ? "var(--amber)" : "var(--green)"}
              label="SLA Alert"
              value={String(slaSoon.length)}
              subtitle={slaSoon.length > 0 ? "Position deadline within 48 hours" : "No SLA breaches in next 48h"}
              cta={slaSoon.length > 0 ? { label: "View Hiring Requests", onClick: () => setTab("requests") } : undefined}
            />
            <CommandCard
              rail={reportPending ? "var(--amber)" : "var(--green)"}
              label="Report Status"
              value={reportPending ? "PENDING" : "SUBMITTED"}
              subtitle={reportPending ? `Submit before ${kpi.report_deadline_hour ?? 20}:00` : `Score ${todaysScore}/100`}
              cta={reportPending ? { label: "Open Report", onClick: () => setReportDrawerOpen(true) } : undefined}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,.85fr)", gap: 16, marginBottom: 24 }}>
            <Panel title="Today's Action Queue" subtitle="System-generated priorities from open roles, pool gaps, and SLA deadlines.">
              <div style={{ display: "grid", gap: 10 }}>
                {queue.map((q, i) => {
                  const railColor = q.tone === "critical" ? "var(--red)" : q.tone === "high" ? "var(--amber)" : q.tone === "medium" ? "var(--gold3)" : "var(--ink4)";
                  const badgeCls = q.tone === "critical" || q.tone === "high" ? "sp-loss" : q.tone === "medium" ? "sp-warn" : "sp-profit";
                  return (
                    <div key={i} style={{
                      border: "1px solid var(--border)", borderLeft: `4px solid ${railColor}`,
                      background: "var(--ivory)", borderRadius: 9,
                      padding: "14px 16px", display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 14, alignItems: "center",
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center",
                        background: "var(--ink)", color: "var(--parchment)", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>
                        {q.priority}
                      </div>
                      <div>
                        <strong style={{ fontSize: 14.5, color: "var(--ink)" }}>{q.title}</strong>
                        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>{q.reason}</div>
                        {q.deadline && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 3, fontFamily: "'DM Mono',monospace" }}>⏱ {q.deadline}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        <span className={`status-pill ${badgeCls}`} style={{ textTransform: "uppercase", fontWeight: 700 }}>{q.tone}</span>
                        {q.cta && <button className="btn-sm" onClick={q.cta.onClick}>{q.cta.label}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Auto Hiring Mode Engine" subtitle="System decision based on demand, pool health, and SLA deadlines.">
              <div style={{
                background: mode.mode === "high" ? "var(--red-bg)" : mode.mode === "normal" ? "var(--amber-bg)" : "var(--gold-bg)",
                border: `1px solid ${mode.mode === "high" ? "rgba(139,32,32,.2)" : "var(--gold-border)"}`,
                borderRadius: 9, padding: "16px 18px", marginBottom: 14,
              }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>System Calculated Mode</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, lineHeight: 1, color: mode.mode === "high" ? "var(--red)" : "var(--ink)" }}>
                  {mode.mode.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{mode.reason}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <Mini label="Open Positions" value={String(open.length)} />
                <Mini label="Critical Pools" value={String(criticalPools)} />
                <Mini label="SLA ≤ 48h" value={String(slaSoon.length)} />
                <Mini label="Hiring Bible" value={hbQ.data?.connected ? "Connected" : "Phase 2"} />
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 8 }}>Today's System Goal</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.7 }}>
                <li>Conduct <strong>{mode.target}</strong> interview(s)</li>
                <li>Add <strong>{Math.max(1, Math.ceil(mode.target / 3))}</strong> Ready Now candidate(s)</li>
                <li>Submit report before <strong>{kpi.report_deadline_hour ?? 20}:00</strong></li>
                {criticalPools > 0 && <li>Close <strong>{criticalPools}</strong> critical pool gap(s)</li>}
              </ul>
            </Panel>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
            <ModuleCard pill={open.length > 0 ? "Critical" : "OK"} pillTone={open.length > 0 ? "loss" : "profit"}
              title="Hiring Requests" body="New requirements, open positions, 4-day SLA, joining status and deadline alerts."
              primary={{ label: "Open", onClick: () => setTab("requests") }}
              secondary={{ label: "+ Requirement", onClick: () => setReqDrawer({ open: true }) }} />
            <ModuleCard pill={todaysReport?.report_status === "submitted" ? "Submitted" : "Pending"} pillTone={todaysReport?.report_status === "submitted" ? "profit" : "warn"}
              title="Daily HR Report" body="Auto-fetched outcomes, checklist, notes, WhatsApp summary, and score."
              primary={{ label: "Submit Report", onClick: () => setReportDrawerOpen(true) }}
              secondary={{ label: "Preview", onClick: () => setTab("report") }} />
            <ModuleCard pill={`${pool.length} cand.`} pillTone="profit" title="Candidate Pool"
              body="Ready Now, Ready Soon, Warm, Cold and Expired tiers with health per position."
              primary={{ label: "Open Pool", onClick: () => setTab("pool") }} />
            <ModuleCard pill={`Score ${todaysScore}`} pillTone="profit" title="HR Performance"
              body="Daily, weekly, and monthly scoring with bonuses, penalties, SLA and KRA view."
              primary={{ label: "View Score", onClick: () => setTab("performance") }} />
          </div>

          {/* Hiring Bible integration card */}
          <HiringBibleCard
            status={hbQ.data}
            loading={hbQ.isLoading}
            onOpenPositions={() => setTab("positions")}
          />
        </>
      )}

      {tab === "positions" && (
        <PositionRegistry
          positions={hbPositionsQ.data ?? []}
          loading={hbPositionsQ.isLoading}
          connected={(hbPositionsQ.data ?? []).length > 0}
        />
      )}

      {tab === "requests" && (
        <Panel title="Hiring Requests">
          {reqQ.isLoading ? <LoadingState /> :
            reqs.length === 0 ? <EmptyState icon="🎯" title="No hiring requirements yet"
              message="Create a requirement to start the 4-day SLA countdown."
              action={<button className="btn-sm" onClick={() => setReqDrawer({ open: true })}
                style={{ background: "var(--ink)", color: "var(--parchment)" }}>+ New Requirement</button>} /> :
            <RequirementsTable rows={reqs} onOpen={(id) => setReqDrawer({ open: true, id })} />}
        </Panel>
      )}

      {tab === "report" && (
        <Panel title="Daily HR Report" subtitle="Open the drawer to fill or submit today's report.">
          <ReportPreview reports={reportsQ.data ?? []} />
          <div style={{ marginTop: 14 }}>
            <button className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)" }}
              onClick={() => setReportDrawerOpen(true)}>Open Report Drawer</button>
          </div>
        </Panel>
      )}

      {tab === "pool" && (
        <HiringBibleCandidatePool
          isAdminUser={admin}
          localCandidates={pool}
          localHealth={localHealth}
          localLoading={poolQ.isLoading}
          onLocalChange={() => poolQ.refetch()}
        />
      )}

      {tab === "performance" && (
        <HrPerformanceScore reports={reportsQ.data ?? []} userId={(user as any)?.id ?? null} adminView={admin} />
      )}

      {tab === "settings" && canSettings && (
        <HrKpiSettings kpi={kpi} onSave={async (k, v) => { await saveKpiSetting(k, v); kpiQ.refetch(); }} />
      )}

      {reqDrawer.open && (
        <HiringRequirementDrawer
          requirementId={reqDrawer.id ?? null}
          existing={reqs.find((r) => r.id === reqDrawer.id) ?? null}
          canOverrideSla={admin}
          onClose={() => setReqDrawer({ open: false })}
          onSaved={() => { reqQ.refetch(); setReqDrawer({ open: false }); }}
        />
      )}
      {reportDrawerOpen && (
        <DailyHrReportDrawer
          kpi={kpi}
          interviewTarget={mode.target}
          hiringMode={mode.mode}
          openPositions={open.length}
          slaMissed={open.filter((r) => r.missed_sla).length}
          onClose={() => setReportDrawerOpen(false)}
          onSaved={() => { reportsQ.refetch(); setReportDrawerOpen(false); }}
        />
      )}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 16 }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </section>
  );
}

function ModuleCard({ pill, pillTone, title, body, primary, secondary }: {
  pill: string; pillTone: "loss" | "warn" | "profit";
  title: string; body: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 180 }}>
      <span className={`status-pill sp-${pillTone}`} style={{ alignSelf: "flex-start" }}>{pill}</span>
      <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{title}</h4>
      <p style={{ margin: 0, color: "var(--ink4)", fontSize: 12.5, lineHeight: 1.5 }}>{body}</p>
      <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
        <button className="btn-sm" style={{ background: "var(--gold-bg)", borderColor: "var(--gold-border)", color: "var(--gold)" }} onClick={primary.onClick}>{primary.label}</button>
        {secondary && <button className="btn-sm" onClick={secondary.onClick}>{secondary.label}</button>}
      </div>
    </div>
  );
}

function RequirementsTable({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Position", "Brand", "Priority", "SLA", "Status", "Source", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sla = slaState(r.deadline_date);
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                <td style={{ padding: "12px 8px" }}><strong>{r.position_name}</strong> <span style={{ color: "var(--ink4)", fontSize: 11 }}>· {r.openings}×</span></td>
                <td style={{ padding: "12px 8px", color: "var(--ink3)" }}>{r.brand_name ?? "—"}</td>
                <td style={{ padding: "12px 8px" }}>
                  <span className={`status-pill ${r.priority === "urgent" ? "sp-loss" : r.priority === "high" ? "sp-warn" : "sp-profit"}`}>{r.priority}</span>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <span className={`status-pill ${sla.tone === "critical" || sla.tone === "red" ? "sp-loss" : sla.tone === "amber" ? "sp-warn" : "sp-profit"}`}>{sla.label}</span>
                </td>
                <td style={{ padding: "12px 8px", color: "var(--ink3)" }}>{r.status}</td>
                <td style={{ padding: "12px 8px", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink4)" }}>{r.source}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }}>
                  <button className="btn-sm" onClick={() => onOpen(r.id)}>Open</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportPreview({ reports }: { reports: any[] }) {
  if (reports.length === 0) return <EmptyState icon="📝" title="No reports yet" message="Submit your first daily report to see history." />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {reports.slice(0, 10).map((r) => (
        <div key={r.id} style={{ border: "1px solid var(--border)", background: "var(--parchment)", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.report_date}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink4)" }}>{r.hr_name ?? "—"} · {r.report_status}</div>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--ink2)" }}>{Math.round(r.score_total)}/100</div>
        </div>
      ))}
    </div>
  );
}

function CommandCard({ rail, label, value, subtitle, badge, progress, cta }: {
  rail: string; label: string; value: string; subtitle?: string; badge?: string;
  progress?: number; cta?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{
      background: "var(--ivory)", border: "1px solid var(--border)",
      borderTop: `4px solid ${rail}`, borderRadius: 10, padding: "16px 18px 18px",
      display: "flex", flexDirection: "column", gap: 6, position: "relative", minHeight: 140,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</div>
        {badge && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".1em", textTransform: "uppercase", color: rail, padding: "2px 7px", border: `1px solid ${rail}`, borderRadius: 99, opacity: .85 }}>{badge}</span>}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "-.02em" }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.5 }}>{subtitle}</div>}
      {typeof progress === "number" && (
        <div style={{ marginTop: 6, height: 6, background: "var(--parchment2, var(--parchment))", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: rail }} />
        </div>
      )}
      {cta && (
        <button onClick={cta.onClick} className="btn-sm" style={{ alignSelf: "flex-start", marginTop: 8, background: "var(--ink)", color: "var(--parchment)" }}>
          {cta.label} →
        </button>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--parchment)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginTop: 2, fontFamily: "'Cormorant Garamond',serif" }}>{value}</div>
    </div>
  );
}

function HiringBibleCard({ status, loading, onOpenPositions }: {
  status: any; loading: boolean; onOpenPositions: () => void;
}) {
  const connected = !!status?.connected;
  const tone = connected ? "var(--green)" : "var(--amber)";
  const last = status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "—";
  return (
    <div style={{
      marginTop: 18, background: "var(--ivory)", border: "1px solid var(--border)",
      borderTop: `4px solid ${tone}`, borderRadius: 10, padding: "16px 18px",
      display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>Hiring Bible</h4>
          <span className={`status-pill ${connected ? "sp-profit" : "sp-warn"}`} style={{ textTransform: "uppercase", fontWeight: 700 }}>
            {loading ? "Checking…" : connected ? "Connected" : "Not Connected"}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 8 }}>
          Source of truth for hiring guides, interview pipeline, candidate scoring and the <strong>+ Add to Pool</strong> workflow.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>
          <span>Last sync: <strong style={{ color: "var(--ink2)" }}>{last}</strong></span>
          <span>Positions: <strong style={{ color: "var(--ink2)" }}>{status?.positionsFetched ?? 0}</strong></span>
          <span>Pool: <strong style={{ color: "var(--ink2)" }}>{status?.poolCandidates ?? 0}</strong></span>
          <span>Interviews today: <strong style={{ color: "var(--ink2)" }}>{status?.interviewsToday ?? 0}</strong></span>
        </div>
        {!connected && status?.errors?.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>{status.errors.join(" · ")}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <a className="btn-sm" href={HIRING_BIBLE_URL} target="_blank" rel="noopener noreferrer"
          style={{ background: "var(--ink)", color: "var(--parchment)", textDecoration: "none", textAlign: "center" }}>
          Open Hiring Bible →
        </a>
        <button className="btn-sm" onClick={onOpenPositions}>View Positions</button>
      </div>
    </div>
  );
}

function PositionRegistry({ positions, loading, connected }: {
  positions: any[]; loading: boolean; connected: boolean;
}) {
  const [brand, setBrand] = useState<string>("");
  const brands = Array.from(new Set(positions.map((p) => p.brand_name).filter(Boolean))) as string[];
  const filtered = brand ? positions.filter((p) => p.brand_name === brand) : positions;

  if (loading) return <LoadingState />;

  return (
    <section style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10 }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Position Registry</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink4)", margin: "4px 0 0", maxWidth: 560 }}>
              Positions are fetched from Hiring Bible. Hiring requirements are active openings created by Director / Admin.
            </p>
          </div>
          <a href={HIRING_BIBLE_URL} target="_blank" rel="noopener noreferrer"
            className="btn-sm" style={{ background: "var(--ink)", color: "var(--parchment)", textDecoration: "none" }}>
            Open Hiring Bible →
          </a>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setBrand("")} className="btn-sm"
            style={{ background: brand === "" ? "var(--ink)" : undefined, color: brand === "" ? "var(--parchment)" : undefined }}>
            All Brands
          </button>
          {brands.map((b) => (
            <button key={b} onClick={() => setBrand(b)} className="btn-sm"
              style={{ background: brand === b ? "var(--ink)" : undefined, color: brand === b ? "var(--parchment)" : undefined }}>
              {b}
            </button>
          ))}
        </div>
      </div>
      {!connected ? (
        <div style={{ padding: 24 }}>
          <EmptyState icon="📚" title="Hiring Bible not connected"
            message="Position registry will populate once the Hiring Bible sync RPCs are reachable from this project." />
        </div>
      ) : (
        <div style={{ overflowX: "auto", padding: 12 }}>
          <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Brand", "Position", "Department", "Reporting Manager", "Work Mode", "Location", "Category", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--ink4)", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.position_id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                  <td style={{ padding: "10px 8px", color: "var(--ink3)" }}>{p.brand_name ?? "—"}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{p.position_name}</td>
                  <td style={{ padding: "10px 8px" }}>{p.department ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{p.reporting_manager ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{p.work_mode ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{p.location ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{p.role_category ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`status-pill ${p.status === "active" ? "sp-profit" : "sp-warn"}`}>{p.status}</span>
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>
                    {(() => {
                      const raw = (p.hiring_guide_url || "").trim();
                      let href: string;
                      if (/^https?:\/\//i.test(raw)) href = raw;
                      else if (raw.startsWith("/")) href = `${HIRING_BIBLE_URL}${raw}`;
                      else if (raw) href = `${HIRING_BIBLE_URL}/${raw.replace(/^\/+/, "")}`;
                      else href = HIRING_BIBLE_URL; // fallback to HB home
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="btn-sm" style={{ textDecoration: "none" }}>
                          Guide ↗
                        </a>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--ink4)" }}>No positions for this brand.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
