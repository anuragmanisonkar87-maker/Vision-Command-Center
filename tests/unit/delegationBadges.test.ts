/**
 * Unit tests for the Delegation badge engine + monthly winners.
 */
import { describe, it, expect } from "vitest";
import {
  computeUserBadges,
  computeMonthlyWinners,
  DEFAULT_REWARD_SETTINGS,
  monthStart,
} from "@/services/delegation/badgeService";

const mkTask = (
  partial: Partial<{ assignee_id: string; completed_at: string; due_date: string | null; revision_count: number; proof_url: string | null }> = {},
) => ({
  assignee_id: "u1",
  completed_at: "2026-06-10T08:00:00Z",
  due_date: "2026-06-10" as string | null,
  revision_count: 0,
  proof_url: "https://x" as string | null,
  ...partial,
});

describe("badge engine", () => {
  it("on-time machine triggers at 90%+ on-time and min approved met", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      mkTask({ completed_at: `2026-06-${10 + i}T08:00:00Z`, due_date: `2026-06-${10 + i}` }),
    );
    const badges = computeUserBadges(tasks);
    const otm = badges.find((b) => b.key === "on_time_machine")!;
    expect(otm.earned).toBe(true);
    expect(otm.value).toBe(100);
  });

  it("on-time machine NOT earned when below 90%", () => {
    const ok = Array.from({ length: 5 }, () => mkTask({ due_date: "2026-06-10", completed_at: "2026-06-10T00:00:00Z" }));
    const late = Array.from({ length: 5 }, () => mkTask({ due_date: "2026-06-10", completed_at: "2026-06-15T00:00:00Z" }));
    const badges = computeUserBadges([...ok, ...late]);
    expect(badges.find((b) => b.key === "on_time_machine")!.earned).toBe(false);
  });

  it("zero revision pro counts only tasks with 0 revisions", () => {
    const tasks = [
      ...Array.from({ length: 5 }, () => mkTask({ revision_count: 0 })),
      ...Array.from({ length: 3 }, () => mkTask({ revision_count: 2 })),
    ];
    const b = computeUserBadges(tasks).find((x) => x.key === "zero_revision_pro")!;
    expect(b.value).toBe(5);
    expect(b.earned).toBe(true);
  });

  it("deadline warrior requires min approved count", () => {
    expect(computeUserBadges([mkTask({})]).find((b) => b.key === "deadline_warrior")!.earned).toBe(false);
    const many = Array.from({ length: 12 }, () => mkTask({}));
    expect(computeUserBadges(many).find((b) => b.key === "deadline_warrior")!.earned).toBe(true);
  });

  it("most consistent uses distinct completion days", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      mkTask({ completed_at: `2026-06-${10 + i}T08:00:00Z` }),
    );
    const b = computeUserBadges(tasks).find((x) => x.key === "most_consistent")!;
    expect(b.value).toBe(8);
    expect(b.earned).toBe(true);
  });

  it("disabled badges never earn", () => {
    const settings = {
      ...DEFAULT_REWARD_SETTINGS,
      enabled: { ...DEFAULT_REWARD_SETTINGS.enabled, deadline_warrior: false },
    };
    const tasks = Array.from({ length: 20 }, () => mkTask({}));
    expect(computeUserBadges(tasks, settings).find((b) => b.key === "deadline_warrior")!.earned).toBe(false);
  });

  it("proof champion needs >=80% proof", () => {
    const withProof = Array.from({ length: 8 }, () => mkTask({ proof_url: "https://x" }));
    const without = Array.from({ length: 2 }, () => mkTask({ proof_url: null }));
    expect(computeUserBadges([...withProof, ...without]).find((b) => b.key === "proof_champion")!.earned).toBe(true);

    const mostNo = Array.from({ length: 8 }, () => mkTask({ proof_url: null }));
    expect(computeUserBadges([...withProof, ...mostNo]).find((b) => b.key === "proof_champion")!.earned).toBe(false);
  });
});

describe("monthly winners", () => {
  it("picks top points from ledger", () => {
    const ledger = [
      { user_id: "u1", points: 10 },
      { user_id: "u2", points: 25 },
      { user_id: "u3", points: 5 },
    ];
    const winners = computeMonthlyWinners([], ledger);
    expect(winners.find((w) => w.award_type === "top_points")!.user_id).toBe("u2");
    expect(winners.find((w) => w.award_type === "top_points")!.value).toBe(25);
  });

  it("on-time champion counts on-time approved completions", () => {
    const tasks = [
      mkTask({ assignee_id: "u1", due_date: "2026-06-10", completed_at: "2026-06-10T00:00:00Z" }),
      mkTask({ assignee_id: "u1", due_date: "2026-06-10", completed_at: "2026-06-10T00:00:00Z" }),
      mkTask({ assignee_id: "u2", due_date: "2026-06-10", completed_at: "2026-06-20T00:00:00Z" }),
    ];
    const winners = computeMonthlyWinners(tasks as any, []);
    expect(winners.find((w) => w.award_type === "on_time_champion")!.user_id).toBe("u1");
  });

  it("returns null winners when no data", () => {
    const winners = computeMonthlyWinners([], []);
    expect(winners.every((w) => w.user_id === null)).toBe(true);
  });

  it("most_tasks picks user with most approved completions", () => {
    const tasks = [
      mkTask({ assignee_id: "u1" }),
      mkTask({ assignee_id: "u2" }),
      mkTask({ assignee_id: "u2" }),
      mkTask({ assignee_id: "u2" }),
    ];
    expect(computeMonthlyWinners(tasks as any, []).find((w) => w.award_type === "most_tasks")!.user_id).toBe("u2");
  });

  it("monthStart returns first-of-month ISO date", () => {
    expect(monthStart(new Date("2026-06-15T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
