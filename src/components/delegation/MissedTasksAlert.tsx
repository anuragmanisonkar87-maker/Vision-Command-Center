// Phase 3F — compact admin-only alert on Daily/Team Grid pointing into Discipline Center.
import { useEffect, useState } from "react";
import { listAllTasks } from "@/services/delegation/delegationService";
import { isStandupOrAdHocMissed } from "@/lib/delegation/missedTask";

type Props = { onOpenDisciplineCenter: () => void };

export default function MissedTasksAlert({ onOpenDisciplineCenter }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllTasks({})
      .then((tasks) => {
        if (cancelled) return;
        const now = new Date();
        setCount(tasks.filter((t) => isStandupOrAdHocMissed(t as any, now)).length);
      })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div
      data-testid="missed-tasks-alert"
      className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.14em] text-amber-800 font-medium">
          Missed Task Discipline
        </div>
        <div className="text-sm text-stone-800">
          There {count === 1 ? "is" : "are"} <strong>{count}</strong> missed stand-up/ad hoc task{count === 1 ? "" : "s"} requiring action.
        </div>
      </div>
      <button
        onClick={onOpenDisciplineCenter}
        data-testid="open-discipline-center"
        className="px-4 py-2 rounded-md bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 shrink-0"
      >
        Open Discipline Center
      </button>
    </div>
  );
}
