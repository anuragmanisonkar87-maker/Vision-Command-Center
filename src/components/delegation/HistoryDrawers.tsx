// Activity history & points breakdown drawers for the Delegation Command Center.
// Lightweight side panels that read from delegation_activity and
// delegation_points_ledger. RLS enforces who can see what.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  listTaskActivity,
  listTaskPoints,
  listUserPoints,
  type ActivityEntry,
  type PointsLedgerEntry,
} from "@/services/delegation/delegationService";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";
import BadgeStrip from "@/components/delegation/BadgeStrip";

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Shell({ title, subtitle, onClose, children, testid }: {
  title: string; subtitle?: string; onClose: () => void;
  children: React.ReactNode; testid?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 z-[110] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#F7F6F3] h-full overflow-y-auto border-l border-[#E8E5DE]"
        onClick={(e) => e.stopPropagation()}
        data-testid={testid}
      >
        <div className="p-5 border-b border-[#E8E5DE] flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }} className="text-stone-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function diffSummary(a: ActivityEntry): string | null {
  const ov = a.old_value, nv = a.new_value;
  if (!ov || !nv) return null;
  const keys = ["status", "system_stage", "due_date", "priority", "assignee_id", "proof_url", "revision_count", "is_deleted"];
  const parts: string[] = [];
  for (const k of keys) {
    const ovv = (ov as any)?.[k];
    const nvv = (nv as any)?.[k];
    if (ovv !== nvv && (ovv !== undefined || nvv !== undefined)) {
      parts.push(`${k}: ${ovv ?? "—"} → ${nvv ?? "—"}`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

export function TaskActivityDrawer({ taskId, taskTitle, onClose }: {
  taskId: string; taskTitle: string; onClose: () => void;
}) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  useEffect(() => {
    listTaskActivity(taskId).then(setRows).catch((e) => setError(e.message ?? "Failed to load"));
    listAllUsersWithRoles().then(setUsers).catch(() => setUsers([]));
  }, [taskId]);

  const nameOf = (id: string | null) =>
    id ? (users.find((u) => u.id === id)?.display_name ?? id.slice(0, 8)) : "system";

  return (
    <Shell title="Activity history" subtitle={taskTitle} onClose={onClose} testid="dg-activity-drawer">
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {!rows && !error && <div className="text-sm text-stone-500">Loading…</div>}
      {rows && rows.length === 0 && <div className="text-sm text-stone-500">No activity yet.</div>}
      {rows && rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((a) => {
            const diff = diffSummary(a);
            return (
              <li key={a.id} className="bg-white border border-[#E8E5DE] rounded-lg p-3" data-testid="dg-activity-row">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-stone-900 capitalize">{a.action}</span>
                  <span className="text-[11px] text-stone-500">{fmtWhen(a.created_at)}</span>
                </div>
                <div className="text-xs text-stone-600 mt-0.5">by {nameOf(a.actor_id)}</div>
                {diff && <div className="text-xs text-stone-700 mt-1 font-mono break-words">{diff}</div>}
                {a.note && <div className="text-xs text-stone-600 mt-1 italic">{a.note}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </Shell>
  );
}

function PointsList({ rows, showTask }: { rows: PointsLedgerEntry[]; showTask: boolean }) {
  if (rows.length === 0) return <div className="text-sm text-stone-500">No points recorded.</div>;
  const total = rows.reduce((a, r) => a + (r.points ?? 0), 0);
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between bg-white border border-[#E8E5DE] rounded-lg p-3">
        <span className="text-xs uppercase tracking-wide text-stone-500">Total</span>
        <span className="text-2xl font-semibold text-stone-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{total}</span>
      </div>
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="bg-white border border-[#E8E5DE] rounded-lg p-3 flex items-center gap-3" data-testid="dg-points-row">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-stone-900 capitalize">{r.reason.replace(/_/g, " ")}</div>
              {showTask && r.task_title && <div className="text-xs text-stone-500 truncate">{r.task_title}</div>}
              <div className="text-[11px] text-stone-500">{r.period_date}</div>
            </div>
            <div className={`text-base font-semibold ${r.points >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {r.points > 0 ? "+" : ""}{r.points}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export function TaskPointsDrawer({ taskId, taskTitle, onClose }: {
  taskId: string; taskTitle: string; onClose: () => void;
}) {
  const [rows, setRows] = useState<PointsLedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listTaskPoints(taskId).then(setRows).catch((e) => setError(e.message ?? "Failed to load"));
  }, [taskId]);
  return (
    <Shell title="Points breakdown" subtitle={taskTitle} onClose={onClose} testid="dg-points-drawer">
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {!rows && !error && <div className="text-sm text-stone-500">Loading…</div>}
      {rows && <PointsList rows={rows} showTask={false} />}
    </Shell>
  );
}

export function UserPointsDrawer({ userId, userName, onClose }: {
  userId: string; userName: string; onClose: () => void;
}) {
  const [rows, setRows] = useState<PointsLedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listUserPoints(userId).then(setRows).catch((e) => setError(e.message ?? "Failed to load"));
  }, [userId]);
  return (
    <Shell title={`${userName}'s points`} subtitle="Breakdown by task" onClose={onClose} testid="dg-user-points-drawer">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1.5">Badges this month</div>
        <BadgeStrip userId={userId} period="month" showLocked />
      </div>
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {!rows && !error && <div className="text-sm text-stone-500">Loading…</div>}
      {rows && <PointsList rows={rows} showTask={true} />}
    </Shell>
  );
}
