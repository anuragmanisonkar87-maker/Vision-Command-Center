// Phase 3F — Discipline Automation Center (admin-only).
// Wraps the existing MissedTasksPanel with summary cards and automation settings.
import { useEffect, useState } from "react";
import { listAllTasks } from "@/services/delegation/delegationService";
import {
  listMissedTaskEmails,
  listMissedTaskLedger,
  type MissedTaskEmailLog,
} from "@/services/delegation/missedTaskService";
import { isStandupOrAdHocMissed } from "@/lib/delegation/missedTask";
import MissedTasksPanel from "./MissedTasksPanel";
import AutomationSettingsPanel from "./AutomationSettingsPanel";
import DisciplineAutomationRunnerPanel from "./DisciplineAutomationRunnerPanel";
import ResendSmokeTestPanel from "./ResendSmokeTestPanel";
import QaAutomationCenterPanel from "./QaAutomationCenterPanel";
import QaAutopilotPanel from "../qa/QaAutopilotPanel";

type Props = { userId: string; isAdmin: boolean };

export default function DisciplineCenter({ userId, isAdmin }: Props) {
  const [missedToday, setMissedToday] = useState(0);
  const [pendingPenalties, setPendingPenalties] = useState(0);
  const [drafts, setDrafts] = useState(0);
  const [failed, setFailed] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [tasks, ledger, emails] = await Promise.all([
        listAllTasks({}).catch(() => []),
        listMissedTaskLedger({ limit: 500 }).catch(() => []),
        listMissedTaskEmails({ limit: 500 }).catch(() => []),
      ]);
      if (cancelled) return;
      const missed = tasks.filter((t) => isStandupOrAdHocMissed(t as any, now));
      const penalized = new Set(ledger.map((l) => l.task_id));
      setMissedToday(missed.length);
      setPendingPenalties(missed.filter((t) => !penalized.has(t.id)).length);
      setDrafts(emails.filter((e: MissedTaskEmailLog) => e.email_status === "draft").length);
      setFailed(emails.filter((e: MissedTaskEmailLog) => e.email_status === "failed").length);
      setSentThisMonth(
        emails.filter((e: MissedTaskEmailLog) => e.email_status === "sent" && e.sent_at && e.sent_at >= monthStart).length,
      );
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6" data-testid="discipline-center">
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500 }} className="text-stone-900">
          Discipline Automation Center
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Admin-only. Manage missed-task penalties, email drafts, and automation here so the Daily Grid stays focused on tasks.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Missed Tasks Today" value={missedToday} tone="bad" />
        <SummaryCard label="Pending Penalties" value={pendingPenalties} tone="warn" />
        <SummaryCard label="Draft Emails" value={drafts} tone="warn" />
        <SummaryCard label="Failed Emails" value={failed} tone="bad" />
        <SummaryCard label="Sent This Month" value={sentThisMonth} tone="ok" />
      </div>

      <AutomationSettingsPanel isAdmin={isAdmin} />

      <DisciplineAutomationRunnerPanel isAdmin={isAdmin} />

      <ResendSmokeTestPanel isAdmin={isAdmin} />

      <QaAutopilotPanel isAdmin={isAdmin} />

      <QaAutomationCenterPanel isAdmin={isAdmin} />

      <MissedTasksPanel userId={userId} isAdmin={isAdmin} />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "bad" | "warn" | "ok" }) {
  const ring =
    tone === "bad" ? "border-red-200 bg-red-50/40"
    : tone === "warn" ? "border-amber-200 bg-amber-50/40"
    : "border-emerald-200 bg-emerald-50/40";
  return (
    <div className={`bg-white border ${ring} rounded-xl p-4`}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium">{label}</div>
      <div className="text-2xl font-semibold text-stone-900 mt-1">{value}</div>
    </div>
  );
}
