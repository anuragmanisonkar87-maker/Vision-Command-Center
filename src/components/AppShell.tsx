import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { isAdmin, canViewHrCommandCenter } from "@/utils/permissions/rolePermissions";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";

type NavItem = {
  label: string;
  to: string;
  badge?: string;
  badgeStyle?: "default" | "soon";
  moduleKey?: string;
  adminOnly?: boolean;
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", badge: "Live" },
      { label: "Attendance", to: "/attendance" },
      { label: "Daily Checklist", to: "/daily-checklist" },
      { label: "Announcements", to: "/announcements" },
      { label: "Task Manager", to: "/task-manager" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Revenue Tracking", to: "/finance/revenue", badge: "6", moduleKey: "finance_revenue" },
      { label: "Expense Log", to: "/finance/expenses", badge: "82", moduleKey: "finance_expenses" },
      { label: "P&L Reports", to: "/finance/pl", badge: "FY", moduleKey: "finance_pl" },
    ],
  },
];

// Brands are loaded dynamically from gwv_brands via useBrands().

const PEOPLE: NavItem[] = [
  { label: "Delegation Command Center", to: "/delegation", badge: "New" },
  { label: "Hiring Intelligence", to: "/people/hiring", badge: "Soon", badgeStyle: "soon", moduleKey: "people_hiring" },
  { label: "Daily Reporting", to: "/people/reporting", moduleKey: "people_reporting" },
  { label: "Team Directory", to: "/people/directory", moduleKey: "people_directory" },
];

const COMPANY_FUNCTIONS: NavItem[] = [
  { label: "HR Command Center", to: "/company-functions/hr-command-center", badge: "Score" },
];

const SETTINGS: NavItem[] = [
  { label: "Appearance", to: "/settings/appearance" },
  { label: "Attendance", to: "/settings/attendance", adminOnly: true },
  { label: "Recurring Daily Tasks", to: "/settings/recurring-tasks", adminOnly: true },
  { label: "Users & Roles", to: "/settings/users", adminOnly: true },
  { label: "Brand Management", to: "/settings/brands", adminOnly: true },
];

type Crumb = { label: string; to?: string };
// Each crumb may carry an `to` to make it clickable. The last crumb is always
// the current page (rendered without a link).
const CRUMBS: Record<string, Crumb[]> = {
  "/dashboard": [{ label: "Overview" }, { label: "Dashboard" }],
  "/announcements": [{ label: "Overview", to: "/dashboard" }, { label: "Announcements" }],
  "/task-manager": [{ label: "Overview", to: "/dashboard" }, { label: "Task Manager" }],
  "/attendance": [{ label: "Overview", to: "/dashboard" }, { label: "Attendance" }],
  "/settings/attendance": [{ label: "Settings" }, { label: "Attendance" }],
  "/finance/revenue": [{ label: "Finance" }, { label: "Revenue Tracking" }],
  "/finance/expenses": [{ label: "Finance" }, { label: "Expense Log" }],
  "/finance/pl": [{ label: "Finance" }, { label: "P&L Reports" }],
  "/brands/ipc": [{ label: "Brands", to: "/dashboard" }, { label: "India Photographers Club" }],
  "/brands/marketizers": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers" }, { label: "Hub" }],
  "/brands/marketizers/revenue": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance" }],
  "/brands/marketizers/revenue/entry": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Monthly Entry" }],
  "/brands/marketizers/revenue/clients": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Client Accounts" }],
  "/brands/marketizers/revenue/collections": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Pending Collections" }],
  "/brands/marketizers/revenue/reports": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Reports" }],
  "/brands/marketizers/revenue/reports/pl": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Reports", to: "/brands/marketizers/revenue/reports" }, { label: "P&L Report" }],
  "/brands/marketizers/revenue/expenses": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Revenue & Finance", to: "/brands/marketizers/revenue" }, { label: "Expenses Center" }],
  "/brands/marketizers/team-performance": [{ label: "Brands", to: "/dashboard" }, { label: "Marketizers", to: "/brands/marketizers" }, { label: "Team Performance" }],
  "/brands/mulberry": [{ label: "Brands", to: "/dashboard" }, { label: "The Mulberry Weddings" }],
  "/brands/influence-os": [{ label: "Brands", to: "/dashboard" }, { label: "Influence OS" }],
  "/delegation": [{ label: "People" }, { label: "Delegation Command Center" }],
  "/people/hiring": [{ label: "People" }, { label: "Hiring Intelligence" }],
  "/people/reporting": [{ label: "People" }, { label: "Daily Reporting" }],
  "/people/directory": [{ label: "People" }, { label: "Team Directory" }],
  "/company-functions/hr-command-center": [{ label: "Company Functions" }, { label: "HR Command Center" }],
  "/company-functions/hr-command-center/director-requirement-form": [{ label: "Company Functions" }, { label: "HR", to: "/company-functions/hr-command-center" }, { label: "Director Requirement Form" }],
  "/settings/users": [{ label: "Settings" }, { label: "Users & Roles" }],
  "/settings/brands": [{ label: "Settings" }, { label: "Brand Management" }],
  "/settings/appearance": [{ label: "Settings" }, { label: "Appearance" }],
};

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const cb = () => setM(mq.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  return m;
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs: Crumb[] = CRUMBS[pathname] ?? [{ label: "Overview" }, { label: "Dashboard" }];
  const today = useMemo(() => format(new Date(), "EEEE, d MMMM yyyy"), []);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { activeBrands } = useBrands();
  const admin = isAdmin(user);
  const showHr = canViewHrCommandCenter(user);
  const { canAccessModule, canAccessBrand, accessibleBrandIds, teamMemberId } = useEffectiveAccess();
  // If a non-admin user has a team-member record, filter sidebar by their
  // explicit module/brand permissions. Otherwise fall back to legacy
  // (everyone sees everything; RLS still enforces data access).
  const enforce = !admin && !!teamMemberId;
  const showItem = (it: NavItem) => {
    if (it.adminOnly) return admin;
    if (!enforce || !it.moduleKey) return true;
    return canAccessModule(it.moduleKey);
  };
  const sidebarBrands = useMemo(
    () =>
      activeBrands
        .filter((b) => b.include_in_sidebar)
        .filter((b) => (enforce ? canAccessBrand(b.id) : true)),
    [activeBrands, enforce, accessibleBrandIds.join(",")]
  );

  // dynamic breadcrumb fallback for /brands/$slug
  const dynamicBrand = useMemo(() => {
    const m = pathname.match(/^\/brands\/([^/]+)/);
    if (!m) return null;
    return activeBrands.find((b) => b.slug === m[1] || b.legacy_slug === m[1]) ?? null;
  }, [pathname, activeBrands]);
  const finalCrumbs: Crumb[] =
    CRUMBS[pathname]
      ? crumbs
      : dynamicBrand
        ? [{ label: "Brands", to: "/dashboard" }, { label: dynamicBrand.name }]
        : crumbs;

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const initial = (user?.display_name || user?.email || "?").trim().charAt(0).toUpperCase();
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Signed in";
  const roleLabel = user?.roles?.[0]
    ? user.roles[0].replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Member";

  const sidebarVisible = !isMobile || open;

  return (
    <div style={shell}>
      {/* SIDEBAR */}
      {isMobile && open && (
        <div onClick={() => setOpen(false)} style={scrim} />
      )}
      <aside
        style={{
          ...sidebar,
          position: isMobile ? "fixed" : "relative",
          transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .25s ease",
          zIndex: isMobile ? 60 : 1,
          boxShadow: isMobile && open ? "0 12px 40px rgba(0,0,0,.4)" : "none",
        }}
      >
        <div style={sbHead}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 5 }}>
            <div style={sbMark}>G</div>
            <div style={sbCo}>
              Grateful World
              <br />
              Ventures
            </div>
          </div>
          <div style={sbSys}>Vision Center</div>
        </div>

        <nav style={sbNav}>
          {SECTIONS.map((section, idx) => {
            const items = section.items.filter(showItem);
            if (!items.length) return null;
            return (
              <div key={section.label} style={{ marginTop: idx === 0 ? 0 : 6 }}>
                <span style={sbLabel}>{section.label}</span>
                {items.map((it) => (
                  <NavLinkItem key={it.to} item={it} active={pathname === it.to} />
                ))}
              </div>
            );
          })}

          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px" }}>
              <span style={{ ...sbLabel, padding: "10px 0 4px" }}>Brands</span>
              {admin && (
                <Link to="/settings/brands" style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: ".1em",
                  color: "var(--gold3)", padding: "4px 6px", border: "1px solid rgba(201,151,58,.4)",
                  borderRadius: 4,
                }} title="Add brand">+ Add</Link>
              )}
            </div>
            {sidebarBrands.map((b) => {
              const to = b.route_path || `/brands/${b.slug}`;
              const isMarketizers = b.slug === "marketizers";
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <div key={b.id}>
                  <Link
                    to={to}
                    style={{
                      ...sbBrand,
                      color: isActive ? "#FFFFFF" : "rgba(255,255,255,.65)",
                      background: isActive ? "rgba(255,255,255,.04)" : "transparent",
                    }}
                  >
                    <span style={{ ...sbDot, background: b.color }} />
                    {b.name}
                  </Link>
                  {isMarketizers && isActive && (
                    <div style={{ paddingLeft: 22, marginBottom: 4 }}>
                      {[
                         { label: "Hub", to: "/brands/marketizers" },
                         { label: "Revenue & Finance", to: "/brands/marketizers/revenue" },
                         { label: "Team Performance", to: "/brands/marketizers/team-performance" },
                         { label: "Reports", to: "/brands/marketizers/revenue/reports" },
                       ].map((s) => (
                        <Link key={s.to} to={s.to} style={{
                          display: "block",
                          padding: "5px 26px 5px 16px",
                          fontSize: 11.5,
                          fontFamily: "'Figtree',sans-serif",
                          color: pathname === s.to ? "var(--gold3)" : "rgba(255,255,255,.55)",
                          fontWeight: pathname === s.to ? 600 : 400,
                        }}>
                          · {s.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(() => {
            const peopleItems = PEOPLE.filter(showItem);
            if (!peopleItems.length) return null;
            return (
              <div style={{ marginTop: 6 }}>
                <span style={sbLabel}>People</span>
                {peopleItems.map((it) => (
                  <NavLinkItem key={it.to} item={it} active={pathname === it.to} />
                ))}
              </div>
            );
          })()}

          {showHr && (
            <div style={{ marginTop: 6 }}>
              <span style={sbLabel}>Company Functions</span>
              {COMPANY_FUNCTIONS.map((it) => (
                <NavLinkItem key={it.to} item={it} active={pathname === it.to} />
              ))}
            </div>
          )}

          {(() => {
            const settingsItems = SETTINGS.filter(showItem);
            if (!settingsItems.length) return null;
            return (
              <div style={{ marginTop: 6 }}>
                <span style={sbLabel}>Settings</span>
                {settingsItems.map((it) => (
                  <NavLinkItem key={it.to} item={it} active={pathname === it.to} />
                ))}
              </div>
            );
          })()}
        </nav>

        <div style={sbFoot}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={suAv}>{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...suName, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                <div style={suRole}>{roleLabel}</div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign out"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,.18)",
                color: "rgba(255,255,255,.7)",
                padding: "5px 9px",
                borderRadius: 6,
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
                letterSpacing: ".1em",
                cursor: "pointer",
              }}
            >
              EXIT
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={main}>
        <div style={{ ...topbar, padding: isMobile ? "0 16px" : "0 38px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Open menu"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 9px",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "var(--ink)",
                }}
              >
                ☰
              </button>
            )}
            <div style={{ ...tbPath, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {!isMobile && (
                <Link to="/dashboard" style={{ color: "var(--ink)", textDecoration: "none" }} className="crumb-link">
                  Vision Center
                </Link>
              )}
              <span style={{ color: "var(--ink3)" }}>
                {finalCrumbs.map((c, i) => {
                  const isLast = i === finalCrumbs.length - 1;
                  return (
                    <span key={i}>
                      <span style={{ margin: "0 6px" }}>/</span>
                      {c.to && !isLast ? (
                        <Link to={c.to} className="crumb-link" style={{ color: "var(--ink3)", textDecoration: "none" }}>
                          {c.label}
                        </Link>
                      ) : (
                        <span style={{ color: isLast ? "var(--ink3)" : "var(--ink3)" }}>{c.label}</span>
                      )}
                    </span>
                  );
                })}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isMobile && <div style={tbDate}>{today}</div>}
          </div>
        </div>

        <div style={{ ...content, padding: isMobile ? "20px 16px 48px" : "44px 38px 64px" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function NavLinkItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link to={item.to} style={{ display: "block" }}>
      <div
        style={{
          ...sbi,
          color: active ? "#FFFFFF" : "rgba(255,255,255,.75)",
          fontWeight: active ? 600 : 400,
          borderLeftColor: active ? "var(--gold3)" : "transparent",
          background: active ? "rgba(201,151,58,.12)" : "transparent",
        }}
      >
        <span>{item.label}</span>
        {item.badge && (
          <span
            style={{
              ...sbiBadge,
              background:
                item.badgeStyle === "soon"
                  ? "rgba(201,151,58,.18)"
                  : active
                  ? "rgba(201,151,58,.2)"
                  : "rgba(255,255,255,.08)",
              color:
                item.badgeStyle === "soon" || active
                  ? "var(--gold3)"
                  : "rgba(255,255,255,.4)",
            }}
          >
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

/* ── inline styles ── */
const shell: React.CSSProperties = { display: "flex", height: "100vh", overflow: "hidden", position: "relative" };
const scrim: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(28,24,20,.42)", zIndex: 55,
};
const sidebar: React.CSSProperties = {
  width: "var(--sidebar-w)",
  flexShrink: 0,
  background: "var(--ink)",
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  top: 0,
  left: 0,
  bottom: 0,
  height: "100vh",
};
const sbHead: React.CSSProperties = {
  padding: "28px 26px 22px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
};
const sbMark: React.CSSProperties = {
  width: 34,
  height: 34,
  background: "var(--gold3)",
  borderRadius: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 17,
  fontWeight: 700,
  color: "var(--ink)",
  flexShrink: 0,
};
const sbCo: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 14,
  fontWeight: 600,
  color: "#F5F0E8",
  lineHeight: 1.25,
  letterSpacing: ".01em",
};
const sbSys: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 8.5,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "var(--gold3)",
  marginLeft: 45,
  marginTop: 2,
};
const sbNav: React.CSSProperties = { padding: "18px 0", flex: 1 };
const sbLabel: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 8,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.48)",
  padding: "10px 26px 4px",
  display: "block",
};
const sbi: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 26px",
  cursor: "pointer",
  borderLeft: "2px solid transparent",
  transition: "all .15s",
  fontSize: 13,
  width: "100%",
  textAlign: "left",
  fontFamily: "'Figtree',sans-serif",
};
const sbiBadge: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 9,
  padding: "2px 7px",
  borderRadius: 10,
};
const sbBrand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 26px",
  cursor: "pointer",
  fontSize: 12.5,
  transition: "all .15s",
  fontFamily: "'Figtree',sans-serif",
};
const sbDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  flexShrink: 0,
  opacity: 0.9,
};
const sbFoot: React.CSSProperties = {
  padding: "18px 26px",
  borderTop: "1px solid rgba(255,255,255,.08)",
};
const suAv: React.CSSProperties = {
  width: 32,
  height: 32,
  background: "var(--gold3)",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--ink)",
  flexShrink: 0,
};
const suName: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2, maxWidth: 130 };
const suRole: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 8.5,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  color: "var(--gold3)",
};
const main: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--parchment)",
  minWidth: 0,
};
const topbar: React.CSSProperties = {
  height: 54,
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "var(--ivory)",
  flexShrink: 0,
};
const tbPath: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--ink4)",
};
const tbDate: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" };
const content: React.CSSProperties = { flex: 1, overflowY: "auto" };
