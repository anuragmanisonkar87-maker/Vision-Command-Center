import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/marketizers/ui";

export const Route = createFileRoute("/brands/ipc/team-performance/")({
  component: IpcTeamPerformancePage,
});

function IpcTeamPerformancePage() {
  useEffect(() => {
    document.title = "Team Performance | IPC | GWV Vision Center";
  }, []);
  return (
    <div>
      <PageHeader
        eyebrow="IPC"
        title="Team Performance"
        subtitle="Daily reporting and performance tracking for IPC teams."
        actions={
          <Link to="/brands/ipc">
            <button className="btn-sm">← Back to IPC</button>
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card
          title="Video Editor Performance"
          purpose="Daily editor KPI: committed vs shipped, finish gate, revisions, backup, and weekly critical number."
          status="Live"
          to="/brands/ipc/team-performance/video-editor-performance"
        />
      </div>
    </div>
  );
}

function Card({ title, purpose, status, to }: { title: string; purpose: string; status: "Live" | "Soon"; to?: string }) {
  const pill = status === "Live" ? "sp-good" : "sp-warn";
  const body = (
    <div className="panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, minHeight: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        <span className={`status-pill ${pill}`}>{status}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.5 }}>{purpose}</div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: "none" }}>{body}</Link> : body;
}
