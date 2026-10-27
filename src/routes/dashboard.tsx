import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScrollableTable } from "@/components/marketizers/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import AdminSummaryStrip from "@/components/dashboard/AdminSummaryStrip";
import StudioSetupJourney from "@/components/dashboard/StudioSetupJourney";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24, color: "var(--ink4)" }}>Loading…</div>;
  if (!user) return <div style={{ padding: 24 }}>Sign in to view your dashboard.</div>;
  if (!isAdmin(user)) return <EmployeeDashboard />;
  return <DashboardPage />;
}

const BRAND_COLORS = {
  ipc: "#C9973A",
  marketizers: "#6090E0",
  mulberry: "#c4697e",
  influenceOs: "#9B7FCA",
};

const CHART_DATA = [
  { month: "Jan", ipc: 50, marketizers: 37, mulberry: 27, influenceOs: 16 },
  { month: "Feb", ipc: 58, marketizers: 43, mulberry: 31, influenceOs: 20 },
  { month: "Mar", ipc: 72, marketizers: 56, mulberry: 40, influenceOs: 26 },
  { month: "Apr", ipc: 66, marketizers: 60, mulberry: 46, influenceOs: 29 },
  { month: "May", ipc: 90, marketizers: 74, mulberry: 56, influenceOs: 33 },
];

const BRANDS = [
  { slug: "ipc", name: "India Photographers Club", cat: "Education · Community", color: "#C9973A", revenue: "₹82.4L", expenses: "₹51.1L", net: "₹31.3L", margin: "38%", status: "profit" as const },
  { slug: "marketizers", name: "Marketizers", cat: "Performance Agency", color: "#6090E0", revenue: "₹96.2L", expenses: "₹63.4L", net: "₹32.8L", margin: "34%", status: "profit" as const },
  { slug: "mulberry", name: "The Mulberry Weddings", cat: "Photography · Film", color: "#c4697e", revenue: "₹54.8L", expenses: "₹39.6L", net: "₹15.2L", margin: "28%", status: "profit" as const },
  { slug: "influence-os", name: "Influence OS", cat: "Influence & Creator Marketing", color: "#9B7FCA", revenue: "₹38.6L", expenses: "₹32.1L", net: "₹6.5L", margin: "17%", status: "warn" as const },
];

const ROLES = [
  { name: "Admin", access: "All brands · All modules", badge: "Full Access", cls: "rb-full" },
  { name: "Finance Manager", access: "All finance modules", badge: "Finance", cls: "rb-finance" },
  { name: "Operator", access: "Assigned brand only", badge: "Brand", cls: "rb-brand" },
  { name: "Brand Manager", access: "One brand — all modules", badge: "Brand", cls: "rb-brand" },
  { name: "Team Member", access: "Entry only — no reports", badge: "Entry", cls: "rb-entry" },
];

function DashboardPage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = "Dashboard | GWV Vision Center"; }, []);

  return (
    <div>
      {/* HERO */}
      <div style={pgHero}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Executive Command Dashboard
        </div>
        <h1 style={pgTitle}>
          Every number.<br />
          <em style={{ fontStyle: "italic", color: "var(--gold2)" }}>Every brand.</em><br />
          One command centre.
        </h1>
        <p style={pgSub}>
          Revenue, expenses, brand health, and team systems — visible without the
          founder having to ask for an update.
        </p>
      </div>

      <StudioSetupJourney />
      <AdminSummaryStrip />

      {/* METRICS */}
      <div style={metricRow}>
        <MetricCard accent="gold" label="Total Revenue" value="₹2.72Cr" delta="▲ 18.4% vs last month" deltaTone="up" />
        <MetricCard accent="green" label="Net Profit" value="₹85.8L" delta="▲ 11.2% margin improving" deltaTone="up" />
        <MetricCard accent="amber" label="Target Progress" value="86%" delta="● ₹46L remaining" deltaTone="na" />
        <MetricCard accent="red" label="Pending Entries" value="14" delta="▼ 3 receipts missing" deltaTone="dn" />
      </div>

      {/* CHART */}
      <div className="panel" style={{ marginBottom: 28, animation: "fadeUp .55s .16s ease both" }}>
        <div className="ph">
          <div>
            <div className="panel-title">Monthly Revenue — All Brands</div>
            <div className="panel-sub">Jan – May 2025 · Combined view</div>
          </div>
          <select className="select-mini">
            <option>2025 — Full Year</option>
            <option>FY 2024–25</option>
          </select>
        </div>
        <div style={{ padding: "20px 18px 8px" }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={CHART_DATA} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#EDE7D9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9B8F84", fontFamily: "DM Mono, monospace", fontSize: 10 }}
                axisLine={{ stroke: "#DDD6CA" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9B8F84", fontFamily: "DM Mono, monospace", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "rgba(28,24,20,.04)" }}
                contentStyle={{
                  background: "var(--ivory)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="ipc" name="IPC" fill={BRAND_COLORS.ipc} radius={[3, 3, 0, 0]} />
              <Bar dataKey="marketizers" name="Marketizers" fill={BRAND_COLORS.marketizers} radius={[3, 3, 0, 0]} />
              <Bar dataKey="mulberry" name="Mulberry" fill={BRAND_COLORS.mulberry} radius={[3, 3, 0, 0]} />
              <Bar dataKey="influenceOs" name="Influence OS" fill={BRAND_COLORS.influenceOs} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={chartLegend}>
          {[
            { c: "#C9973A", l: "IPC" },
            { c: "#6090E0", l: "Marketizers" },
            { c: "#c4697e", l: "Mulberry" },
            { c: "#9B7FCA", l: "Influence OS" },
          ].map((it) => (
            <div key={it.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink3)" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: it.c }} />
              {it.l}
            </div>
          ))}
        </div>
        <div style={chartFooter}>
          Financial Year 2024–25 · Revenue figures include all completed bookings · Updated 9 May 2025
        </div>
      </div>

      {/* TWO COL */}
      <div style={twoCol}>
        {/* Brand Health */}
        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Brand Health</div>
              <div className="panel-sub">Click any brand to drill down into its full P&amp;L</div>
            </div>
            <select className="select-mini">
              <option>May 2025</option>
              <option>Apr 2025</option>
            </select>
          </div>
          <div style={{ padding: "0 26px" }}>
            <ScrollableTable minWidth={620}>
            <table style={btable}>
              <thead>
                <tr>
                  <th style={btTh}>Brand</th>
                  <th style={{ ...btTh, textAlign: "right" }}>Revenue</th>
                  <th style={{ ...btTh, textAlign: "right" }}>Expenses</th>
                  <th style={{ ...btTh, textAlign: "right" }}>Net</th>
                  <th style={{ ...btTh, textAlign: "right" }}>Margin</th>
                  <th style={{ ...btTh, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {BRANDS.map((b, i) => (
                  <tr
                    key={b.slug}
                    onClick={() => navigate({ to: `/brands/${b.slug}` as any })}
                    style={{
                      borderBottom: i === BRANDS.length - 1 ? "none" : "1px solid var(--parchment2)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--parchment)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={btTd}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13, lineHeight: 1.2 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 1 }}>{b.cat}</div>
                        </div>
                      </div>
                    </td>
                    <td style={btTdNum} className="num-neu">{b.revenue}</td>
                    <td style={btTdNum} className="num-neu">{b.expenses}</td>
                    <td style={btTdNum} className="num-pos">{b.net}</td>
                    <td style={btTdNum} className="num-pos">{b.margin}</td>
                    <td style={{ ...btTdNum }}>
                      <span className={`status-pill ${b.status === "profit" ? "sp-profit" : b.status === "warn" ? "sp-warn" : "sp-loss"}`}>
                        {b.status === "profit" ? "Profit" : b.status === "warn" ? "Watch" : "Loss"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ScrollableTable>
          </div>
        </div>

        {/* Access Control */}
        <div className="panel">
          <div className="ph">
            <div>
              <div className="panel-title">Access Control</div>
              <div className="panel-sub">Role-based data visibility</div>
            </div>
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 9,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                padding: "3px 9px",
                borderRadius: 4,
                background: "var(--green-bg)",
                color: "var(--green)",
                border: "1px solid var(--green-b)",
              }}
            >
              Secure
            </span>
          </div>
          <div className="panel-body">
            {ROLES.map((r, i) => (
              <div
                key={r.name}
                style={{
                  padding: "13px 0",
                  borderBottom: i === ROLES.length - 1 ? "none" : "1px solid var(--parchment2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 1 }}>{r.access}</div>
                </div>
                <span className={`role-badge ${r.cls}`}>{r.badge}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "16px 26px", borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => navigate({ to: "/settings/users" })}
              style={{
                width: "100%",
                padding: 11,
                borderRadius: 6,
                background: "var(--ink)",
                border: "none",
                fontFamily: "'Figtree',sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--parchment)",
                cursor: "pointer",
                letterSpacing: ".01em",
              }}
            >
              Manage Users &amp; Roles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  accent, label, value, delta, deltaTone,
}: {
  accent: "gold" | "green" | "amber" | "red";
  label: string; value: string; delta: string;
  deltaTone: "up" | "dn" | "na";
}) {
  const accentColor = {
    gold: "var(--gold3)", green: "var(--green)", amber: "var(--amber)", red: "var(--red)",
  }[accent];
  const tone = {
    up: "var(--green)", dn: "var(--red)", na: "var(--ink4)",
  }[deltaTone];

  return (
    <div
      style={{
        background: "var(--ivory)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "24px 24px 20px",
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow .2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(28,24,20,.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,2.8vw,38px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1, marginBottom: 7, letterSpacing: "-.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: tone, display: "flex", alignItems: "center", gap: 5 }}>
        {delta}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: accentColor, borderRadius: "0 0 10px 10px" }} />
    </div>
  );
}

const pgHero: React.CSSProperties = {
  marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid var(--border)",
  animation: "fadeUp .55s ease both",
};
const pgTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: "clamp(34px,3.5vw,52px)",
  fontWeight: 700,
  color: "var(--ink)",
  lineHeight: 1.05,
  letterSpacing: "-.02em",
  marginBottom: 12,
};
const pgSub: React.CSSProperties = {
  fontSize: 14, color: "var(--ink3)", maxWidth: 460, lineHeight: 1.7, fontWeight: 300,
};
const metricRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32,
  animation: "fadeUp .55s .08s ease both",
};
const twoCol: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 28,
  animation: "fadeUp .55s .24s ease both",
};
const chartLegend: React.CSSProperties = {
  display: "flex", gap: 18, padding: "14px 26px", borderTop: "1px solid var(--border)",
};
const chartFooter: React.CSSProperties = {
  padding: "11px 26px",
  fontFamily: "'DM Mono',monospace",
  fontSize: 8.5,
  color: "var(--ink4)",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  borderTop: "1px solid var(--border)",
  background: "var(--parchment)",
};
const btable: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const btTh: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 8.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink4)",
  padding: "0 0 12px",
  borderBottom: "1px solid var(--border)",
  textAlign: "left",
  fontWeight: 400,
};
const btTd: React.CSSProperties = { padding: "14px 0", verticalAlign: "middle", fontSize: 13 };
const btTdNum: React.CSSProperties = {
  padding: "14px 0",
  verticalAlign: "middle",
  textAlign: "right",
  fontFamily: "'DM Mono',monospace",
  fontSize: 12,
};
