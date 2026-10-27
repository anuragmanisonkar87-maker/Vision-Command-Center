import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { PageHeader } from "@/components/marketizers/ui";

export const Route = createFileRoute(
  "/brands/ipc/team-performance/video-editor-performance/",
)({
  component: HubPage,
});

function HubPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  useEffect(() => { document.title = "Video Editor Performance | IPC | GWV Vision Center"; }, []);
  return (
    <div>
      <PageHeader
        eyebrow="IPC / Team Performance"
        title="Video Editor Performance"
        subtitle="Daily editor KPI, finish gate, revisions, backup, and the weekly Critical Number."
        actions={
          <Link to="/brands/ipc/team-performance">
            <button className="btn-sm">← Back</button>
          </Link>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <ActionCard title="Log Today's KPI" desc="Editor: submit today's committed, shipped, gate & backup." to="/brands/ipc/team-performance/video-editor-performance/daily-reporting" />
        <ActionCard title="History (30 days)" desc="Good-day rate, average revisions, on-time trend." to="/brands/ipc/team-performance/video-editor-performance/reports-history" />
        {admin && (
          <ActionCard title="Settings" desc="Edit KPI fields, daily target, and Critical Number." to="/brands/ipc/team-performance/video-editor-performance/settings" />
        )}
      </div>
    </div>
  );
}

function ActionCard({ title, desc, to }: { title: string; desc: string; to: string }) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div className="panel" style={{ padding: 20, minHeight: 130, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.5 }}>{desc}</div>
      </div>
    </Link>
  );
}
