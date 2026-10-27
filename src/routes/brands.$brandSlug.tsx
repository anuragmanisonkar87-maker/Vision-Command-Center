import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBrandBySlug, type Brand } from "@/services/brands/brandService";
import { PageHeader, EmptyState, LoadingState, ErrorBanner } from "@/components/marketizers/ui";

export const Route = createFileRoute("/brands/$brandSlug")({
  component: BrandLandingPage,
});

function BrandLandingPage() {
  const { brandSlug } = useParams({ from: "/brands/$brandSlug" });
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setBrand(await getBrandBySlug(brandSlug)); }
    catch (e: any) { setErr(e?.message ?? "Failed to load brand."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); document.title = `${brandSlug} | Brands | Vision Center`; /* eslint-disable-next-line */ }, [brandSlug]);

  if (loading) return <LoadingState rows={3} />;
  if (err) return <ErrorBanner message={err} onRetry={load} />;
  if (!brand) {
    return <EmptyState icon="🔍" title="Brand not found" message={`No brand found for "${brandSlug}".`} />;
  }

  const modules = ["Revenue", "Expenses", "Reports", "Team", "Operations"];

  return (
    <div>
      <PageHeader
        eyebrow={brand.category ?? "Brand"}
        title={brand.name}
        subtitle={brand.description ?? "Brand workspace coming soon."}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: brand.color }} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".12em" }}>
          {brand.status}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        {modules.map((m) => (
          <div key={m} className="panel" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{m}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--gold3)", letterSpacing: ".14em", textTransform: "uppercase" }}>Coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}
