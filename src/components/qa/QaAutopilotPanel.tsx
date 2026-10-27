// Phase 3F.3 — QA Autopilot admin panel: Run Now, last status, run history.
import { Fragment, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  runQaAutopilot,
  listQaAutopilotRunLogs,
  getQaAutopilotStatus,
  setQaAutopilotResendMode,
  type QaAutopilotRunReport,
  type QaAutopilotLogRow,
  type QaAutopilotStatus,
  type ResendSmokeMode,
} from "@/lib/qa/qaAutopilot.functions";


function Pill({ status }: { status: "pass" | "fail" | "partial" | "skipped" }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    fail: "bg-red-50 text-red-700 border-red-200",
    skipped: "bg-stone-50 text-stone-600 border-stone-200",
  };
  return (
    <span className={`inline-block text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

export default function QaAutopilotPanel({ isAdmin }: { isAdmin: boolean }) {
  const runFn = useServerFn(runQaAutopilot);
  const listFn = useServerFn(listQaAutopilotRunLogs);
  const statusFn = useServerFn(getQaAutopilotStatus);
  const setModeFn = useServerFn(setQaAutopilotResendMode);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<QaAutopilotRunReport | null>(null);
  const [logs, setLogs] = useState<QaAutopilotLogRow[]>([]);
  const [status, setStatus] = useState<QaAutopilotStatus | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = async () => {
    try { setLogs((await listFn()) as any); } catch { /* noop */ }
    try { setStatus((await statusFn()) as any); } catch { /* noop */ }
  };

  useEffect(() => { if (isAdmin) refresh(); /* eslint-disable-next-line */ }, [isAdmin]);

  if (!isAdmin) return null;

  const run = async () => {
    setBusy(true);
    try {
      const r = (await runFn()) as QaAutopilotRunReport;
      setReport(r);
      await refresh();
    } catch (e: any) {
      setReport({
        runId: "error",
        runType: "manual",
        triggerSource: "admin_ui",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "fail",
        failedCount: 1, skippedCount: 0, passedCount: 0,
        cleanupStatus: "unknown",
        suites: [],
        actorUserId: null,
        actorMissing: false,
        isWeekly: false,
        resendMode: "weekly_only",
        resendIncluded: false,
        resendSkipReason: null,
        includedSuites: [],
        skippedSuites: [],
        failedSuites: ["client_error"],
      });
    } finally { setBusy(false); }
  };

  const changeMode = async (mode: ResendSmokeMode) => {
    try { await setModeFn({ data: { mode } }); await refresh(); } catch { /* noop */ }
  };

  const last = logs[0];
  const scheduleActive = !!status && status.actorConfigured;

  return (
    <div
      className="bg-white border border-[#E8E5DE] rounded-xl p-5 space-y-4"
      data-testid="qa-autopilot-panel"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">QA</div>
          <div className="text-lg font-semibold text-stone-800">QA Autopilot</div>
          <div className="text-xs text-stone-500 mt-1 max-w-2xl">
            Runs every safe QA suite end-to-end: attendance, tasks, missed-task discipline,
            discipline automation, Resend sandbox smoke test, role access / RLS, public legal pages,
            and auth routes. Cleans up after itself in a finally block.
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          data-testid="qa-autopilot-run-now"
          className="px-4 py-2 rounded-md bg-teal-700 text-white text-sm font-semibold disabled:opacity-60 hover:bg-teal-800"
        >
          {busy ? "Running…" : "Run QA Autopilot Now"}
        </button>
      </div>

      {status && !status.actorConfigured && (
        <div
          className="border border-amber-300 bg-amber-50 text-amber-800 text-xs rounded p-2"
          data-testid="qa-autopilot-actor-warning"
        >
          <strong>QA actor not configured.</strong> Scheduled QA runs will return <code>partial</code> and skip
          user-context suites. Set the server secret <code>QA_AUTOPILOT_ACTOR_USER_ID</code> to the user id of a
          dedicated admin account to enable full scheduled coverage.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="qa-autopilot-schedule">
        <Stat
          label="Scheduled QA"
          value={scheduleActive ? "Active" : "Not Active"}
          pill={scheduleActive ? "pass" : "skipped"}
        />
        <Stat label="Daily run" value={status?.dailyTime ?? "08:00"} />
        <Stat label="Weekly deep QA" value={`${status?.weeklyDay ?? "Sunday"} ${status?.weeklyTime ?? "09:00"}`} />
        <div className="border border-[#EFEAE0] rounded px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-[0.06em] text-stone-500">Resend smoke</div>
          <select
            value={status?.resendSmokeMode ?? "weekly_only"}
            onChange={(e) => changeMode(e.target.value as ResendSmokeMode)}
            data-testid="qa-autopilot-resend-mode"
            className="mt-0.5 text-xs border border-[#EFEAE0] rounded px-1 py-0.5 w-full"
          >
            <option value="off">Off</option>
            <option value="weekly_only">Weekly only</option>
            <option value="every_run">Every run</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Stat
          label="Last manual"
          value={status?.lastManual ? new Date(status.lastManual.started_at).toLocaleString() : "—"}
          pill={status?.lastManual?.status as any}
        />
        <Stat
          label="Last scheduled"
          value={status?.lastScheduled ? new Date(status.lastScheduled.started_at).toLocaleString() : "—"}
          pill={status?.lastScheduled?.status as any}
        />
        <Stat
          label="Last weekly"
          value={status?.lastWeekly ? new Date(status.lastWeekly.started_at).toLocaleString() : "—"}
          pill={status?.lastWeekly?.status as any}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="qa-autopilot-latest">
        <Stat label="Last status" value={last ? last.status : "—"} pill={last?.status as any} />
        <Stat label="Last run" value={last ? new Date(last.started_at).toLocaleString() : "—"} />
        <Stat
          label="Failed steps"
          value={String(report?.failedCount ?? (last?.report_json?.failedCount ?? "—"))}
        />
        <Stat
          label="Skipped steps"
          value={String(report?.skippedCount ?? (last?.report_json?.skippedCount ?? "—"))}
        />
        <Stat label="Cleanup" value={(report?.cleanupStatus ?? last?.cleanup_status ?? "—") as string} />
      </div>


      {report && (
        <div className="border border-[#EFEAE0] rounded p-3 text-xs space-y-2" data-testid="qa-autopilot-report">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-stone-800">Latest report</div>
            <Pill status={report.status} />
          </div>
          {report.suites.map((s) => (
            <div key={s.suite} className="border border-[#EFEAE0] rounded px-2 py-1.5">
              <div className="flex items-center justify-between">
                <div className="text-stone-800 font-medium">{s.label}</div>
                <Pill status={s.status} />
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1.5">
                {[...s.steps, ...s.cleanup].map((step) => (
                  <li key={step.key} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-stone-700 truncate">{step.label}</div>
                      {step.details && (
                        <div className="text-[10px] text-stone-500 truncate" title={step.details}>{step.details}</div>
                      )}
                    </div>
                    <Pill status={step.status as any} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div data-testid="qa-autopilot-history">
        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium mb-1.5">
          Recent QA Autopilot runs
        </div>
        {logs.length === 0 ? (
          <div className="text-xs text-stone-500">No autopilot runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-stone-500">
                  <th className="text-left font-medium p-1.5">When</th>
                  <th className="text-left font-medium p-1.5">Type</th>
                  <th className="text-left font-medium p-1.5">Source</th>
                  <th className="text-left font-medium p-1.5">Status</th>
                  <th className="text-left font-medium p-1.5">Cleanup</th>
                  <th className="text-right font-medium p-1.5">Report</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-t border-[#EFEAE0]">
                      <td className="p-1.5 text-stone-700">{new Date(l.started_at).toLocaleString()}</td>
                      <td className="p-1.5 text-stone-700">{l.run_type}</td>
                      <td className="p-1.5 text-stone-700">{l.trigger_source ?? "—"}</td>
                      <td className="p-1.5"><Pill status={l.status as any} /></td>
                      <td className="p-1.5 text-stone-700">{l.cleanup_status ?? "—"}</td>
                      <td className="p-1.5 text-right">
                        <button
                          className="text-teal-700 underline"
                          onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                        >
                          {expanded === l.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expanded === l.id && l.report_json && (
                      <tr>
                        <td colSpan={6} className="p-2 bg-stone-50 border-t border-[#EFEAE0]">
                          <pre className="text-[10px] text-stone-700 whitespace-pre-wrap break-all max-h-72 overflow-auto">
{JSON.stringify(l.report_json, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-stone-500 border-t border-[#EFEAE0] pt-2 space-y-1">
        <div>
          Scheduled cron endpoint: <code>POST /api/public/hooks/qa-autopilot</code> with the
          Supabase <code>apikey</code> header. Recommended schedule: daily 08:00, optional weekly Sunday 09:00.
        </div>
        <div>
          Manual checks not automated: real GPS permission from an office device, real-inbox delivery
          outside the Resend sandbox, subjective design approval.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, pill }: { label: string; value: string; pill?: "pass" | "fail" | "partial" | "skipped" }) {
  return (
    <div className="border border-[#EFEAE0] rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-stone-500">{label}</div>
      {pill ? <Pill status={pill} /> : <div className="text-sm font-semibold text-stone-800 truncate">{value}</div>}
    </div>
  );
}
