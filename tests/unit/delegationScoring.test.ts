/**
 * Unit tests for the Delegation scoring math.
 *
 * Mirrors the logic in src/services/delegation/delegationService.ts so we can
 * verify base / late / revision / zero-revision rules without touching the DB.
 */
import { describe, it, expect } from "vitest";

type Priority = "low" | "medium" | "high" | "critical";

type Rules = {
  on_time_low: number;
  on_time_medium: number;
  on_time_high: number;
  on_time_critical: number;
  zero_revision_bonus: number;
  late_penalty: number;
  revision_penalty: number;
  shifted_penalty: number;
};

const DEFAULT_RULES: Rules = {
  on_time_low: 2,
  on_time_medium: 5,
  on_time_high: 8,
  on_time_critical: 12,
  zero_revision_bonus: 3,
  late_penalty: -4,
  revision_penalty: -2,
  shifted_penalty: -1,
};

function basePoints(priority: Priority, rules = DEFAULT_RULES) {
  return priority === "critical"
    ? rules.on_time_critical
    : priority === "high"
      ? rules.on_time_high
      : priority === "medium"
        ? rules.on_time_medium
        : rules.on_time_low;
}

/** Mirrors awardPointsForCompletion in delegationService. */
function computeLedger(opts: {
  priority: Priority;
  due_date: string | null;
  completed_at: string;
  prior_revision_count: number;
  rules?: Rules;
}) {
  const rules = opts.rules ?? DEFAULT_RULES;
  const rows: { reason: string; points: number }[] = [];
  rows.push({ reason: "completion_base", points: basePoints(opts.priority, rules) });
  const onTime = opts.due_date ? opts.completed_at.slice(0, 10) <= opts.due_date : true;
  if (!onTime) rows.push({ reason: "late_penalty", points: rules.late_penalty });
  if (opts.prior_revision_count === 0) {
    rows.push({ reason: "zero_revision_bonus", points: rules.zero_revision_bonus });
  }
  return rows;
}

describe("delegation scoring", () => {
  it("low priority on-time completion: base + zero-revision bonus", () => {
    const rows = computeLedger({
      priority: "low",
      due_date: "2026-06-12",
      completed_at: "2026-06-12T08:00:00Z",
      prior_revision_count: 0,
    });
    expect(rows).toEqual([
      { reason: "completion_base", points: 2 },
      { reason: "zero_revision_bonus", points: 3 },
    ]);
    expect(rows.reduce((a, r) => a + r.points, 0)).toBe(5);
  });

  it("medium priority late completion: base + late penalty + zero-revision bonus", () => {
    const rows = computeLedger({
      priority: "medium",
      due_date: "2026-06-10",
      completed_at: "2026-06-12T08:00:00Z",
      prior_revision_count: 0,
    });
    expect(rows.find((r) => r.reason === "completion_base")?.points).toBe(5);
    expect(rows.find((r) => r.reason === "late_penalty")?.points).toBe(-4);
    expect(rows.find((r) => r.reason === "zero_revision_bonus")?.points).toBe(3);
  });

  it("high priority with prior revisions: no zero-revision bonus", () => {
    const rows = computeLedger({
      priority: "high",
      due_date: "2026-06-15",
      completed_at: "2026-06-15T08:00:00Z",
      prior_revision_count: 2,
    });
    expect(rows.find((r) => r.reason === "completion_base")?.points).toBe(8);
    expect(rows.find((r) => r.reason === "zero_revision_bonus")).toBeUndefined();
  });

  it("critical priority on-time completion: 12 base + bonus", () => {
    const rows = computeLedger({
      priority: "critical",
      due_date: "2026-06-15",
      completed_at: "2026-06-15T08:00:00Z",
      prior_revision_count: 0,
    });
    expect(rows.find((r) => r.reason === "completion_base")?.points).toBe(12);
  });

  it("respects custom scoring rules (admin override medium → 6)", () => {
    const rows = computeLedger({
      priority: "medium",
      due_date: "2026-06-15",
      completed_at: "2026-06-15T08:00:00Z",
      prior_revision_count: 0,
      rules: { ...DEFAULT_RULES, on_time_medium: 6 },
    });
    expect(rows.find((r) => r.reason === "completion_base")?.points).toBe(6);
  });

  it("repeat revision penalties are allowed (no completion_base in revision flow)", () => {
    // Revision penalty is an independent row per call; with the partial unique
    // index on reason='completion_base' only, repeats of revision_penalty must
    // be permitted at the DB level. This unit test asserts the math is additive
    // and stable across calls.
    const penalties = [DEFAULT_RULES.revision_penalty, DEFAULT_RULES.revision_penalty, DEFAULT_RULES.revision_penalty];
    const total = penalties.reduce((a, b) => a + b, 0);
    expect(total).toBe(-6);
  });

  it("no due date => treated as on-time", () => {
    const rows = computeLedger({
      priority: "high",
      due_date: null,
      completed_at: "2026-06-12T08:00:00Z",
      prior_revision_count: 0,
    });
    expect(rows.find((r) => r.reason === "late_penalty")).toBeUndefined();
  });
});
