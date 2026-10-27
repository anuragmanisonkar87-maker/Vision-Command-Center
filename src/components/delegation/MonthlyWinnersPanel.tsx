// Monthly winners panel + admin freeze action for the Leaderboard tab.
import { useEffect, useState } from "react";
import { Trophy, Lock, Unlock, RefreshCcw } from "lucide-react";
import {
  getMonthlyWinners,
  freezeMonthlyWinners,
  unfreezeMonthlyWinners,
  monthStart,
  type MonthlyWinner,
} from "@/services/delegation/badgeService";
import { listAllUsersWithRoles, type AdminUserRow } from "@/services/users/userService";

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function MonthlyWinnersPanel({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [month, setMonth] = useState<string>(monthStart());
  const [winners, setWinners] = useState<MonthlyWinner[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getMonthlyWinners(month);
      setWinners(r.winners);
      setFrozen(r.frozen);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [month]);
  useEffect(() => { listAllUsersWithRoles().then(setUsers).catch(() => setUsers([])); }, []);

  const nameOf = (id: string | null) =>
    id ? (users.find((u) => u.id === id)?.display_name || id.slice(0, 8)) : "—";

  const handleFreeze = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try { await freezeMonthlyWinners(month, userId); await load(); }
    finally { setBusy(false); }
  };
  const handleUnfreeze = async () => {
    if (!isAdmin) return;
    if (!confirm("Unfreeze this month's winners? They will recalculate.")) return;
    setBusy(true);
    try { await unfreezeMonthlyWinners(month); await load(); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-[#E8E5DE] rounded-xl p-4" data-testid="dg-monthly-winners">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#C8A84B]" />
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }} className="text-stone-900">
            Monthly Winners
          </h3>
          {frozen && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FBF6E9] text-[#7A5E10] border border-[#E8D49A] flex items-center gap-1">
              <Lock className="w-3 h-3" /> Frozen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="text-xs px-2 py-1 border border-[#E8E5DE] rounded hover:bg-stone-50"
          >‹</button>
          <span className="text-sm text-stone-700 min-w-[110px] text-center">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= monthStart()}
            className="text-xs px-2 py-1 border border-[#E8E5DE] rounded hover:bg-stone-50 disabled:opacity-30"
          >›</button>
          {isAdmin && (
            frozen ? (
              <button
                onClick={handleUnfreeze}
                disabled={busy}
                data-testid="dg-unfreeze-winners"
                className="text-xs px-2.5 py-1 bg-white border border-[#E8E5DE] rounded hover:bg-stone-50 flex items-center gap-1"
              ><Unlock className="w-3 h-3" /> Unfreeze</button>
            ) : (
              <button
                onClick={handleFreeze}
                disabled={busy || loading}
                data-testid="dg-freeze-winners"
                className="text-xs px-2.5 py-1 bg-stone-900 text-[#C8A84B] rounded hover:bg-stone-800 flex items-center gap-1"
              ><Lock className="w-3 h-3" /> Freeze winners</button>
            )
          )}
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-stone-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {winners.map((w) => (
            <div
              key={w.award_type}
              data-testid={`dg-winner-${w.award_type}`}
              className="border border-[#E8E5DE] rounded-lg p-3 bg-[#FBF8F1]"
            >
              <div className="text-[10px] uppercase tracking-wide text-stone-500">{w.award_name}</div>
              <div className="text-sm font-medium text-stone-900 truncate mt-0.5">{nameOf(w.user_id)}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{w.value} {w.award_type === "top_points" ? "pts" : ""}</div>
              {w.reward_label && (
                <div className="text-[10px] mt-1 text-[#7A5E10]">{w.reward_label}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && !frozen && (
        <p className="text-[11px] text-stone-500 mt-3 flex items-center gap-1">
          <RefreshCcw className="w-3 h-3" /> Recalculating live — freeze to lock the snapshot.
        </p>
      )}
    </div>
  );
}
