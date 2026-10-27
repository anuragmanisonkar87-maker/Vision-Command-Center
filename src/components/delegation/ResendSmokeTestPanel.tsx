// Phase 3E.2A — admin-only Resend smoke test runner panel.
// Calls `runMissedEmailSmokeTest` and displays a structured pass/fail report.
// Recipient is fixed server-side to delivered@resend.dev — never user-editable.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  runMissedEmailSmokeTest,
  SMOKE_TEST_RECIPIENT,
  type SmokeTestReport,
} from "@/lib/delegation/missedEmailSmokeTest.functions";

const STEP_LABELS: Array<[keyof SmokeTestReport["steps"], string]> = [
  ["provider", "Provider"],
  ["qaTask", "QA Task"],
  ["penalty", "Penalty"],
  ["duplicatePenalty", "Duplicate Penalty Blocked"],
  ["draft", "Draft"],
  ["send", "Resend Send"],
  ["dbSentStatus", "DB Sent Status"],
  ["duplicateSentCheck", "No Duplicate Sent"],
  ["cleanup", "Cleanup"],
];

export default function ResendSmokeTestPanel({ isAdmin }: { isAdmin: boolean }) {
  const runFn = useServerFn(runMissedEmailSmokeTest);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SmokeTestReport | null>(null);

  if (!isAdmin) return null;

  const handleRun = async () => {
    setBusy(true);
    setReport(null);
    try {
      const r = (await runFn()) as SmokeTestReport;
      setReport(r);
    } catch (e: any) {
      setReport({
        ok: false,
        steps: {} as any,
        providerMessageId: null,
        error: e?.message || "Smoke test failed",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="bg-white border border-[#E8E5DE] rounded-xl p-5 space-y-3"
      data-testid="resend-smoke-test-panel"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">
            Resend QA
          </div>
          <div className="text-lg font-semibold text-stone-800">Resend Smoke Test</div>
          <div className="text-xs text-stone-500 mt-1 max-w-xl">
            Creates a temporary missed task, sends one test email to Resend's sandbox{" "}
            (<code>{SMOKE_TEST_RECIPIENT}</code>), verifies status, then cleans up. No
            real employee inbox is contacted.
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={busy}
          data-testid="run-resend-smoke-test"
          className="px-3 py-2 rounded-md bg-teal-700 text-white text-xs font-semibold disabled:opacity-60"
        >
          {busy ? "Running…" : "Run Resend Smoke Test"}
        </button>
      </div>

      {report && (
        <div className="border-t border-[#EFEAE0] pt-3">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-block text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded border ${
                report.ok
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
              data-testid="smoke-test-overall"
            >
              {report.ok ? "All checks passed" : "Failed"}
            </span>
            {report.providerMessageId && (
              <span className="text-[11px] text-stone-500">
                provider_message_id: <code>{report.providerMessageId}</code>
              </span>
            )}
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {STEP_LABELS.map(([key, label]) => {
              const s = report.steps?.[key];
              const ok = !!s?.ok;
              return (
                <li
                  key={key}
                  data-testid={`smoke-step-${key}`}
                  className="flex items-center justify-between gap-2 border border-[#EFEAE0] rounded px-2 py-1"
                >
                  <span className="text-stone-700">{label}</span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${
                      ok
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {ok ? "Pass" : "Fail"}
                  </span>
                </li>
              );
            })}
          </ul>

          {report.error && (
            <div
              className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5"
              data-testid="smoke-test-error"
            >
              {report.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
