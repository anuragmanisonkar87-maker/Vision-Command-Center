// Phase 3F — unit tests for performDisciplineAutomation with a fake supabase.
import { describe, it, expect, beforeEach } from "vitest";
import { performDisciplineAutomation } from "@/lib/delegation/disciplineAutomation.functions";

type Row = Record<string, any>;

function makeFake(initial: { tasks?: Row[]; settings?: any } = {}) {
  const tables: Record<string, Row[]> = {
    delegation_tasks: initial.tasks ?? [],
    delegation_settings: [{ id: 1, settings: initial.settings ?? {} }],
    task_missed_points_ledger: [],
    task_missed_email_logs: [],
    discipline_automation_run_logs: [],
  };
  // Simulate unique(task_id, event_type) on penalty ledger
  const ledgerKey = (r: Row) => `${r.task_id}|${r.event_type}`;

  const api = (name: string) => {
    let filters: Array<(r: Row) => boolean> = [];
    let _select = "*";

    const exec = () => {
      const rows = tables[name] ?? [];
      return rows.filter((r) => filters.every((f) => f(r)));
    };

    const chain: any = {
      select(sel = "*") { _select = sel; return chain; },
      eq(col: string, val: any) { filters.push((r) => r[col] === val); return chain; },
      in(col: string, vals: any[]) { filters.push((r) => vals.includes(r[col])); return chain; },
      gte(col: string, val: any) { filters.push((r) => r[col] >= val); return chain; },
      lte(col: string, val: any) { filters.push((r) => r[col] <= val); return chain; },
      order() { return chain; },
      limit() { return chain; },
      maybeSingle: async () => ({ data: exec()[0] ?? null, error: null }),
      single: async () => {
        const r = exec()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: any) => resolve({ data: exec(), error: null }),
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
          select: (_sel?: string) => ({
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
        return { in: () => Promise.resolve({ data: matched, error: null }), eq: () => Promise.resolve({ data: matched, error: null }) };
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

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function pastTask(over: Partial<Row> = {}): Row {
  return {
    id: over.id ?? `t_${Math.random().toString(36).slice(2, 8)}`,
    title: "Past Task",
    task_type: "standup",
    due_date: yesterday,
    due_time: "09:00:00",
    system_stage: "planned",
    is_deleted: false,
    completed_at: null,
    assignee_id: "user-1",
    assignee_email: "delivered@resend.dev",
    assignee_name: "QA",
    assignee_team_member_id: null,
    ...over,
  };
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("performDisciplineAutomation", () => {
  it("pass with no missed tasks", async () => {
    const { supabase } = makeFake({ tasks: [pastTask({ due_date: tomorrow })] });
    const r = await performDisciplineAutomation(supabase, "admin", { runType: "manual" });
    expect(r.missedCount).toBe(0);
    expect(r.status).toBe("pass");
    expect(r.emailsSent).toBe(0);
  });

  it("respects defaults: no penalties, drafts ON, auto-send OFF", async () => {
    const { supabase, tables } = makeFake({ tasks: [pastTask()] });
    const r = await performDisciplineAutomation(supabase, "admin", { runType: "manual" });
    expect(r.missedCount).toBe(1);
    expect(r.penaltiesApplied).toBe(0); // default OFF
    expect(r.draftsCreated).toBe(1);   // default ON
    expect(r.emailsSent).toBe(0);      // default OFF
    expect(tables.task_missed_email_logs.length).toBe(1);
    expect(tables.task_missed_points_ledger.length).toBe(0);
  });

  it("applies penalties when enabled and dedupes on second run", async () => {
    const { supabase, tables } = makeFake({ tasks: [pastTask()] });
    const r1 = await performDisciplineAutomation(supabase, "admin", {
      runType: "manual",
      overrideSettings: { auto_apply_penalties: true, auto_create_drafts: false, auto_send_emails: false },
    });
    expect(r1.penaltiesApplied).toBe(1);
    const r2 = await performDisciplineAutomation(supabase, "admin", {
      runType: "manual",
      overrideSettings: { auto_apply_penalties: true, auto_create_drafts: false, auto_send_emails: false },
    });
    expect(r2.penaltiesSkipped).toBe(1);
    expect(tables.task_missed_points_ledger.length).toBe(1);
  });

  it("dedupes drafts on second run", async () => {
    const { supabase, tables } = makeFake({ tasks: [pastTask()] });
    await performDisciplineAutomation(supabase, "admin", { runType: "manual" });
    const r2 = await performDisciplineAutomation(supabase, "admin", { runType: "manual" });
    expect(r2.draftsSkipped).toBe(1);
    expect(tables.task_missed_email_logs.length).toBe(1);
  });

  it("auto-send ON but provider not configured: nothing sent", async () => {
    const { supabase } = makeFake({ tasks: [pastTask()] });
    const r = await performDisciplineAutomation(supabase, "admin", {
      runType: "manual",
      overrideSettings: { auto_send_emails: true, auto_create_drafts: true, auto_apply_penalties: false },
    });
    expect(r.providerConfigured).toBe(false);
    expect(r.emailsSent).toBe(0);
    expect(r.notes.some((n) => n.includes("provider"))).toBe(true);
  });

  it("writes a run log row", async () => {
    const { supabase, tables } = makeFake({ tasks: [pastTask()] });
    const r = await performDisciplineAutomation(supabase, "admin", { runType: "manual" });
    expect(r.logId).toBeTruthy();
    expect(tables.discipline_automation_run_logs.length).toBe(1);
    expect(tables.discipline_automation_run_logs[0].run_type).toBe("manual");
  });
});
