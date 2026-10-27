// Phase 3F.3 — QA Autopilot unit tests.
// Uses a tiny fake supabase mirroring tests/unit/disciplineAutomation.test.ts.
import { describe, it, expect, beforeEach } from "vitest";
import {
  performQaAutopilot,
  __test,
} from "@/lib/qa/qaAutopilot.functions";

type Row = Record<string, any>;

function makeFake() {
  const tables: Record<string, Row[]> = {
    delegation_tasks: [],
    delegation_settings: [{ id: 1, settings: {} }],
    task_missed_points_ledger: [],
    task_missed_email_logs: [],
    gwv_attendance_records: [],
    discipline_automation_run_logs: [],
    qa_autopilot_run_logs: [],
  };

  const ledgerKey = (r: Row) => `${r.task_id}|${r.event_type}`;

  const api = (name: string) => {
    let filters: Array<(r: Row) => boolean> = [];
    const exec = () => (tables[name] ?? []).filter((r) => filters.every((f) => f(r)));
    const chain: any = {
      select() { return chain; },
      eq(col: string, val: any) { filters.push((r) => r[col] === val); return chain; },
      in(col: string, vals: any[]) { filters.push((r) => vals.includes(r[col])); return chain; },
      like(col: string, val: string) {
        const re = new RegExp("^" + val.replace(/%/g, ".*") + "$");
        filters.push((r) => typeof r[col] === "string" && re.test(r[col]));
        return chain;
      },
      gte(col: string, val: any) { filters.push((r) => r[col] >= val); return chain; },
      lte(col: string, val: any) { filters.push((r) => r[col] <= val); return chain; },
      order() { return chain; },
      limit() { return chain; },
      maybeSingle: async () => ({ data: exec()[0] ?? null, error: null }),
      single: async () => {
        const r = exec()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: any) => {
        const rows = exec();
        resolve({ data: rows, error: null, count: rows.length });
      },
      insert(row: Row | Row[]) {
        const arr = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];
        for (const r of arr) {
          if (name === "task_missed_points_ledger") {
            const k = ledgerKey(r);
            if (tables[name].some((x) => ledgerKey(x) === k)) {
              return {
                select: () => ({ single: async () => ({ data: null, error: { message: "duplicate key value violates unique" } }) }),
                then: (resolve: any) => resolve({ data: null, error: { message: "duplicate key value violates unique" } }),
              };
            }
          }
          const withId = { id: `id_${Math.random().toString(36).slice(2, 9)}`, ...r };
          tables[name].push(withId);
          inserted.push(withId);
        }
        return {
          select: () => ({
            single: async () => ({ data: inserted[0], error: null }),
            maybeSingle: async () => ({ data: inserted[0], error: null }),
          }),
          then: (resolve: any) => resolve({ data: inserted, error: null }),
        };
      },
      update(patch: Row) {
        const matched = exec();
        for (const r of matched) Object.assign(r, patch);
        return { eq: () => Promise.resolve({ data: matched, error: null }), then: (rs: any) => rs({ data: matched, error: null }) };
      },
      delete() {
        const matched = exec();
        tables[name] = tables[name].filter((r) => !matched.includes(r));
        return {
          in: () => Promise.resolve({ data: matched, error: null }),
          eq: () => Promise.resolve({ data: matched, error: null }),
        };
      },
    };
    return chain;
  };

  const supabase: any = {
    from: (name: string) => api(name),
    rpc: async () => ({ data: true, error: null }),
  };
  return { supabase, tables };
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("performQaAutopilot", () => {
  it("scheduled run without user_id still runs RLS / public / auth / cleanup suites", async () => {
    const { supabase, tables } = makeFake();
    const r = await performQaAutopilot(supabase, null, { runType: "scheduled", triggerSource: "pg_cron" });
    expect(r.runType).toBe("scheduled");
    expect(r.triggerSource).toBe("pg_cron");
    const suiteNames = r.suites.map((s) => s.suite);
    expect(suiteNames).toContain("role_access");
    expect(suiteNames).toContain("public_legal");
    expect(suiteNames).toContain("auth_routes");
    expect(suiteNames).toContain("cleanup_verification");
    expect(suiteNames).toContain("no_user_context");
    expect(tables.qa_autopilot_run_logs.length).toBe(1);
    expect(tables.qa_autopilot_run_logs[0].run_type).toBe("scheduled");
    expect(tables.qa_autopilot_run_logs[0].trigger_source).toBe("pg_cron");
  });

  it("includes attendance/task/missed/discipline suites when user_id provided", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, "admin-1", { runType: "manual", triggerSource: "admin_ui" });
    const suiteNames = r.suites.map((s) => s.suite);
    expect(suiteNames).toContain("attendance");
    expect(suiteNames).toContain("task_system");
    expect(suiteNames).toContain("missed_task");
    expect(suiteNames).toContain("discipline_automation");
    expect(suiteNames).toContain("resend_smoke");
  });

  it("Resend smoke test is skipped (not failed) when provider env missing", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, "admin-1", { runType: "manual" });
    const smoke = r.suites.find((s) => s.suite === "resend_smoke")!;
    expect(smoke.status).toBe("skipped");
    expect(smoke.steps[0].status).toBe("skipped");
  });

  it("cleanup verification reports clean when no QA rows remain", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, null, { runType: "scheduled" });
    expect(r.cleanupStatus).toBe("clean");
  });

  it("known route lists are not empty", () => {
    expect(__test.KNOWN_PUBLIC_LEGAL_ROUTES).toEqual(["/terms", "/privacy", "/refund-policy", "/cookie-policy"]);
    expect(__test.KNOWN_AUTH_ROUTES).toEqual(["/login", "/reset-password"]);
    expect(__test.RLS_REQUIRED_TABLES).toContain("qa_autopilot_run_logs");
  });

  it("public legal suite passes with no DB calls", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, null, { runType: "scheduled" });
    const legal = r.suites.find((s) => s.suite === "public_legal")!;
    expect(legal.status).toBe("pass");
  });

  it("rollupSuite handles mixed/empty cases", () => {
    expect(__test.rollupSuite([])).toBe("skipped");
    expect(__test.rollupSuite([__test.pass("a", "A"), __test.skip("b", "B")])).toBe("pass");
    expect(__test.rollupSuite([__test.fail("a", "A", "x")])).toBe("fail");
    expect(__test.rollupSuite([__test.pass("a", "A"), __test.fail("b", "B", "x")])).toBe("partial");
  });

  it("writes a run log row with status + cleanup_status", async () => {
    const { supabase, tables } = makeFake();
    const r = await performQaAutopilot(supabase, null, { runType: "scheduled" });
    expect(tables.qa_autopilot_run_logs.length).toBe(1);
    const log = tables.qa_autopilot_run_logs[0];
    expect(log.status).toBe(r.status);
    expect(log.cleanup_status).toBe(r.cleanupStatus);
  });

  it("scheduled run without actor returns partial and marks actorMissing", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, null, {
      runType: "scheduled",
      triggerSource: "pg_cron",
      actorMissing: true,
      resendMode: "weekly_only",
      isWeekly: false,
    });
    expect(r.actorMissing).toBe(true);
    expect(r.status).toBe("partial");
    expect(r.includedSuites.length).toBeGreaterThan(0);
    expect(r.skippedSuites).toContain("no_user_context");
  });

  it("scheduled run with actor runs core suites via actorUserId", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, null, {
      runType: "scheduled",
      triggerSource: "pg_cron",
      actorUserId: "actor-1",
      resendMode: "weekly_only",
      isWeekly: false,
    });
    const names = r.suites.map((s) => s.suite);
    expect(names).toContain("attendance");
    expect(names).toContain("task_system");
    expect(names).toContain("missed_task");
    expect(names).toContain("discipline_automation");
    expect(r.actorUserId).toBe("actor-1");
  });

  it("daily scheduled run skips Resend smoke by default (weekly_only)", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, "admin-1", {
      runType: "scheduled",
      isWeekly: false,
      resendMode: "weekly_only",
    });
    expect(r.resendIncluded).toBe(false);
    expect(r.resendSkipReason).toMatch(/daily/i);
    const smoke = r.suites.find((s) => s.suite === "resend_smoke")!;
    expect(smoke.status).toBe("skipped");
  });

  it("weekly scheduled run includes Resend smoke when mode is weekly_only", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, "admin-1", {
      runType: "scheduled",
      isWeekly: true,
      resendMode: "weekly_only",
    });
    // resendIncluded is true when the gate allows it; smoke itself may skip
    // for missing provider env, but the gate must let it through.
    expect(r.resendSkipReason).toBe(null);
    expect(r.resendIncluded).toBe(true);
  });

  it("resend mode 'off' always skips Resend smoke", async () => {
    const { supabase } = makeFake();
    const r = await performQaAutopilot(supabase, "admin-1", {
      runType: "scheduled",
      isWeekly: true,
      resendMode: "off",
    });
    expect(r.resendIncluded).toBe(false);
    expect(r.resendSkipReason).toMatch(/disabled/i);
  });

  it("recipient lock constant is delivered@resend.dev", async () => {
    const mod = await import("@/lib/delegation/missedEmailSmokeTest.functions");
    expect(mod.SMOKE_TEST_RECIPIENT).toBe("delivered@resend.dev");
  });

  it("run log row includes actor/schedule metadata in report_json", async () => {
    const { supabase, tables } = makeFake();
    await performQaAutopilot(supabase, null, {
      runType: "scheduled",
      triggerSource: "pg_cron_weekly",
      actorUserId: "actor-7",
      isWeekly: true,
      resendMode: "weekly_only",
    });
    const log = tables.qa_autopilot_run_logs[0];
    expect(log.report_json.actorUserId).toBe("actor-7");
    expect(log.report_json.isWeekly).toBe(true);
    expect(log.report_json.resendMode).toBe("weekly_only");
    expect(log.trigger_source).toBe("pg_cron_weekly");
  });

  it("resolveResendSkipReason matrix", () => {
    expect(__test.resolveResendSkipReason("off", true, true)).toMatch(/disabled/);
    expect(__test.resolveResendSkipReason("weekly_only", false, true)).toMatch(/daily/);
    expect(__test.resolveResendSkipReason("weekly_only", true, true)).toBe(null);
    expect(__test.resolveResendSkipReason("every_run", false, true)).toBe(null);
    expect(__test.resolveResendSkipReason("every_run", false, false)).toMatch(/no user/);
  });
});


describe("qa-autopilot scheduled endpoint", () => {
  it("rejects requests without apikey header", async () => {
    const mod = await import("@/routes/api/public/hooks/qa-autopilot");
    const handler = (mod.Route as any).options.server.handlers.POST;
    const res = await handler({ request: new Request("http://x/api/public/hooks/qa-autopilot", { method: "POST" }) });
    expect(res.status).toBe(401);
  });

  it("rejects when apikey does not match expected", async () => {
    process.env.SUPABASE_ANON_KEY = "expected";
    const mod = await import("@/routes/api/public/hooks/qa-autopilot");
    const handler = (mod.Route as any).options.server.handlers.POST;
    const res = await handler({
      request: new Request("http://x/api/public/hooks/qa-autopilot", {
        method: "POST",
        headers: { apikey: "wrong" },
      }),
    });
    expect(res.status).toBe(401);
    delete process.env.SUPABASE_ANON_KEY;
  });
});
