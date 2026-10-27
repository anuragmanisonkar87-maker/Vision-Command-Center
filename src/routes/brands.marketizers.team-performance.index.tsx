import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/marketizers/ui";

export const Route = createFileRoute("/brands/marketizers/team-performance/")({
  component: TeamPerformancePage,
});

type Card = {
  title: string;
  purpose: string;
  status: "Live" | "Foundation Ready" | "Coming Soon";
  to?: string;
};

const CARDS: Card[] = [
  {
    title: "Media Buyer Performance",
    purpose:
      "Daily ad spend, leads, CPL, campaign performance, client-wise reporting.",
    status: "Live",
    to: "/brands/marketizers/team-performance/media-buyer-performance",
  },
  {
    title: "Creative Team Reporting",
    purpose:
      "Video editor and design output, delivery status, creative performance.",
    status: "Coming Soon",
  },
  {
    title: "Sales Team Reporting",
    purpose: "Calls, follow-ups, conversions, close rate.",
    status: "Coming Soon",
  },
  {
    title: "Operations Reporting",
    purpose: "Client tasks, delivery, internal coordination.",
    status: "Coming Soon",
  },
];

function pillClass(s: Card["status"]) {
  if (s === "Live") return "sp-good";
  if (s === "Foundation Ready") return "sp-warn";
  return "sp-loss";
}

function TeamPerformancePage() {
  useEffect(() => {
    document.title = "Team Performance | Marketizers | GWV Vision Center";
  }, []);
  return (
    <div>
      <PageHeader
        eyebrow="Marketizers"
        title="Team Performance Management"
        subtitle="Daily reporting and performance tracking for Marketizers teams."
        actions={
          <Link to="/brands/marketizers">
            <button className="btn-sm">← Back to Hub</button>
          </Link>
        }
      />

      <div
        style={{
          marginBottom: 22,
          padding: "12px 16px",
          background: "var(--gold-bg)",
          border: "1px solid var(--gold-border)",
          borderRadius: 8,
          fontSize: 12.5,
          color: "var(--gold)",
        }}
      >
        Monthly Entry will fetch leads, calls booked, sales closed, and
        performance metrics from these modules as each one goes live.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="panel"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--ink)",
                }}
              >
                {c.title}
              </div>
              <span className={`status-pill ${pillClass(c.status)}`}>
                {c.status}
              </span>
            </div>
            <div
              style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.5 }}
            >
              {c.purpose}
            </div>
            {c.to ? (
              <Link to={c.to} style={{ alignSelf: "flex-start" }}>
                <button className="btn-sm">Open Module →</button>
              </Link>
            ) : (
              <button
                className="btn-sm"
                disabled
                style={{ alignSelf: "flex-start", opacity: 0.7 }}
              >
                Coming Soon
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
