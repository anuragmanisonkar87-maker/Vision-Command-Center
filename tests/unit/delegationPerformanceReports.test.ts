// Unit tests for the Delegation monthly performance report engine.
import { describe, it, expect } from "vitest";
import {
  computeSummary,
  computeScore,
  computeGrade,
  computeInsights,
  monthIso,
} from "@/services/delegation/performanceReportService";

const t = (p: Partial<{ due_date: string | null; completed_at: string | null; revision_count: number; proof_url: string | null }> = {}) => ({
  due_date: "2026-06-10",
  completed_at: "2026-06-10T08:00:00Z",
  revision_count: 0,
  proof_url: "https://x" as string | null,
  ...p,
});

describe("computeSummary", () => {
  it("aggregates approved tasks, on-time %, revisions, proof, due-date counts", () => {
    const approved = [
      t({}), t({}), t({ completed_at: "2026-06-15T00:00:00Z" }), // 1 late
      t({ revision_count: 2 }), t({ proof_url: null }),
    ];
    const s = computeSummary(approved, 3, [{ points: 10 }, { points: 5 }] as any, [
      { status: "approved" } as any,
      { status: "rejected" } as any,
      { status: "pending" } as any,
    ]);
    expect(s.approved_tasks).toBe(5);
    expect(s.submitted_tasks).toBe(3);
    expect(s.total_points).toBe(15);
    expect(s.late_tasks).toBe(1);
    expect(s.on_time_pct).toBe(80);
    expect(s.zero_revision_tasks).toBe(4);
    expect(s.total_revisions).toBe(2);
    expect(s.proof_submitted).toBe(4);
    expect(s.due_date_requests).toBe(3);
    expect(s.due_date_approved).toBe(1);
    expect(s.due_date_rejected).toBe(1);
  });

  it("returns zeros for empty data", () => {
    const s = computeSummary([], 0, [], []);
    expect(s.approved_tasks).toBe(0);
    expect(s.on_time_pct).toBe(0);
    expect(s.total_points).toBe(0);
  });
});

describe("computeScore + computeGrade", () => {
  it("returns 0 when no approved tasks", () => {
    const s = computeSummary([], 0, [], []);
    expect(computeScore(s)).toBe(0);
    expect(computeGrade(0)).toBe("Critical");
  });

  it("excellent for high-performing user", () => {
    const approved = Array.from({ length: 12 }, () => t({}));
    const s = computeSummary(approved, 0, [{ points: 120 }] as any, []);
    const score = computeScore(s);
    expect(score).toBeGreaterThanOrEqual(85);
    expect(computeGrade(score)).toBe("Excellent");
  });

  it("critical for high revisions + late tasks", () => {
    const approved = Array.from({ length: 6 }, () => t({ revision_count: 3, completed_at: "2026-06-20T00:00:00Z", proof_url: null }));
    const s = computeSummary(approved, 0, [{ points: 0 }] as any, []);
    const score = computeScore(s);
    expect(computeGrade(score)).toBe("Critical");
  });

  it("score never exceeds 100 or drops below 0", () => {
    const huge = Array.from({ length: 50 }, () => t({}));
    const s = computeSummary(huge, 0, [{ points: 1000 }] as any, []);
    expect(computeScore(s)).toBeLessThanOrEqual(100);
    expect(computeScore(s)).toBeGreaterThanOrEqual(0);
  });

  it("grade bands map correctly", () => {
    expect(computeGrade(100)).toBe("Excellent");
    expect(computeGrade(85)).toBe("Excellent");
    expect(computeGrade(70)).toBe("Good");
    expect(computeGrade(50)).toBe("Needs Attention");
    expect(computeGrade(49)).toBe("Critical");
  });
});

describe("computeInsights", () => {
  it("flags strong on-time + good proof + consistency", () => {
    const approved = Array.from({ length: 10 }, () => t({}));
    const s = computeSummary(approved, 0, [], []);
    const ins = computeInsights(s);
    expect(ins.some((i) => i.includes("Strong on-time"))).toBe(true);
    expect(ins.some((i) => i.includes("Good proof"))).toBe(true);
    expect(ins.some((i) => i.includes("Strong consistency"))).toBe(true);
  });

  it("flags low task count + high revisions", () => {
    const approved = [t({ revision_count: 5 })];
    const s = computeSummary(approved, 0, [], []);
    const ins = computeInsights(s);
    expect(ins.some((i) => i.includes("Low approved task count"))).toBe(true);
    expect(ins.some((i) => i.includes("High revision count"))).toBe(true);
  });

  it("flags frequent due-date requests", () => {
    const approved = Array.from({ length: 10 }, () => t({}));
    const requests = Array.from({ length: 6 }, () => ({ status: "pending" })) as any;
    const s = computeSummary(approved, 0, [], requests);
    const ins = computeInsights(s);
    expect(ins.some((i) => i.includes("Frequent due-date"))).toBe(true);
  });

  it("returns only low-count insight when no approved tasks", () => {
    const ins = computeInsights(computeSummary([], 0, [], []));
    expect(ins.length).toBe(1);
    expect(ins[0]).toContain("Low approved");
  });
});

describe("monthIso", () => {
  it("returns first-of-month ISO date", () => {
    expect(monthIso(new Date("2026-06-15T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
