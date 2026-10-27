// Phase 3F — Admin-only: manually trigger Discipline Automation + recent run history.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  runDisciplineAutomation,
  listDisciplineRunLogs,
  type DisciplineAutomationReport,
  type DisciplineRunLogRow,
} from "@/lib/delegation/disciplineAutomation.functions";

function Pill({ status }: { status: "pass" | "partial" | "fail" }) {
  const map = {
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    fail: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <span className={`inline-block text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

export default function DisciplineAutomationRunnerPanel({ isAdmin }: { isAdmin: boolean }) {
  const runFn = useServerFn(runDisciplineAutomation);
  const listFn = useServerFn(listDisciplineRunLogs);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DisciplineAutomationReport | null>(null);
  const [logs, setLogs] = useState<DisciplineRunLogRow[]>([]);

  const refresh = async () => {
    try { setLogs((await listFn()) as any); } catch { /* noop */ }
  };

  useEffect(() => { if (isAdmin) refresh(); /* eslint-disable-next-line */ }, [isAdmin]);

  if (!isAdmin) return null;

  const run = async () => {
    setBusy(true);
    try {
      const r = (await runFn()) as DisciplineAutomationReport;
      setReport(r);
      await refresh();
    } catch (e: any) {
      setReport({
        runType: "manual",
        status: "fail",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        scannedCount: 0, missedCount: 0,
        penaltiesApplied: 0, penaltiesSkipped: 0,
        draftsCreated: 0, draftsSkipped: 0,
        emailsSent: 0, emailsFailed: 0,
        autoSendEnabled: false, providerConfigured: false,
        errors: [e?.message || "failed"], notes: [],
      });
    } finally { setBusy(false); }
  };

  return (
    <div
      className="bg-white border border-[#E8E5DE] rounded-xl p-5 space-y-4"
      data-testid="discipline-automation-runner"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">Automation</div>
          <div className="text-lg font-semibold text-stone-800">Manual Automation Run</div>
          <div className="text-xs text-stone-500 mt-1 max-w-2xl">
            Runs the same workflow the daily cron will use. Respects your saved Automation Settings —
            auto-send stays OFF unless you have explicitly enabled it.
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          data-testid="run-automation-now"
          className="px-4 py-2 rounded-md bg-teal-700 text-white text-sm font-semibold disabled:opacity-60 hover:bg-teal-800"
        >
          {busy ? "Running…" : "Run Automation Now"}
        </button>
      </div>

      {report && (
        <div
          className="border border-[#EFEAE0] rounded p-3 text-xs space-y-2"
          data-testid="automation-report"
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold text-stone-800">Last run report</div>
            <Pill status={report.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Scanned" value={report.scannedCount} />
            <Stat label="Missed" value={report.missedCount} />
            <Stat label="Penalties applied" value={report.penaltiesApplied} />
            <Stat label="Penalties skipped" value={report.penaltiesSkipped} />
            <Stat label="Drafts created" value={report.draftsCreated} />
            <Stat label="Drafts skipped" value={report.draftsSkipped} />
            <Stat label="Emails sent" value={report.emailsSent} />
            <Stat label="Emails failed" value={report.emailsFailed} />
          </div>
          <div className="text-[11px] text-stone-500">
            Auto-send: {report.autoSendEnabled ? "ON" : "OFF"} · Provider: {report.providerConfigured ? "configured" : "not configured"}
          </div>
          {report.notes.length > 0 && (
            <ul className="text-[11px] text-stone-600 list-disc pl-4">
              {report.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {report.errors.length > 0 && (
            <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {report.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      <div data-testid="automation-history">
        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium mb-1.5">
          Recent automation runs
        </div>
        {logs.length === 0 ? (
          <div className="text-xs text-stone-500">No automation runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-stone-500">
                  <th className="text-left font-medium p-1.5">When</th>
                  <th className="text-left font-medium p-1.5">Type</th>
                  <th className="text-left font-medium p-1.5">Status</th>
                  <th className="text-right font-medium p-1.5">Penalties</th>
                  <th className="text-right font-medium p-1.5">Drafts</th>
                  <th className="text-right font-medium p-1.5">Sent</th>
                  <th className="text-right font-medium p-1.5">Failed</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-[#EFEAE0]">
                    <td className="p-1.5 text-stone-700">{new Date(l.started_at).toLocaleString()}</td>
                    <td className="p-1.5 text-stone-700">{l.run_type}</td>
                    <td className="p-1.5"><Pill status={l.status} /></td>
                    <td className="p-1.5 text-right text-stone-700">{l.penalties_applied}</td>
                    <td className="p-1.5 text-right text-stone-700">{l.drafts_created}</td>
                    <td className="p-1.5 text-right text-stone-700">{l.emails_sent}</td>
                    <td className="p-1.5 text-right text-stone-700">{l.emails_failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-stone-500 border-t border-[#EFEAE0] pt-2">
        Scheduled cron endpoint: <code>POST /api/public/hooks/discipline-automation</code> with
        the Supabase <code>apikey</code> header. Schedule it daily at your configured automation time.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#EFEAE0] rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-800">{value}</div>
    </div>
  );
}
