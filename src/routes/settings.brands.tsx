import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { isAdmin } from "@/utils/permissions/rolePermissions";
import { useBrands } from "@/hooks/useBrands";
import { archiveBrand, softDeleteBrand, type Brand } from "@/services/brands/brandService";
import { BrandFormDrawer } from "@/components/brands/BrandFormDrawer";
import {
  PageHeader, EmptyState, LoadingState, ErrorBanner, ScrollableTable,
} from "@/components/marketizers/ui";

export const Route = createFileRoute("/settings/brands")({
  component: BrandManagementPage,
});

function BrandManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { brands, loading, error, refetch } = useBrands();
  const [drawer, setDrawer] = useState<Partial<Brand> | null>(null);
  const admin = isAdmin(user);

  useEffect(() => { document.title = "Brand Management | Settings"; }, []);

  if (authLoading) return <LoadingState rows={3} />;
  if (!admin) {
    return (
      <div>
        <PageHeader eyebrow="Settings" title="Brand Management" />
        <EmptyState icon="🔒" title="Admin access required" message="Only administrators can manage brands." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Brand Management"
        subtitle="Add, edit and archive brands. Changes flow into the sidebar, allocation editor and user access selector automatically."
        actions={<button className="btn-sm btn-primary" onClick={() => setDrawer({})}>+ Add Brand</button>}
      />

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {loading ? <LoadingState rows={4} /> : !brands.length ? (
        <EmptyState icon="◆" title="No brands yet" message="Add your first brand to populate the sidebar." action={<button className="btn-sm btn-primary" onClick={() => setDrawer({})}>+ Add Brand</button>} />
      ) : (
        <div className="panel">
          <ScrollableTable minWidth={780}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Brand", "Slug", "Category", "Sidebar", "Allocation", "Status", "Sort", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--parchment2)" }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                        <strong style={{ color: "var(--ink)" }}>{b.name}</strong>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)" }}>{b.slug}</td>
                    <td style={td}>{b.category ?? "—"}</td>
                    <td style={td}>{b.include_in_sidebar ? "✓" : "—"}</td>
                    <td style={td}>{b.include_in_expense_allocation ? "✓" : "—"}</td>
                    <td style={td}><span className={`status-pill ${b.status === "active" ? "sp-profit" : "sp-warn"}`}>{b.status}</span></td>
                    <td style={td}>{b.sort_order}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn-sm" onClick={() => setDrawer(b)}>Edit</button>{" "}
                      {b.status !== "archived" && (
                        <button className="btn-sm" onClick={async () => { if (confirm(`Archive ${b.name}?`)) { await archiveBrand(b.id); refetch(); } }}>Archive</button>
                      )}{" "}
                      <button className="btn-sm" onClick={async () => { if (confirm(`Delete ${b.name}? This cannot be undone from the UI.`)) { await softDeleteBrand(b.id); refetch(); } }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {drawer && (
        <BrandFormDrawer
          initial={drawer}
          onClose={() => setDrawer(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)", padding: "12px 8px 12px 18px", borderBottom: "1px solid var(--border)", fontWeight: 400, textAlign: "left" };
const td: React.CSSProperties = { padding: "13px 8px 13px 18px", verticalAlign: "middle", fontSize: 13, color: "var(--ink2)" };
