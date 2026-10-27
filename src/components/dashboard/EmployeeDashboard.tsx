import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  getTodayAttendance,
  getAttendanceSettings,
  listAttendanceForRange,
  monthRange,
  type AttendanceRecord,
  type AttendanceSettings,
} from "@/services/attendance/attendanceService";
import { computeMonthlySummary, isLateCheckIn } from "@/lib/attendance/summary";
import AutoCheckInPrompt from "@/components/attendance/AutoCheckInPrompt";
import {
  listTemplates,
  listCompletionsForDate,
  buildChecklist,
  todayISO,
  type RecurringDailyTask,
  type RecurringDailyCompletion,
} from "@/services/recurringTasks/recurringTasksService";
import { listLedgerForDate, type RecurringDailyPointsEntry } from "@/services/recurringTasks/recurringPointsService";
import { listMyTasks, type DelegationTask } from "@/services/delegation/delegationService";
import { listMissedTaskLedger, type MissedTaskPointsEntry } from "@/services/delegation/missedTaskService";
import { summarizeRecurringDay } from "@/lib/delegation/overdueStatus";
import { isStandupOrAdHocMissed, formatDueWhen } from "@/lib/delegation/missedTask";
import {
  attendanceCardSummary,
  myTasksCardSummary,
  pointsTodaySummary,
  formatHMS,
  formatTime,
} from "@/services/dashboard/dashboardSummary";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { getDaily, todayISO as veTodayISO, type VeDailyRow } from "@/services/videoEditor/videoEditorKpiService";

type Accent = "violet" | "indigo" | "emerald" | "amber" | "rose";

const ACCENTS: Record<Accent, { from: string; to: string; solid: string; soft: string; ring: string }> = {
  violet:  { from: "#7c3aed", to: "#a855f7", solid: "#7c3aed", soft: "#f5f3ff", ring: "#ddd6fe" },
  indigo:  { from: "#4f46e5", to: "#7c3aed", solid: "#4f46e5", soft: "#eef2ff", ring: "#c7d2fe" },
  emerald: { from: "#10b981", to: "#34d399", solid: "#059669", soft: "#ecfdf5", ring: "#a7f3d0" },
  amber:   { from: "#f59e0b", to: "#fbbf24", solid: "#d97706", soft: "#fffbeb", ring: "#fde68a" },
  rose:    { from: "#e11d48", to: "#fb7185", solid: "#e11d48", soft: "#fff1f2", ring: "#fecdd3" },
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const today = todayISO();

  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [templates, setTemplates] = useState<RecurringDailyTask[]>([]);
  const [completions, setCompletions] = useState<RecurringDailyCompletion[]>([]);
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [points, setPoints] = useState<RecurringDailyPointsEntry[]>([]);
  const [missedLedger, setMissedLedger] = useState<MissedTaskPointsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dashboard | GWV Vision Center";
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { from, to } = monthRange(new Date());
        const [att, cfg, mrecs, t, c, mine, pts, ml] = await Promise.all([
          getTodayAttendance(userId).catch(() => null),
          getAttendanceSettings().catch(() => null),
          listAttendanceForRange(userId, from, to).catch(() => []),
          listTemplates({ activeOnly: true }).catch(() => []),
          listCompletionsForDate(today).catch(() => []),
          listMyTasks(userId).catch(() => []),
          listLedgerForDate(today).catch(() => []),
          listMissedTaskLedger({ userId, limit: 100 }).catch(() => []),
        ]);
        if (cancelled) return;
        setAttendance(att);
        setSettings(cfg);
        setMonthRecords(mrecs);
        setTemplates(t);
        setCompletions(c);
        setTasks(mine);
        setPoints(pts);
        setMissedLedger(ml);
        setErr(null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, today]);

  if (!user) return <div style={{ padding: 24 }}>Sign in to view your dashboard.</div>;

  const myTemplates = templates.filter((t) => t.task_doer_user_id === userId);
  const checklist = buildChecklist(myTemplates, completions);
  const checklistSummary = summarizeRecurringDay(
    checklist.map((it) => ({ template: it, completion: it.completion })),
    new Date(),
  );
  const att = attendanceCardSummary(attendance);
  const taskSummary = myTasksCardSummary(tasks, userId);
  const pointSummary = pointsTodaySummary(points, userId, today);
  const lateCfg = {
    expectedCheckInTime: settings?.expected_check_in_time ?? "10:00",
    graceMinutes: settings?.late_grace_minutes ?? 15,
  };
  const monthly = computeMonthlySummary(
    monthRecords.map((r) => ({ date: r.date, check_in_at: r.check_in_at })),
    lateCfg,
    new Date(),
    settings?.missed_cutoff_time ?? "12:00",
  );
  const todayLate = isLateCheckIn(attendance?.check_in_at ?? null, lateCfg);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthMissedLedger = missedLedger.filter((m) => new Date(m.created_at) >= monthStart);
  const missedTasksCount = tasks.filter((t) =>
    isStandupOrAdHocMissed(t as any, new Date()),
  ).length;
  const monthNegativePoints = monthMissedLedger.reduce((s, m) => s + (m.points || 0), 0);
  const latestMissed = monthMissedLedger[0] ?? null;
  const latestMissedTask = latestMissed
    ? tasks.find((t) => t.id === latestMissed.task_id) ?? null
    : null;

  const greeting = user.display_name?.split(" ")[0] ?? "there";

  return (
    <div data-testid="employee-dashboard" style={{ padding: "4px 2px 8px" }}>
      {/* Hero */}
      <div style={heroWrap}>
        <div style={heroGlow} aria-hidden />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={heroEyebrow}>Your Day</div>
          <h1 style={heroTitle}>
            Hello, <span style={heroTitleAccent}>{greeting}</span>
          </h1>
          <p style={heroSub}>
            Attendance, daily checklist, tasks and points — all in one clean place.
          </p>
        </div>
      </div>

      {err && (
        <div style={{
          color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3",
          padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13,
        }}>{err}</div>
      )}

      <AutoCheckInPrompt onCheckedIn={(rec) => setAttendance(rec)} />

      <div style={cardGrid}>
        {/* Attendance */}
        <Card title="Today's Attendance" accent="violet" testId="card-attendance">
          {loading ? <Skeleton /> : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusPill
                  label={att.status === "checked_in" ? "Checked In" : att.status === "checked_out" ? "Checked Out" : "Not Checked In"}
                  tone={att.status === "not_checked_in" ? "neutral" : att.status === "checked_in" ? "good" : "muted"}
                />
                {todayLate && <StatusPill label="Late" tone="bad" />}
              </div>
              <KV label="Check-in" value={formatTime(att.checkInAt)} />
              <KV label="Check-out" value={formatTime(att.checkOutAt)} />
              <KV label="Worked" value={att.workedSeconds > 0 ? formatHMS(att.workedSeconds) : "—"} />
              {att.status === "not_checked_in" && <Empty>No attendance yet today.</Empty>}
            </>
          )}
          <LinkBtn to="/attendance" accent="violet">Open Attendance</LinkBtn>
        </Card>

        {/* Attendance Summary */}
        <Card title="Attendance Summary" accent="indigo" testId="card-attendance-summary">
          {loading ? <Skeleton /> : (
            <>
              <BigNum value={monthly.currentStreak} label="Current streak (days)" tone={monthly.currentStreak > 0 ? "good" : "neutral"} />
              <Row>
                <Mini label="Present" value={monthly.presentDays} tone="good" />
                <Mini label="Late" value={monthly.lateDays} tone={monthly.lateDays > 0 ? "bad" : "neutral"} />
                <Mini label="Missed" value={monthly.missedDays} tone={monthly.missedDays > 0 ? "bad" : "neutral"} />
              </Row>
              <Caption>This month so far.</Caption>
            </>
          )}
        </Card>

        {/* Daily Checklist */}
        <Card title="Daily Checklist" accent="emerald" testId="card-checklist">
          {loading ? <Skeleton /> : (
            <>
              <BigNum value={checklistSummary.done} suffix={` / ${checklistSummary.visible}`} label="Done today" />
              <Row>
                <Mini label="Pending" value={checklistSummary.pending} />
                <Mini label="Missed" value={checklistSummary.missed} tone={checklistSummary.missed > 0 ? "bad" : "neutral"} />
              </Row>
              {checklistSummary.visible === 0 && <Empty>No recurring daily tasks assigned.</Empty>}
            </>
          )}
          <LinkBtn to="/daily-checklist" accent="emerald">Open Daily Checklist</LinkBtn>
        </Card>

        {/* My Tasks */}
        <Card title="My Tasks" accent="amber" testId="card-mytasks">
          {loading ? <Skeleton /> : (
            <>
              <BigNum value={taskSummary.pending} label="Pending" />
              <Row>
                <Mini label="Submitted" value={taskSummary.submitted} />
                <Mini label="Overdue" value={taskSummary.overdue} tone={taskSummary.overdue > 0 ? "bad" : "neutral"} />
              </Row>
              {taskSummary.pending === 0 && taskSummary.submitted === 0 && taskSummary.overdue === 0 && (
                <Empty>No pending tasks. Nicely done.</Empty>
              )}
            </>
          )}
          <LinkBtn to="/delegation" accent="amber" search={{ tab: "mytasks" } as any}>Open My Tasks</LinkBtn>
        </Card>

        {/* Missed Tasks */}
        <Card title="Missed Tasks" accent="rose" testId="card-missed-tasks">
          {loading ? <Skeleton /> : (
            <>
              <BigNum value={missedTasksCount} label="Currently missed" tone={missedTasksCount > 0 ? "bad" : "neutral"} />
              <Row>
                <Mini label="Penalties (Month)" value={monthMissedLedger.length} tone={monthMissedLedger.length > 0 ? "bad" : "neutral"} />
                <Mini label="Negative Pts" value={monthNegativePoints} tone={monthNegativePoints < 0 ? "bad" : "neutral"} />
              </Row>
              {latestMissedTask && (
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
                  Latest: <strong style={{ color: "#0f172a" }}>{latestMissedTask.title}</strong>
                  {latestMissedTask.due_date && (
                    <> · due {formatDueWhen(latestMissedTask.due_date, (latestMissedTask as any).due_time ?? null)}</>
                  )}
                </div>
              )}
              {missedTasksCount === 0 && monthMissedLedger.length === 0 && (
                <Empty>No missed tasks. Keep it up.</Empty>
              )}
            </>
          )}
          <LinkBtn to="/delegation" accent="rose" search={{ tab: "mytasks" } as any}>Open My Tasks</LinkBtn>
        </Card>

        {/* Points Today */}
        <Card title="Points Today" accent="violet" testId="card-points">
          {loading ? <Skeleton /> : (
            <>
              <BigNum
                value={pointSummary.net}
                label="Net points"
                tone={pointSummary.net > 0 ? "good" : pointSummary.net < 0 ? "bad" : "neutral"}
              />
              <Row>
                <Mini label="Earned" value={pointSummary.earned} tone="good" />
                <Mini label="Lost" value={pointSummary.lost} tone={pointSummary.lost < 0 ? "bad" : "neutral"} />
              </Row>
              {pointSummary.entries === 0 && <Empty>No points recorded today.</Empty>}
              <Caption>Recurring daily ledger only.</Caption>
            </>
          )}
        </Card>

        <VideoEditorKpiTile />
        <KpiPositionTile />
      </div>


      {/* Quick Actions */}
      <div style={qaPanel}>
        <div style={qaHead}>
          <div>
            <div style={qaTitle}>Quick Actions</div>
            <div style={qaSub}>Jump straight to your daily tools</div>
          </div>
        </div>
        <div style={qaGrid}>
          <QuickAction to="/attendance" label="Attendance" />
          <QuickAction to="/daily-checklist" label="Daily Checklist" />
          <QuickAction to="/delegation" label="My Tasks" search={{ tab: "mytasks" } as any} />
          <QuickAction to="/delegation" label="Delegation" />
        </div>
      </div>
    </div>
  );
}

/* ---------- atoms ---------- */

function Card({ title, accent, children, testId }: { title: string; accent: Accent; children: React.ReactNode; testId?: string }) {
  const a = ACCENTS[accent];
  return (
    <div
      data-testid={testId}
      style={{
        background: "#ffffff",
        border: "1px solid #ececf3",
        borderRadius: 16,
        padding: "22px 22px 20px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 220,
        boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(76,29,149,.10)",
        transition: "transform .18s ease, box-shadow .18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(15,23,42,.05), 0 18px 36px -16px rgba(76,29,149,.20)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(76,29,149,.10)";
      }}
    >
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em",
        textTransform: "uppercase", color: "#64748b",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
          boxShadow: `0 0 0 3px ${a.soft}`,
        }} />
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>{children}</div>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${a.from}, ${a.to})`,
      }} />
    </div>
  );
}

function BigNum({ value, suffix, label, tone = "neutral" }: { value: number | string; suffix?: string; label: string; tone?: "good"|"bad"|"neutral" }) {
  const color = tone === "good" ? "#059669" : tone === "bad" ? "#e11d48" : "#0f172a";
  return (
    <div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 700, color, lineHeight: 1, letterSpacing: "-.02em" }}>
        {value}{suffix && <span style={{ fontSize: 18, color: "#94a3b8", fontWeight: 400 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "good"|"bad"|"neutral" }) {
  const color = tone === "good" ? "#059669" : tone === "bad" ? "#e11d48" : "#0f172a";
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 17, color, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 14, marginTop: 2 }}>{children}</div>;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
      <span>{label}</span><span style={{ fontFamily: "'DM Mono',monospace", color: "#0f172a" }}>{value}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "good"|"muted"|"neutral"|"bad" }) {
  const cls = tone === "good" ? { bg: "#ecfdf5", c: "#059669", b: "#a7f3d0" }
    : tone === "bad" ? { bg: "#fff1f2", c: "#e11d48", b: "#fecdd3" }
    : tone === "muted" ? { bg: "#f5f3ff", c: "#7c3aed", b: "#ddd6fe" }
    : { bg: "#f8fafc", c: "#64748b", b: "#e2e8f0" };
  return (
    <span style={{
      alignSelf: "flex-start",
      fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 999, background: cls.bg, color: cls.c, border: `1px solid ${cls.b}`,
    }}>{label}</span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 2 }}>{children}</div>;
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{children}</div>;
}

/* ---------- Video Editor KPI tile (position-gated) ---------- */

function VideoEditorKpiTile() {
  const { teamMember, isVideoEditor, loading: tmLoading } = useMyTeamMember();
  const [row, setRow] = useState<VeDailyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tmLoading || !isVideoEditor || !teamMember) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await getDaily(teamMember.id, veTodayISO());
        if (!cancelled) setRow(r);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isVideoEditor, teamMember, tmLoading]);

  if (tmLoading || !isVideoEditor) return null;
  const committed = row?.committed_pieces ?? 0;
  const shipped = row?.shipped_finished ?? 0;
  const gate = row?.finish_gate_passed ?? false;
  const good = row?.good_day ?? false;

  return (
    <Card title="Today's KPI · Video Editor" accent="emerald" testId="card-video-editor-kpi">
      {loading ? <Skeleton /> : (
        <>
          <BigNum value={shipped} suffix={` / ${committed}`} label="Shipped / committed" tone={shipped >= committed && committed > 0 ? "good" : "neutral"} />
          <Row>
            <Mini label="Finish gate" value={gate ? 1 : 0} tone={gate ? "good" : "bad"} />
            <Mini label="Good day" value={good ? 1 : 0} tone={good ? "good" : "bad"} />
          </Row>
          {!row && <Empty>No KPI logged today.</Empty>}
        </>
      )}
      <LinkBtn to="/brands/ipc/team-performance/video-editor-performance/daily-reporting" accent="emerald">
        Open Today's KPI
      </LinkBtn>
    </Card>
  );
}

/* ---------- Generic KPI tile (any position with an active kpi_position_config) ---------- */
function KpiPositionTile() {
  const { teamMember, loading: tmLoading } = useMyTeamMember();
  const [state, setState] = useState<{ good: boolean | null; committed: number; shipped: number; posName: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tmLoading || !teamMember?.positionId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getConfigForPosition, getDaily: kpiGetDaily, todayISO: kpiToday } = await import("@/services/kpi/kpiService");
        const cfg = await getConfigForPosition(teamMember.positionId!);
        if (!cfg) { if (!cancelled) setState(null); return; }
        const row = await kpiGetDaily(teamMember.id, kpiToday());
        if (!cancelled) setState({
          good: row?.good_day ?? null,
          committed: Number(row?.committed ?? 0),
          shipped: Number(row?.shipped ?? 0),
          posName: teamMember.positionName,
        });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [teamMember?.id, teamMember?.positionId, tmLoading]);

  if (tmLoading || loading) return null;
  if (!state) return null; // No config for this position → hide

  const good = !!state.good;
  return (
    <Card title={`Today's KPI · ${state.posName ?? "You"}`} accent="indigo" testId="card-kpi-position">
      <BigNum value={state.shipped} suffix={` / ${state.committed}`} label="Shipped / committed" tone={state.shipped >= state.committed && state.committed > 0 ? "good" : "neutral"} />
      <Row>
        <Mini label="Good day" value={good ? 1 : 0} tone={good ? "good" : "bad"} />
      </Row>
      <LinkBtn to="/kpi/daily" accent="indigo">Open Today's KPI</LinkBtn>
    </Card>
  );
}


function Skeleton() {
  return <div style={{ height: 64, background: "linear-gradient(90deg,#f5f3ff,#eef2ff,#f5f3ff)", backgroundSize: "200% 100%", borderRadius: 10, animation: "empShimmer 1.4s linear infinite" }} />;
}

function LinkBtn({ to, children, search, accent = "violet" }: { to: string; children: React.ReactNode; search?: Record<string, unknown>; accent?: Accent }) {
  const a = ACCENTS[accent];
  return (
    <Link to={to as any} search={search as any} style={{
      marginTop: 4, textAlign: "center", textDecoration: "none",
      padding: "10px 14px", borderRadius: 10,
      background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
      color: "#fff",
      fontFamily: "'Figtree',sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: ".01em",
      boxShadow: `0 6px 16px -8px ${a.solid}`,
    }}>{children}</Link>
  );
}

function QuickAction({ to, label, search }: { to: string; label: string; search?: Record<string, unknown> }) {
  return (
    <Link to={to as any} search={search as any} style={{
      padding: "12px 16px", borderRadius: 12, border: "1px solid #ede9fe",
      background: "#ffffff", color: "#4c1d95", textDecoration: "none",
      fontFamily: "'Figtree',sans-serif", fontSize: 13, fontWeight: 600,
      boxShadow: "0 1px 2px rgba(76,29,149,.05)",
      transition: "background .18s, transform .18s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "translateY(0)"; }}
    >{label}</Link>
  );
}

/* ---------- layout styles ---------- */

const heroWrap: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 20,
  padding: "28px 28px 30px",
  marginBottom: 24,
  background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 100%)",
  color: "#fff",
  boxShadow: "0 18px 40px -22px rgba(76,29,149,.55)",
};
const heroGlow: React.CSSProperties = {
  position: "absolute", inset: 0,
  background:
    "radial-gradient(600px 200px at 90% -10%, rgba(244,114,182,.35), transparent 60%)," +
    "radial-gradient(500px 200px at 0% 110%, rgba(99,102,241,.45), transparent 60%)",
  pointerEvents: "none",
};
const heroEyebrow: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".18em",
  textTransform: "uppercase", color: "rgba(255,255,255,.78)", marginBottom: 10,
};
const heroTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 700, color: "#fff",
  lineHeight: 1.05, letterSpacing: "-.02em", marginBottom: 8,
};
const heroTitleAccent: React.CSSProperties = {
  fontStyle: "italic",
  background: "linear-gradient(90deg, #fde68a, #fcd34d)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};
const heroSub: React.CSSProperties = {
  fontSize: 13.5, color: "rgba(255,255,255,.85)", maxWidth: 520, lineHeight: 1.6, fontWeight: 300,
};
const cardGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18,
};
const qaPanel: React.CSSProperties = {
  marginTop: 22,
  background: "#ffffff",
  border: "1px solid #ececf3",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -14px rgba(76,29,149,.10)",
};
const qaHead: React.CSSProperties = {
  padding: "18px 22px 0",
};
const qaTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-.01em",
};
const qaSub: React.CSSProperties = {
  fontSize: 12.5, color: "#64748b", marginTop: 2,
};
const qaGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12, padding: 22,
};
