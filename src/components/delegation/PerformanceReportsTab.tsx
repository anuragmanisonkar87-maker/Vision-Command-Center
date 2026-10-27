// Performance Reports tab — monthly user reports + admin team overview.
import { useEffect, useMemo, useState } from "react";
import { Printer, Snowflake, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import {
  getMonthlyUserReport,
  getTeamOverview,
  freezeMonthlyReports,
  unfreezeMonthlyReports,
  isMonthFrozen,
  monthIso,
  type MonthlyUserReport,
  type TeamOverviewRow,
  type Grade,
} from "@/services/delegation/performanceReportService";

const gradeClass = (g: Grade) =>
  g === "Excellent"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : g === "Good"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : g === "Needs Attention"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200";

function shiftMonth(m: string, delta: number): string {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function fmtMonth(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function PerformanceReportsTab({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [month, setMonth] = useState<string>(monthIso());
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId);
  const [report, setReport] = useState<MonthlyUserReport | null>(null);
  const [overview, setOverview] = useState<TeamOverviewRow[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) listAllUsersWithRoles().then(setUsers).catch(() => setUsers([]));
  }, [isAdmin]);

  const nameOf = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.display_name || u.id.slice(0, 8)]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [users]);

  useEffect(() => {
    let cancelled = false;
    const userId = isAdmin ? selectedUserId : currentUserId;
    setLoading(true);
    (async () => {
      try {
        const [r, ov, fz] = await Promise.all([
          getMonthlyUserReport(userId, month),
          isAdmin ? getTeamOverview(month) : Promise.resolve([] as TeamOverviewRow[]),
          isAdmin ? isMonthFrozen(month) : Promise.resolve(false),
        ]);
        if (cancelled) return;
        setReport(r);
        setOverview(ov);
        setFrozen(fz || r.frozen);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month, selectedUserId, isAdmin, currentUserId]);

  const refresh = async () => {
    setLoading(true);
    try {
      const userId = isAdmin ? selectedUserId : currentUserId;
      const [r, ov, fz] = await Promise.all([
        getMonthlyUserReport(userId, month),
        isAdmin ? getTeamOverview(month) : Promise.resolve([] as TeamOverviewRow[]),
        isAdmin ? isMonthFrozen(month) : Promise.resolve(false),
      ]);
      setReport(r);
      setOverview(ov);
      setFrozen(fz || r.frozen);
    } finally {
      setLoading(false);
    }
  };

  const onFreeze = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Freeze monthly reports for ${fmtMonth(month)}? This snapshots all current data.`)) return;
    setBusy(true);
    try { await freezeMonthlyReports(month, currentUserId); await refresh(); }
    finally { setBusy(false); }
  };
  const onUnfreeze = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Unfreeze ${fmtMonth(month)}? Snapshots will be deleted.`)) return;
    setBusy(true);
    try { await unfreezeMonthlyReports(month); await refresh(); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="dg-performance-reports">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="p-1.5 border border-[#E8E5DE] rounded bg-white hover:bg-[#FBF6E9]"
          aria-label="Previous month"
        ><ChevronLeft className="w-4 h-4" /></button>
        <div data-testid="dg-report-month" className="text-sm font-medium text-stone-800 min-w-[140px] text-center">{fmtMonth(month)}</div>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="p-1.5 border border-[#E8E5DE] rounded bg-white hover:bg-[#FBF6E9]"
          aria-label="Next month"
        ><ChevronRight className="w-4 h-4" /></button>

        {isAdmin && (
          <select
            data-testid="dg-report-user-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="ipc-input"
          >
            {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.id.slice(0, 8)}</option>)}
          </select>
        )}

        <div className="flex-1" />
        <button
          data-testid="dg-print-report"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-[#E8E5DE] rounded hover:bg-[#FBF6E9]"
        ><Printer className="w-3.5 h-3.5" /> Print Report</button>
        {isAdmin && !frozen && (
          <button
            data-testid="dg-freeze-reports"
            disabled={busy}
            onClick={onFreeze}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-stone-900 text-[#C8A84B] rounded hover:bg-stone-800 disabled:opacity-50"
          ><Snowflake className="w-3.5 h-3.5" /> Freeze Monthly Reports</button>
        )}
        {isAdmin && frozen && (
          <button
            data-testid="dg-unfreeze-reports"
            disabled={busy}
            onClick={onUnfreeze}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-[#E8E5DE] rounded hover:bg-[#FBF6E9]"
          ><Snowflake className="w-3.5 h-3.5" /> Unfreeze</button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-stone-500">Loading…</div>
      ) : report ? (
        <>
          <UserReportCard report={report} nameOf={nameOf} />
          {isAdmin && (
            <TeamOverviewCard
              rows={overview}
              nameOf={nameOf}
              onPickUser={(uid) => setSelectedUserId(uid)}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-2 bg-[#FBF6E9]/40 rounded border border-[#F0EDE5]">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function UserReportCard({
  report, nameOf,
}: { report: MonthlyUserReport; nameOf: (id: string) => string }) {
  const s = report.summary;
  return (
    <div data-testid="dg-user-report" className="bg-white border border-[#E8E5DE] rounded-xl p-5 print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-500">Monthly Performance Report</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24 }} className="text-stone-900">
            {nameOf(report.user_id)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase text-stone-500">Score</div>
            <div data-testid="dg-report-score" className="text-2xl font-semibold text-stone-900">{report.score}<span className="text-sm text-stone-500">/100</span></div>
          </div>
          <span data-testid="dg-report-grade" className={`text-xs px-2.5 py-1 rounded border ${gradeClass(report.grade)}`}>{report.grade}</span>
          {report.frozen && (
            <span data-testid="dg-report-frozen" className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">Frozen</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <Stat label="Approved" value={s.approved_tasks} />
        <Stat label="Submitted" value={s.submitted_tasks} />
        <Stat label="Points" value={s.total_points} />
        <Stat label="On-Time %" value={`${s.on_time_pct}%`} />
        <Stat label="Late" value={s.late_tasks} />
        <Stat label="Zero-Rev" value={s.zero_revision_tasks} />
        <Stat label="Revisions" value={s.total_revisions} />
        <Stat label="Proof" value={s.proof_submitted} />
        <Stat label="DD Requests" value={s.due_date_requests} />
        <Stat label="DD Approved" value={s.due_date_approved} />
        <Stat label="DD Rejected" value={s.due_date_rejected} />
        <Stat label="Badges" value={report.badges.filter((b) => b.earned).length} />
      </div>

      {(report.badges.some((b) => b.earned) || report.winner_titles.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="dg-report-badges">
          {report.winner_titles.map((w) => (
            <span key={w.award_type} className="text-[10px] px-1.5 py-0.5 rounded border bg-[#FBF6E9] text-[#7A5E10] border-[#E8D49A] flex items-center gap-1">
              <Award className="w-3 h-3" />{w.award_name}
              {w.reward_label && <span className="opacity-75">· {w.reward_label}</span>}
            </span>
          ))}
          {report.badges.filter((b) => b.earned).map((b) => (
            <span key={b.key} className="text-[10px] px-1.5 py-0.5 rounded border bg-[#FBF6E9] text-[#7A5E10] border-[#E8D49A] flex items-center gap-1">
              <Award className="w-3 h-3" />{b.name}
              {b.reward_label && <span className="opacity-75">· {b.reward_label}</span>}
            </span>
          ))}
        </div>
      )}

      {report.insights.length > 0 && (
        <div className="mb-4" data-testid="dg-report-insights">
          <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Insights</div>
          <ul className="text-sm text-stone-700 list-disc list-inside space-y-0.5">
            {report.insights.map((i, idx) => <li key={idx}>{i}</li>)}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="dg-report-tasks">
          <thead className="bg-[#FBF6E9]/40 text-stone-600 uppercase tracking-wide text-[10px]">
            <tr>
              <th className="text-left px-2 py-1.5">Task</th>
              <th className="text-left px-2 py-1.5">Due</th>
              <th className="text-left px-2 py-1.5">Approved</th>
              <th className="text-left px-2 py-1.5">Status</th>
              <th className="text-right px-2 py-1.5">Pts</th>
              <th className="text-right px-2 py-1.5">Rev</th>
              <th className="text-right px-2 py-1.5">Acts</th>
              <th className="text-left px-2 py-1.5">Proof</th>
              <th className="text-left px-2 py-1.5">Delay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EDE5]">
            {report.tasks.map((t) => (
              <tr key={t.id} className="hover:bg-[#FBF6E9]/30">
                <td className="px-2 py-1.5 text-stone-900">{t.title}</td>
                <td className="px-2 py-1.5">{t.due_date ?? "—"}</td>
                <td className="px-2 py-1.5">{t.completed_at ? t.completed_at.slice(0, 10) : "—"}</td>
                <td className="px-2 py-1.5">{t.status}</td>
                <td className="px-2 py-1.5 text-right">{t.points}</td>
                <td className="px-2 py-1.5 text-right">{t.revision_count}</td>
                <td className="px-2 py-1.5 text-right">{t.activity_count}</td>
                <td className="px-2 py-1.5">
                  {t.proof_url ? <a href={t.proof_url} target="_blank" rel="noreferrer" className="text-[#7A5E10] hover:underline">link</a> : "—"}
                </td>
                <td className="px-2 py-1.5 text-stone-500">{t.delay_reason ?? "—"}</td>
              </tr>
            ))}
            {report.tasks.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-4 text-center text-stone-500">No approved tasks in this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamOverviewCard({
  rows, nameOf, onPickUser,
}: { rows: TeamOverviewRow[]; nameOf: (id: string) => string; onPickUser: (uid: string) => void }) {
  return (
    <div data-testid="dg-team-overview" className="bg-white border border-[#E8E5DE] rounded-xl p-5 print:hidden">
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">Team Overview</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#FBF6E9]/40 text-stone-600 uppercase tracking-wide text-[10px]">
            <tr>
              <th className="text-left px-2 py-1.5">Employee</th>
              <th className="text-right px-2 py-1.5">Approved</th>
              <th className="text-right px-2 py-1.5">Points</th>
              <th className="text-right px-2 py-1.5">On-Time %</th>
              <th className="text-right px-2 py-1.5">Revisions</th>
              <th className="text-right px-2 py-1.5">Badges</th>
              <th className="text-right px-2 py-1.5">Score</th>
              <th className="text-left px-2 py-1.5">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EDE5]">
            {rows.map((r) => (
              <tr
                key={r.user_id}
                onClick={() => onPickUser(r.user_id)}
                data-testid="dg-team-overview-row"
                className="hover:bg-[#FBF6E9]/40 cursor-pointer"
              >
                <td className="px-2 py-1.5 text-stone-900">{nameOf(r.user_id)}</td>
                <td className="px-2 py-1.5 text-right">{r.approved_tasks}</td>
                <td className="px-2 py-1.5 text-right">{r.points}</td>
                <td className="px-2 py-1.5 text-right">{r.on_time_pct}%</td>
                <td className="px-2 py-1.5 text-right">{r.revisions}</td>
                <td className="px-2 py-1.5 text-right">{r.badges_earned}</td>
                <td className="px-2 py-1.5 text-right">{r.score}</td>
                <td className="px-2 py-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${gradeClass(r.grade)}`}>{r.grade}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-4 text-center text-stone-500">No team activity for this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
