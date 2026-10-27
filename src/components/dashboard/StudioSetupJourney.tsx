import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";

type StepStatus = "done" | "current" | "locked";

type Step = {
  n: number;
  title: string;
  copy: string;
  ctas: { label: string; to?: string }[];
  done: boolean;
  available: boolean; // false => stays locked because route/data not wired yet
};

/**
 * Guided Studio Setup Journey
 * Wires only to routes that already exist in this project. Steps that depend
 * on photography-studio routes not present here render as Coming soon and
 * remain locked. No new tables, no schema changes.
 */
export default function StudioSetupJourney({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [teamCount, setTeamCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count } = await (supabase as any)
          .from("gwv_team_members")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (!cancelled) setTeamCount(count ?? 0);
      } catch {
        if (!cancelled) setTeamCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Admin / manager only
  if (!user || !isAdmin(user)) return null;

  const teamDone = (teamCount ?? 0) > 0;

  const steps: Step[] = [
    {
      n: 1, title: "Set up your team",
      copy: "Add your photographers, editors, managers, and team members. Then prepare their access and roles.",
      ctas: [
        { label: "Team Directory", to: "/people/directory" },
        { label: "Roles & Access", to: "/settings/team-access-control" },
      ],
      done: teamDone, available: true,
    },
    { n: 2, title: "Add your first client",
      copy: "Create the client record before starting a booked project.",
      ctas: [{ label: "Clients — coming soon" }], done: false, available: false },
    { n: 3, title: "Create your first project",
      copy: "Add project details, shoots, deliverables, billing, and final review.",
      ctas: [{ label: "Create Project — coming soon" }], done: false, available: false },
    { n: 4, title: "Book team for shoots",
      copy: "Assign your team members to the right shoots.",
      ctas: [{ label: "Team Booking — coming soon" }], done: false, available: false },
    { n: 5, title: "Track data and backup",
      copy: "Track shooter data, primary copy, and backup status shoot by shoot.",
      ctas: [{ label: "Data Management — coming soon" }], done: false, available: false },
    { n: 6, title: "Track payments/invoices",
      copy: "Track received payments, pending dues, invoices, and client billing.",
      ctas: [{ label: "Payments — coming soon" }], done: false, available: false },
    { n: 7, title: "Track project health",
      copy: "Check completion, blockers, overdue work, missing data, and recommended next action.",
      ctas: [{ label: "Project Tracking — coming soon" }], done: false, available: false },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const statusOf = (i: number, s: Step): StepStatus =>
    s.done ? "done" : i === currentIdx ? "current" : "locked";

  return (
    <section
      aria-label="Studio Setup Journey"
      style={{
        background: "var(--ivory)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: compact ? "18px 20px" : "22px 26px",
        marginBottom: compact ? 20 : 28,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 4 }}>
            Getting Started
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-.01em" }}>
            Studio Setup Journey
          </h2>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink3)" }}>
          {doneCount} of {steps.length} steps completed
        </div>
      </header>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {steps.map((s, i) => {
          const st = statusOf(i, s);
          const isCurrent = st === "current";
          const isDone = st === "done";
          const dim = st === "locked" || isDone;
          return (
            <li
              key={s.n}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 8,
                border: isCurrent ? "1px solid var(--gold3, #C9973A)" : "1px solid var(--parchment2)",
                background: isCurrent ? "rgba(201,151,58,.06)" : "transparent",
                opacity: dim && !isDone ? 0.78 : 1,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
                  background: isDone ? "var(--green, #2f7d3a)" : isCurrent ? "var(--gold3, #C9973A)" : "var(--parchment2)",
                  color: isDone || isCurrent ? "#fff" : "var(--ink3)",
                }}
              >
                {isDone ? "✓" : s.n}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2, lineHeight: 1.4 }}>
                  {isDone ? "Done. Now move to the next step." : s.copy}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {s.ctas.map((c, ci) => {
                  const primary = ci === 0;
                  const disabled = !c.to || (st === "locked");
                  const baseStyle: React.CSSProperties = {
                    fontFamily: "'Figtree',sans-serif",
                    fontSize: 12, fontWeight: 600,
                    padding: "7px 12px", borderRadius: 6,
                    border: primary ? "none" : "1px solid var(--border)",
                    background: disabled
                      ? "var(--parchment2)"
                      : primary ? "var(--ink)" : "transparent",
                    color: disabled
                      ? "var(--ink4)"
                      : primary ? "var(--parchment)" : "var(--ink)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  };
                  if (disabled || !c.to) {
                    return <span key={ci} style={baseStyle} aria-disabled>{c.label}</span>;
                  }
                  return (
                    <Link key={ci} to={c.to} style={baseStyle}>{c.label}</Link>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
