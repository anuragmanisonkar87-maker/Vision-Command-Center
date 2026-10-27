// Phase 3F — scheduled discipline automation cron entry point.
// Calls into the same core that `runDisciplineAutomation` uses, but with the
// service-role admin client (server-only). pg_cron should POST here daily.
// Security: requires the Supabase anon key in the `apikey` header (standard
// pg_cron pattern). Use the stable project URL when scheduling.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/discipline-automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") || request.headers.get("x-api-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { performDisciplineAutomation } = await import("@/lib/delegation/disciplineAutomation.functions");
          const report = await performDisciplineAutomation(supabaseAdmin, null, { runType: "scheduled" });
          return new Response(JSON.stringify({ ok: true, report }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: (e?.message ?? "error").slice(0, 500) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
