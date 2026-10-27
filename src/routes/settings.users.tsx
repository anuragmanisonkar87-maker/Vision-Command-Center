import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { listUserInvites, cancelUserInvite, type UserInvite } from "@/services/users/userService";
import {
  ErrorBanner, EmptyState, LoadingState, ScrollableTable, inputStyle,
} from "@/components/marketizers/ui";
import { UserInviteDrawer } from "@/components/users/UserInviteDrawer";
import { LoginAccessTable } from "@/components/users/LoginAccessTable";
import TeamAccessControlPage from "@/components/access-control/TeamAccessControlPage";

export const Route = createFileRoute("/settings/users")({
  component: UsersAndRolesPage,
});

function UsersAndRolesPage() {
  const { user, loading: authLoading } = useAuth();
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAdmin = !!user?.roles.includes("admin");

  useEffect(() => { document.title = "Users & Roles | Settings"; }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const i = await listUserInvites();
      setInvites(i);
    } catch (e: any) { setError(e?.message ?? "Could not load users."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isAdmin]);

  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invites;
    return invites.filter((i) => [i.email, i.display_name ?? "", ...i.roles, i.status].join(" ").toLowerCase().includes(q));
  }, [invites, search]);

  if (authLoading) return <LoadingState rows={3} />;

  if (!isAdmin) {
    return (
      <div>
        <EmptyState icon="🔒" title="Admin access required" message="Only administrators can view and manage users, roles, and access." />
      </div>
    );
  }

  return (
    <div>
      <TeamAccessControlPage
        eyebrow="Settings"
        title="Users & Roles"
        subtitle="Manage team members, positions, brand access, module access, permissions, and user invites from one place."
        extraActions={
          <>
            <input style={{ ...inputStyle, width: 220, padding: "6px 10px", fontSize: 12 }}
              placeholder="Search invites…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-sm btn-primary" onClick={() => setDrawerOpen(true)}>+ Invite User</button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <LoginAccessTable />

      {loading ? <LoadingState rows={4} /> : (
        <>
          <div className="panel">
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--parchment2)", fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
              Pending Invites
            </div>
            {!filteredInvites.length ? (
              <div style={{ padding: 24, fontSize: 13, color: "var(--ink4)" }}>No invites yet.</div>
            ) : (
              <ScrollableTable minWidth={620}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Email", "Name", "Roles", "Status", "Created", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredInvites.map((i) => (
                      <tr key={i.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                        <td style={td}>{i.email}</td>
                        <td style={td}>{i.display_name ?? "—"}</td>
                        <td style={td}>{i.roles.join(", ") || "—"}</td>
                        <td style={td}><span className={`status-pill ${i.status === "pending" ? "sp-warn" : "sp-profit"}`}>{i.status}</span></td>
                        <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>{new Date(i.created_at).toLocaleDateString()}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {i.status === "pending" && (
                            <button className="btn-sm" onClick={async () => { await cancelUserInvite(i.id); load(); }}>Cancel</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
          </div>
        </>
      )}

      {drawerOpen && <UserInviteDrawer onClose={() => setDrawerOpen(false)} onSaved={load} />}
    </div>
  );
}

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 22px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "13px 8px 13px 22px", verticalAlign: "middle", fontSize: 13, color: "var(--ink2)" };
