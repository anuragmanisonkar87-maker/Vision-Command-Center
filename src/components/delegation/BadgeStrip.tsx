// Reusable strip of badges for a user.
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { getUserBadges, type BadgeResult } from "@/services/delegation/badgeService";

export default function BadgeStrip({
  userId,
  period = "month",
  showLocked = false,
}: {
  userId: string;
  period?: "week" | "month";
  showLocked?: boolean;
}) {
  const [badges, setBadges] = useState<BadgeResult[] | null>(null);
  useEffect(() => { getUserBadges(userId, period).then(setBadges).catch(() => setBadges([])); }, [userId, period]);

  if (!badges) return null;
  const visible = showLocked ? badges : badges.filter((b) => b.earned);
  if (visible.length === 0) {
    return showLocked ? null : <span className="text-[11px] text-stone-400">No badges yet</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="dg-badge-strip">
      {visible.map((b) => (
        <span
          key={b.key}
          title={`${b.reason} · ${b.value}${b.reward_label ? ` · ${b.reward_label}` : ""}`}
          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
            b.earned
              ? "bg-[#FBF6E9] text-[#7A5E10] border-[#E8D49A]"
              : "bg-stone-50 text-stone-400 border-stone-200"
          }`}
        >
          <Award className="w-3 h-3" />{b.name}
          {b.reward_label && b.earned && <span className="ml-0.5 text-[9px] opacity-75">· {b.reward_label}</span>}
        </span>
      ))}
    </div>
  );
}
