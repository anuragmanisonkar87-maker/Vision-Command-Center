// Phase 3G — Admin-only QA Automation Center UI.
// Buttons trigger server-side QA runs; reports show structured pass/fail per step.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  runAttendanceQa,
  runTaskSystemQa,
  runMissedTaskQa,
  runRoleAccessQa,
  runFullSystemQa,
  runDisciplineAutomationQa,
  type QaRunReport,
  type QaStepResult,
} from "@/lib/qa/qaAutomation.functions";
import {
  runMissedEmailSmokeTest,
  type SmokeTestReport,
} from "@/lib/delegation/missedEmailSmokeTest.functions";

type AnyReport =
  | { kind: "qa"; label: string; report: QaRunReport }
  | { kind: "full"; label: string; data: { status: QaRunReport["status"]; reports: QaRunReport[] } }
  | { kind: "smoke"; label: string; report: SmokeTestReport };

function StatusPill({ status }: { status: "pass" | "fail" | "skipped" | "partial" }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    fail: "bg-red-50 text-red-700 border-red-200",
    skipped: "bg-stone-50 text-stone-600 border-stone-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-block text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

function StepList({ steps, testidPrefix }: { steps: QaStepResult[]; testidPrefix: string }) {
  if (!steps.length) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs mt-2">
      {steps.map((s) => (
        <li
          key={s.key}
          data-testid={`${testidPrefix}-${s.key}`}
          className="flex items-center justify-between gap-2 border border-[#EFEAE0] rounded px-2 py-1"
        >
          <div className="min-w-0">
            <div className="text-stone-700 truncate">{s.label}</div>
            {s.details && <div className="text-[10px] text-stone-500 truncate" title={s.details}>{s.details}</div>}
          </div>
          <StatusPill status={s.status} />
        </li>
      ))}
    </ul>
  );
}

function ReportCard({ title, report }: { title: string; report: QaRunReport }) {
  return (
    <div className="border border-[#EFEAE0] rounded p-3" data-testid={`qa-report-${report.runType}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-800">{title}</div>
        <StatusPill status={report.status} />
      </div>
      <div className="text-[10px] text-stone-500 mt-0.5">run {report.runId}</div>
      <StepList steps={report.steps} testidPrefix={`qa-step-${report.runType}`} />
      {report.cleanup.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mt-3">Cleanup</div>
          <StepList steps={report.cleanup} testidPrefix={`qa-cleanup-${report.runType}`} />
        </>
      )}
      {report.notes && report.notes.length > 0 && (
        <div className="text-[11px] text-stone-500 mt-2 italic">
          {report.notes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}
    </div>
  );
}

function SmokeReportCard({ report }: { report: SmokeTestReport }) {
  const labelMap: Array<[keyof SmokeTestReport["steps"], string]> = [
    ["provider", "Provider"], ["qaTask", "QA Task"], ["penalty", "Penalty"],
    ["duplicatePenalty", "Duplicate Penalty Blocked"], ["draft", "Draft"], ["send", "Resend Send"],
    ["dbSentStatus", "DB Sent Status"], ["duplicateSentCheck", "No Duplicate Sent"], ["cleanup", "Cleanup"],
  ];
  const steps: QaStepResult[] = labelMap.map(([k, label]) => {
    const s = report.steps?.[k];
    return {
      key: String(k),
      label,
      status: s?.ok ? "pass" : "fail",
      details: s?.detail || s?.error,
    };
  });
  return (
    <div className="border border-[#EFEAE0] rounded p-3" data-testid="qa-report-smoke">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-800">Resend Smoke Test</div>
        <StatusPill status={report.ok ? "pass" : "fail"} />
      </div>
      {report.providerMessageId && (
        <div className="text-[11px] text-stone-500 mt-0.5">
          provider_message_id: <code>{report.providerMessageId}</code>
        </div>
      )}
      <StepList steps={steps} testidPrefix="qa-step-smoke" />
      {report.error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {report.error}
        </div>
      )}
    </div>
  );
}

export default function QaAutomationCenterPanel({ isAdmin }: { isAdmin: boolean }) {
  const attendanceFn = useServerFn(runAttendanceQa);
  const taskFn = useServerFn(runTaskSystemQa);
  const missedFn = useServerFn(runMissedTaskQa);
  const roleFn = useServerFn(runRoleAccessQa);
  const fullFn = useServerFn(runFullSystemQa);
  const smokeFn = useServerFn(runMissedEmailSmokeTest);
  const disciplineFn = useServerFn(runDisciplineAutomationQa);

  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<AnyReport[]>([]);

  if (!isAdmin) return null;

  const wrap = async <T,>(label: string, fn: () => Promise<T>, kind: "qa" | "smoke", testKey: string) => {
    setBusy(testKey);
    try {
      const r = (await fn()) as any;
      if (kind === "smoke") {
        setResults((prev) => [{ kind: "smoke", label, report: r }, ...prev]);
      } else {
        setResults((prev) => [{ kind: "qa", label, report: r }, ...prev]);
      }
    } catch (e: any) {
      setResults((prev) => [{
        kind: "qa",
        label,
        report: {
          runId: "error",
          runType: testKey,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "fail",
          steps: [{ key: "runtime", label: "Runtime error", status: "fail", details: e?.message || "failed" }],
          cleanup: [],
        },
      }, ...prev]);
    } finally {
      setBusy(null);
    }
  };

  const runFull = async () => {
    setBusy("full");
    try {
      const r = (await fullFn()) as any;
      setResults((prev) => [{ kind: "full", label: "Full System QA", data: r }, ...prev]);
    } catch (e: any) {
      setResults((prev) => [{
        kind: "qa",
        label: "Full System QA",
        report: {
          runId: "error",
          runType: "full",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          status: "fail",
          steps: [{ key: "runtime", label: "Runtime error", status: "fail", details: e?.message || "failed" }],
          cleanup: [],
        },
      }, ...prev]);
    } finally {
      setBusy(null);
    }
  };

  const Btn = ({ label, onClick, k }: { label: string; onClick: () => void; k: string }) => (
    <button
      onClick={onClick}
      disabled={!!busy}
      data-testid={`qa-run-${k}`}
      className="px-3 py-2 rounded-md bg-stone-800 text-white text-xs font-semibold disabled:opacity-60 hover:bg-stone-900"
    >
      {busy === k ? "Running…" : label}
    </button>
  );

  return (
    <div
      className="bg-white border border-[#E8E5DE] rounded-xl p-5 space-y-4"
      data-testid="qa-automation-center"
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">
          Admin QA
        </div>
        <div className="text-lg font-semibold text-stone-800">QA Automation Center</div>
        <div className="text-xs text-stone-500 mt-1 max-w-2xl">
          Run safe automated checks for attendance, tasks, missed-task discipline, email sending, and role access.
          Every check cleans up after itself; no real emails are sent to employees.
        </div>
        <div
          className="mt-2 text-xs text-stone-700 bg-stone-50 border border-[#EFEAE0] rounded px-2 py-1.5 max-w-2xl"
          data-testid="qa-freeze-note"
        >
          Automated QA is available here. Real GPS and final visual approval still require owner review.
        </div>
      </div>


      <div className="flex flex-wrap gap-2">
        <Btn k="attendance" label="Run Attendance QA" onClick={() => wrap("Attendance QA", attendanceFn, "qa", "attendance")} />
        <Btn k="task_system" label="Run Task System QA" onClick={() => wrap("Task System QA", taskFn, "qa", "task_system")} />
        <Btn k="missed_task" label="Run Missed Task QA" onClick={() => wrap("Missed Task QA", missedFn, "qa", "missed_task")} />
        <Btn k="smoke" label="Run Resend Smoke Test" onClick={() => wrap("Resend Smoke Test", smokeFn, "smoke", "smoke")} />
        <Btn k="role_access" label="Run Role Access QA" onClick={() => wrap("Role Access QA", roleFn, "qa", "role_access")} />
        <Btn k="discipline_automation" label="Run Discipline Automation QA" onClick={() => wrap("Discipline Automation QA", disciplineFn, "qa", "discipline_automation")} />
        <button
          onClick={runFull}
          disabled={!!busy}
          data-testid="qa-run-full"
          className="px-3 py-2 rounded-md bg-teal-700 text-white text-xs font-semibold disabled:opacity-60 hover:bg-teal-800"
        >
          {busy === "full" ? "Running…" : "Run Full System QA"}
        </button>
      </div>

      <div className="border-t border-[#EFEAE0] pt-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium mb-1">
          Manual checks still required
        </div>
        <ul className="text-xs text-stone-600 list-disc pl-4">
          <li>real GPS permission from actual office device</li>
          <li>real inbox delivery if not using Resend sandbox</li>
          <li>subjective visual design approval</li>
        </ul>
      </div>

      {results.length > 0 && (
        <div className="space-y-3" data-testid="qa-results">
          {results.map((r, i) => {
            if (r.kind === "smoke") return <SmokeReportCard key={i} report={r.report} />;
            if (r.kind === "full") {
              return (
                <div key={i} className="border border-teal-200 bg-teal-50/30 rounded p-3 space-y-3" data-testid="qa-report-full">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-stone-800">{r.label}</div>
                    <StatusPill status={r.data.status} />
                  </div>
                  {r.data.reports.map((rep) => (
                    <ReportCard key={rep.runId} title={rep.runType} report={rep} />
                  ))}
                </div>
              );
            }
            return <ReportCard key={i} title={r.label} report={r.report} />;
          })}
        </div>
      )}
    </div>
  );
}
