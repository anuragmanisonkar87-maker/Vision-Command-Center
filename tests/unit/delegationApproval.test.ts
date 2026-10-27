/**
 * Unit tests for the Delegation approval workflow state machine.
 * Mirrors the rules in delegationService so we can verify timing of
 * stage transitions, point awards, and due-date request decisions
 * without hitting the database.
 */
import { describe, it, expect } from "vitest";

type Stage = "planned" | "submitted" | "completed" | "revision";
type Role = "employee" | "admin";

interface Task {
  id: string;
  assignee_id: string;
  system_stage: Stage;
  status: string;
  completed_at: string | null;
  final_date: string | null;
  revision_count: number;
  due_date: string | null;
  proof_url: string | null;
  proof_note: string | null;
}

interface Ledger { task_id: string; user_id: string; reason: string; points: number; }
interface Activity { task_id: string; action: string; actor_id: string; }
interface DDR { id: string; task_id: string; status: "pending" | "approved" | "rejected"; requested_due_date: string; }

interface Ctx {
  tasks: Task[];
  ledger: Ledger[];
  activity: Activity[];
  ddr: DDR[];
}

const RULES = { base_medium: 5, late_penalty: -4, revision_penalty: -2, zero_revision_bonus: 3 };

function submit(c: Ctx, taskId: string, actor: string, role: Role, proof: string) {
  const t = c.tasks.find((x) => x.id === taskId)!;
  if (role === "employee" && t.assignee_id !== actor) throw new Error("forbidden");
  const wasRevision = t.system_stage === "revision";
  t.system_stage = "submitted";
  t.status = "Submitted";
  t.proof_url = proof;
  c.activity.push({ task_id: taskId, actor_id: actor, action: wasRevision ? "resubmitted_for_review" : "submitted_for_review" });
}

function approve(c: Ctx, taskId: string, actor: string, role: Role) {
  const t = c.tasks.find((x) => x.id === taskId)!;
  if (role !== "admin") throw new Error("only admin can approve");
  if (t.assignee_id === actor) throw new Error("cannot approve own task");
  const completedAt = "2026-06-12T10:00:00Z";
  const priorRev = t.revision_count;
  t.system_stage = "completed";
  t.status = "Completed";
  t.completed_at = completedAt;
  t.final_date = completedAt.slice(0, 10);
  c.activity.push({ task_id: taskId, actor_id: actor, action: "approved_completed" });
  c.ledger.push({ task_id: taskId, user_id: t.assignee_id, reason: "completion_base", points: RULES.base_medium });
  if (t.due_date && completedAt.slice(0, 10) > t.due_date) {
    c.ledger.push({ task_id: taskId, user_id: t.assignee_id, reason: "late_penalty", points: RULES.late_penalty });
  }
  if (priorRev === 0) {
    c.ledger.push({ task_id: taskId, user_id: t.assignee_id, reason: "zero_revision_bonus", points: RULES.zero_revision_bonus });
  }
}

function revision(c: Ctx, taskId: string, actor: string, role: Role, note: string) {
  if (role !== "admin") throw new Error("only admin");
  if (!note.trim()) throw new Error("note required");
  const t = c.tasks.find((x) => x.id === taskId)!;
  t.revision_count += 1;
  t.system_stage = "revision";
  t.status = "Revision Required";
  c.activity.push({ task_id: taskId, actor_id: actor, action: "revision_requested" });
  c.ledger.push({ task_id: taskId, user_id: t.assignee_id, reason: `revision_penalty_${t.revision_count}`, points: RULES.revision_penalty });
}

function requestDate(c: Ctx, taskId: string, actor: string, role: Role, newDate: string) {
  const t = c.tasks.find((x) => x.id === taskId)!;
  if (role !== "employee" || t.assignee_id !== actor) throw new Error("only assignee");
  const r: DDR = { id: `r${c.ddr.length + 1}`, task_id: taskId, status: "pending", requested_due_date: newDate };
  c.ddr.push(r);
  c.activity.push({ task_id: taskId, actor_id: actor, action: "due_date_change_requested" });
  return r;
}

function decideDate(c: Ctx, reqId: string, actor: string, role: Role, decision: "approve" | "reject") {
  if (role !== "admin") throw new Error("only admin");
  const r = c.ddr.find((x) => x.id === reqId)!;
  r.status = decision === "approve" ? "approved" : "rejected";
  const t = c.tasks.find((x) => x.id === r.task_id)!;
  if (decision === "approve") t.due_date = r.requested_due_date;
  c.activity.push({ task_id: r.task_id, actor_id: actor, action: decision === "approve" ? "due_date_change_approved" : "due_date_change_rejected" });
}

function leaderboardPoints(c: Ctx, userId: string) {
  return c.ledger.filter((l) => l.user_id === userId).reduce((a, l) => a + l.points, 0);
}

function mkCtx(): Ctx {
  return {
    tasks: [{
      id: "t1", assignee_id: "emp", system_stage: "planned", status: "Planned",
      completed_at: null, final_date: null, revision_count: 0,
      due_date: "2026-06-15", proof_url: null, proof_note: null,
    }],
    ledger: [], activity: [], ddr: [],
  };
}

describe("delegation approval workflow", () => {
  it("employee completion becomes Submitted, no points yet", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "https://proof.example");
    expect(c.tasks[0].system_stage).toBe("submitted");
    expect(c.tasks[0].completed_at).toBeNull();
    expect(c.tasks[0].final_date).toBeNull();
    expect(c.ledger.filter((l) => l.reason === "completion_base")).toHaveLength(0);
    expect(c.activity.at(-1)?.action).toBe("submitted_for_review");
    expect(leaderboardPoints(c, "emp")).toBe(0);
  });

  it("employee cannot approve own task", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    expect(() => approve(c, "t1", "emp", "admin")).toThrow(/own task/);
  });

  it("admin approval sets completed_at, final_date, and awards points", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    approve(c, "t1", "admin", "admin");
    expect(c.tasks[0].system_stage).toBe("completed");
    expect(c.tasks[0].completed_at).not.toBeNull();
    expect(c.tasks[0].final_date).not.toBeNull();
    expect(c.ledger.find((l) => l.reason === "completion_base")?.points).toBe(5);
    expect(c.ledger.find((l) => l.reason === "zero_revision_bonus")?.points).toBe(3);
    expect(c.activity.map((a) => a.action)).toContain("approved_completed");
    expect(leaderboardPoints(c, "emp")).toBe(8);
  });

  it("revision increments count, applies penalty, requires note", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    expect(() => revision(c, "t1", "admin", "admin", "")).toThrow(/note required/);
    revision(c, "t1", "admin", "admin", "needs fixes");
    expect(c.tasks[0].revision_count).toBe(1);
    expect(c.tasks[0].system_stage).toBe("revision");
    expect(c.ledger.find((l) => l.reason === "revision_penalty_1")?.points).toBe(-2);
    expect(c.activity.at(-1)?.action).toBe("revision_requested");
  });

  it("employee can resubmit after revision", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    revision(c, "t1", "admin", "admin", "fix");
    submit(c, "t1", "emp", "employee", "u2");
    expect(c.tasks[0].system_stage).toBe("submitted");
    expect(c.activity.at(-1)?.action).toBe("resubmitted_for_review");
  });

  it("approval after a revision skips zero-revision bonus", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    revision(c, "t1", "admin", "admin", "fix");
    submit(c, "t1", "emp", "employee", "u2");
    approve(c, "t1", "admin", "admin");
    expect(c.ledger.find((l) => l.reason === "zero_revision_bonus")).toBeUndefined();
    // base + revision penalty = 5 - 2 = 3
    expect(leaderboardPoints(c, "emp")).toBe(3);
  });

  it("employee can request a due-date change; admin can approve or reject", () => {
    const c = mkCtx();
    const r = requestDate(c, "t1", "emp", "employee", "2026-06-20");
    expect(r.status).toBe("pending");
    expect(c.activity.at(-1)?.action).toBe("due_date_change_requested");
    decideDate(c, r.id, "admin", "admin", "approve");
    expect(c.ddr[0].status).toBe("approved");
    expect(c.tasks[0].due_date).toBe("2026-06-20");
    expect(c.activity.at(-1)?.action).toBe("due_date_change_approved");

    const r2 = requestDate(c, "t1", "emp", "employee", "2026-06-25");
    decideDate(c, r2.id, "admin", "admin", "reject");
    expect(c.ddr[1].status).toBe("rejected");
    expect(c.tasks[0].due_date).toBe("2026-06-20"); // unchanged
    expect(c.activity.at(-1)?.action).toBe("due_date_change_rejected");
  });

  it("employee cannot decide due-date requests", () => {
    const c = mkCtx();
    const r = requestDate(c, "t1", "emp", "employee", "2026-06-20");
    expect(() => decideDate(c, r.id, "emp", "employee", "approve")).toThrow(/only admin/);
  });

  it("leaderboard total reflects only approved completions", () => {
    const c = mkCtx();
    submit(c, "t1", "emp", "employee", "u");
    // Before approval — no points
    expect(leaderboardPoints(c, "emp")).toBe(0);
    approve(c, "t1", "admin", "admin");
    expect(leaderboardPoints(c, "emp")).toBe(8);
  });
});
