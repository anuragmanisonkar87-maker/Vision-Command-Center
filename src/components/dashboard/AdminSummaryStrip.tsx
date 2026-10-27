import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  listTemplates,
  listCompletionsForDate,
  todayISO,
} from "@/services/recurringTasks/recurringTasksService";
import { summarizeRecurringDay } from "@/lib/delegation/overdueStatus";

interface AdminStats {
  attendanceCount: number;
  visible: number;
  done: number;
  pending: number;
  missed: number;
  draftEmailCount: number;
  loading: boolean;
}

export default function AdminSummaryStrip() {
  const [stats, setStats] = useState<AdminStats>({
    attendanceCount: 0, visible: 0, done: 0, pending: 0, missed: 0,
    draftEmailCount: 0, loading: true,
  });

  useEffect(() => {
    const today = todayISO();
    let cancelled = false;
    (async () => {
      try {
        const db = supabase as any;
        const [attRes, templates, completions, draftRes] = await Promise.all([
          db.from("gwv_attendance_records")
            .select("id", { count: "exact", head: true })
            .eq("date", today)
            .not("check_in_at", "is", null),
          listTemplates({ activeOnly: true }).catch(() => []),
          listCompletionsForDate(today).catch(() => []),
          db.from("recurring_daily_email_logs")
            .select("id", { count: "exact", head: true })
            .eq("points_date", today)
            .eq("email_status", "draft"),
        ]);
        if (cancelled) return;
        const byTpl = new Map(completions.map((c: any) => [c.template_id, c]));
        const summary = summarizeRecurringDay(
          templates.map((t) => ({ template: t, completion: byTpl.get(t.id) ?? null })),
        );
        setStats({
          attendanceCount: attRes?.count ?? 0,
          visible: summary.visible,
          done: summary.done,
          pending: summary.pending,
          missed: summary.missed,
          draftEmailCount: draftRes?.count ?? 0,
          loading: false,
        });
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="panel" data-testid="admin-summary" style={{ marginBottom: 24 }}>
      <div className="ph">
        <div>
          <div className="panel-title">Today's Operations</div>
          <div className="panel-sub">Attendance, recurring tasks, and missed-task drafts</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, padding: 18 }}>
        <Stat label="Attendance" value={stats.attendanceCount} />
        <Stat label="Recurring Visible" value={stats.visible} />
        <Stat label="Done" value={stats.done} tone="good" />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Missed" value={stats.missed} tone={stats.missed > 0 ? "bad" : "neutral"} />
        <Stat label="Email Drafts" value={stats.draftEmailCount} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 18px 18px" }}>
        <Btn to="/attendance">Attendance</Btn>
        <Btn to="/delegation">Delegation</Btn>
        <Btn to="/settings/recurring-tasks">Recurring Tasks</Btn>
        <Btn to="/settings/users">Users &amp; Roles</Btn>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "good"|"bad"|"neutral" }) {
  const color = tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red)" : "var(--ink)";
  return (
    <div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Btn({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to as any} style={{
      padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
      background: "var(--parchment)", color: "var(--ink)", textDecoration: "none",
      fontFamily: "'Figtree',sans-serif", fontSize: 12, fontWeight: 600,
    }}>{children}</Link>
  );
}
