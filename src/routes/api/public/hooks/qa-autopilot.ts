// Phase 3F.4 — QA Autopilot scheduled endpoint.
// pg_cron POSTs here daily (and weekly Sunday); the apikey header gates access.
// Safety: never returns secrets, no employee tasks touched, all cleanup runs in finally.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/qa-autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") || request.headers.get("x-api-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const url = new URL(request.url);
          let body: any = {};
          try { body = await request.json(); } catch { body = {}; }
          const isWeekly = body?.weekly === true || url.searchParams.get("weekly") === "1";
          const actorUserId = process.env.QA_AUTOPILOT_ACTOR_USER_ID || null;
          const actorMissing = !actorUserId;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { performQaAutopilot } = await import("@/lib/qa/qaAutopilot.functions");

          // Load Resend smoke mode from delegation_settings
          let resendMode: "off" | "weekly_only" | "every_run" = "weekly_only";
          try {
            const { data } = await supabaseAdmin
              .from("delegation_settings")
              .select("settings")
              .eq("id", 1)
              .maybeSingle();
            const m = (data as any)?.settings?.qa_autopilot?.resend_smoke_mode;
            if (m === "off" || m === "weekly_only" || m === "every_run") resendMode = m;
          } catch { /* default */ }

          const report = await performQaAutopilot(supabaseAdmin, null, {
            runType: "scheduled",
            triggerSource: isWeekly ? "pg_cron_weekly" : "pg_cron",
            isWeekly,
            actorUserId,
            actorMissing,
            resendMode,
          });

          return new Response(JSON.stringify({
            ok: true,
            runId: report.runId,
            status: report.status,
            failedCount: report.failedCount,
            skippedCount: report.skippedCount,
            passedCount: report.passedCount,
            cleanupStatus: report.cleanupStatus,
            isWeekly: report.isWeekly,
            resendIncluded: report.resendIncluded,
            resendSkipReason: report.resendSkipReason,
            actorMissing: report.actorMissing,
            logId: report.logId,
          }), {
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
