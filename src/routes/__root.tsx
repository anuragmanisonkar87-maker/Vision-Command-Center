import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/auth/useAuth";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";
import { applyTheme, getStoredTheme } from "@/lib/theme/useTheme";

function NotFoundComponent() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--parchment)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div
          style={{
            width: 56, height: 56, background: "var(--gold3)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700,
            color: "var(--ink)", margin: "0 auto 24px",
          }}
        >
          G
        </div>
        <div
          style={{
            fontFamily: "'DM Mono',monospace", fontSize: 10,
            letterSpacing: ".2em", color: "var(--gold3)", marginBottom: 12,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond',serif", fontSize: 32,
            fontWeight: 700, color: "var(--ink)", marginBottom: 10, letterSpacing: "-.01em",
          }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--ink3)", marginBottom: 24, lineHeight: 1.6 }}>
          This page does not exist in the Vision Center.
        </p>
        <Link
          to="/dashboard"
          style={{
            display: "inline-block", padding: "10px 20px", borderRadius: 7,
            background: "var(--ink)", color: "var(--parchment)",
            fontSize: 13, fontWeight: 600, letterSpacing: ".01em",
          }}
        >
          ← Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          This page didn't load
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20 }}>{error.message}</p>
        <a href="/dashboard" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 7, background: "var(--ink)", color: "var(--parchment)", fontSize: 13, fontWeight: 600 }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GWV Vision Center" },
      { name: "description", content: "Internal operating platform for Grateful World Ventures." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "GWV Vision Center" },
      { name: "twitter:title", content: "GWV Vision Center" },
      { property: "og:description", content: "Internal operating platform for Grateful World Ventures." },
      { name: "twitter:description", content: "Internal operating platform for Grateful World Ventures." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/22a1a452-e2f8-4b99-949a-e2997a465c2c/id-preview-2a93dab2--d1500fd6-f1cb-4e75-9180-e8bc0d72b24f.lovable.app-1778299304658.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/22a1a452-e2f8-4b99-949a-e2997a465c2c/id-preview-2a93dab2--d1500fd6-f1cb-4e75-9180-e8bc0d72b24f.lovable.app-1778299304658.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Figtree:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href:
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231C1814'/><text x='16' y='22' text-anchor='middle' font-family='Georgia, serif' font-size='20' font-weight='700' fill='%23C9973A'>G</text></svg>`
          ),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStandalone = pathname === "/login" || pathname === "/reset-password" || pathname === "/terms" || pathname === "/privacy" || pathname === "/refund-policy" || pathname === "/cookie-policy";

  useEffect(() => { applyTheme(getStoredTheme()); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {isStandalone ? <Outlet /> : <AuthGate><AppShell /></AuthGate>}
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "var(--ink4)" }}>Loading…</div>;
  if (!user) return null;
  return <>{children}</>;
}
