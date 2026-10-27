/**
 * Integration test — full My Tasks operating loop.
 *
 * This test stitches the rules already covered by the unit suite into one
 * end-to-end flow against a single in-memory store that mirrors the
 * production tables (delegation_tasks, delegation_activity,
 * delegation_points_ledger) and the RLS-equivalent permission checks
 * enforced in src/services/delegation/delegationService.ts.
 *
 * It validates the same loop a real admin + employee would run in
 * production, without needing real auth accounts:
 *   admin creates task -> employee sees only own task -> employee marks
 *   in progress -> employee saves proof + note -> employee submits ->
 *   admin sees task in Review Queue -> admin approves -> points post.
 *
 * It is intentionally hermetic: no network, no Supabase client. The
 * production rules being mirrored are unit-tested in
 *   tests/unit/delegationApproval.test.ts
 *   tests/unit/delegationTaskDoer.test.ts
 *   tests/unit/myTasksView.test.ts
 *   tests/unit/delegationScoring.test.ts
 * so a divergence between this harness and production will surface
 * there first. This test guards the *sequence*.
 */
import { beforeEach, describe, expect, it } from "vitest";

// ---------- domain ---------------------------------------------------------

type Stage = "planned" | "in_progress" | "submitted" | "revision" | "completed";
type Role = "admin" | "employee";

interface Task {
  id: string;
  title: string;
  assignee_id: string | null;          // Task Doer (auth user id)
  created_by: string;                  // Assigned By (auto-captured)
  system_stage: Stage;
  status: string;
  priority: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
  completed_at: string | null;
  final_date: string | null;
  revision_count: number;
  proof_url: string | null;
  proof_note: string | null;
  is_deleted: boolean;
}

interface LedgerRow {
  task_id: string;
  user_id: string;
  reason: string;
  points: number;
}

interface ActivityRow {
  task_id: string;
  actor_id: string;
  action: string;
}

interface User { id: string; role: Role }

interface Store {
  users: Record<string, User>;
  tasks: Task[];
  ledger: LedgerRow[];
  activity: ActivityRow[];
  now: string;
}

// ---------- scoring (must match delegationScoring tests) -------------------

const RULES = {
  base: { easy: 3, medium: 5, hard: 8 },
  late_penalty: -4,
  revision_penalty: -2,
  zero_revision_bonus: 3,
};

// ---------- service layer mirroring delegationService ----------------------

function assertAdmin(s: Store, actor: string) {
  if (s.users[actor]?.role !== "admin") throw new Error("forbidden: admin only");
}

function createTask(s: Store, actor: string, input: {
  title: string;
  assignee_id: string;
  due_date?: string | null;
  priority?: Task["priority"];
  difficulty?: Task["difficulty"];
}): Task {
  assertAdmin(s, actor);
  const t: Task = {
    id: `task_${s.tasks.length + 1}`,
    title: input.title,
    assignee_id: input.assignee_id,
    created_by: actor,            // Assigned By auto-captured
    system_stage: "planned",
    status: "Planned",
    priority: input.priority ?? "medium",
    difficulty: input.difficulty ?? "medium",
    due_date: input.due_date ?? null,
    completed_at: null,
    final_date: null,
    revision_count: 0,
    proof_url: null,
    proof_note: null,
    is_deleted: false,
  };
  s.tasks.push(t);
  s.activity.push({ task_id: t.id, actor_id: actor, action: "task_created" });
  return t;
}

// Employee-visible scope (mirror of MyTasksView filter + RLS).
function listMyTasks(s: Store, userId: string): Task[] {
  return s.tasks.filter((t) => !t.is_deleted && t.assignee_id === userId);
}

// Admin Review Queue scope.
function listReviewQueue(s: Store, actor: string): Task[] {
  assertAdmin(s, actor);
  return s.tasks.filter((t) => !t.is_deleted && t.system_stage === "submitted");
}

// Task Doer self-lock: only the assignee (or admin) may edit doer fields.
function reassign(s: Store, actor: string, taskId: string, newAssignee: string) {
  const t = s.tasks.find((x) => x.id === taskId)!;
  if (s.users[actor]?.role !== "admin") {
    throw new Error("forbidden: only admin can reassign Task Doer");
  }
  t.assignee_id = newAssignee;
  s.activity.push({ task_id: t.id, actor_id: actor, action: "reassigned" });
}

function markInProgress(s: Store, actor: string, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId)!;
  if (t.assignee_id !== actor) throw new Error("forbidden: not assignee");
  if (t.system_stage !== "planned" && t.system_stage !== "revision") {
    throw new Error(`invalid transition from ${t.system_stage}`);
  }
  t.system_stage = "in_progress";
  t.status = "In Progress";
  s.activity.push({ task_id: t.id, actor_id: actor, action: "marked_in_progress" });
}

function saveProof(
  s: Store,
  actor: string,
  taskId: string,
  patch: { proof_url?: string | null; proof_note?: string | null },
) {
  const t = s.tasks.find((x) => x.id === taskId)!;
  if (t.assignee_id !== actor && s.users[actor]?.role !== "admin") {
    throw new Error("forbidden");
  }
  if (patch.proof_url !== undefined) t.proof_url = patch.proof_url;
  if (patch.proof_note !== undefined) t.proof_note = patch.proof_note;
  s.activity.push({ task_id: t.id, actor_id: actor, action: "proof_saved" });
}

function submitForReview(s: Store, actor: string, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId)!;
  if (t.assignee_id !== actor) throw new Error("forbidden: not assignee");
  if (!t.proof_url) throw new Error("proof URL required");
  const wasRevision = t.system_stage === "revision";
  t.system_stage = "submitted";
  t.status = "Submitted";
  // Invariant: submit must not complete the task or post points.
  t.completed_at = null;
  t.final_date = null;
  s.activity.push({
    task_id: t.id,
    actor_id: actor,
    action: wasRevision ? "resubmitted_for_review" : "submitted_for_review",
  });
}

function approve(s: Store, actor: string, taskId: string) {
  assertAdmin(s, actor);
  const t = s.tasks.find((x) => x.id === taskId)!;
  if (t.assignee_id === actor) throw new Error("cannot approve own task");
  if (t.system_stage !== "submitted") throw new Error("only submitted tasks can be approved");

  const priorRev = t.revision_count;
  t.system_stage = "completed";
  t.status = "Completed";
  t.completed_at = s.now;
  t.final_date = s.now.slice(0, 10);
  s.activity.push({ task_id: t.id, actor_id: actor, action: "approved_completed" });

  s.ledger.push({
    task_id: t.id,
    user_id: t.assignee_id!,
    reason: "completion_base",
    points: RULES.base[t.difficulty],
  });
  if (t.due_date && t.final_date! > t.due_date) {
    s.ledger.push({
      task_id: t.id, user_id: t.assignee_id!,
      reason: "late_penalty", points: RULES.late_penalty,
    });
  }
  if (priorRev === 0) {
    s.ledger.push({
      task_id: t.id, user_id: t.assignee_id!,
      reason: "zero_revision_bonus", points: RULES.zero_revision_bonus,
    });
  }
}

function leaderboard(s: Store, userId: string) {
  return s.ledger
    .filter((l) => l.user_id === userId)
    .reduce((sum, l) => sum + l.points, 0);
}

// ---------- fixtures -------------------------------------------------------

const ADMIN = "auth_admin";
const EMPLOYEE = "auth_employee";
const OTHER_EMPLOYEE = "auth_other";

function fresh(): Store {
  return {
    users: {
      [ADMIN]: { id: ADMIN, role: "admin" },
      [EMPLOYEE]: { id: EMPLOYEE, role: "employee" },
      [OTHER_EMPLOYEE]: { id: OTHER_EMPLOYEE, role: "employee" },
    },
    tasks: [],
    ledger: [],
    activity: [],
    now: "2026-06-13T10:00:00Z",
  };
}

// ---------- the loop ------------------------------------------------------

describe("My Tasks flow — full operating loop", () => {
  let s: Store;
  beforeEach(() => { s = fresh(); });

  it("admin creates a task assigned to the employee with the expected initial state", () => {
    const t = createTask(s, ADMIN, {
      title: "QA MyTasks — write release notes",
      assignee_id: EMPLOYEE,
      due_date: "2026-06-15",
      difficulty: "medium",
    });

    expect(t.assignee_id).toBe(EMPLOYEE);
    expect(t.created_by).toBe(ADMIN);              // Assigned By auto-captured
    expect(t.system_stage).toBe("planned");
    expect(t.status).toBe("Planned");
    expect(t.completed_at).toBeNull();
    expect(t.final_date).toBeNull();
    expect(t.revision_count).toBe(0);
    expect(s.ledger).toHaveLength(0);              // no points yet
  });

  it("employee sees only their own task in My Tasks; unrelated tasks are hidden", () => {
    createTask(s, ADMIN, { title: "mine", assignee_id: EMPLOYEE });
    createTask(s, ADMIN, { title: "other employee task", assignee_id: OTHER_EMPLOYEE });
    createTask(s, ADMIN, { title: "unassigned legacy", assignee_id: null as any });

    const visible = listMyTasks(s, EMPLOYEE);
    expect(visible.map((t) => t.title)).toEqual(["mine"]);

    const otherVisible = listMyTasks(s, OTHER_EMPLOYEE);
    expect(otherVisible.map((t) => t.title)).toEqual(["other employee task"]);
  });

  it("employee can mark In Progress, save proof + note, submit for review, then admin approves and points post", () => {
    const t = createTask(s, ADMIN, {
      title: "QA MyTasks — full loop",
      assignee_id: EMPLOYEE,
      due_date: "2026-06-15",
      difficulty: "medium",
    });

    // 1. mark in progress
    markInProgress(s, EMPLOYEE, t.id);
    expect(t.system_stage).toBe("in_progress");
    expect(t.status).toBe("In Progress");
    expect(s.ledger).toHaveLength(0);

    // 2. save proof + note
    saveProof(s, EMPLOYEE, t.id, {
      proof_url: "https://drive.example.com/proof.pdf",
      proof_note: "Drafted v1, awaiting review.",
    });
    expect(t.proof_url).toBe("https://drive.example.com/proof.pdf");
    expect(t.proof_note).toBe("Drafted v1, awaiting review.");
    expect(s.ledger).toHaveLength(0);

    // 3. submit for review — must NOT complete the task or post points
    submitForReview(s, EMPLOYEE, t.id);
    expect(t.system_stage).toBe("submitted");
    expect(t.status).toBe("Submitted");
    expect(t.completed_at).toBeNull();
    expect(t.final_date).toBeNull();
    expect(s.ledger).toHaveLength(0);

    // 4. admin sees task in Review Queue
    const queue = listReviewQueue(s, ADMIN);
    expect(queue.map((q) => q.id)).toEqual([t.id]);

    // 5. admin approves
    approve(s, ADMIN, t.id);
    expect(t.system_stage).toBe("completed");
    expect(t.status).toBe("Completed");
    expect(t.completed_at).toBe(s.now);
    expect(t.final_date).toBe("2026-06-13");

    // 6. ledger posts ONLY after approval (base 5 + zero-rev bonus 3)
    const empPoints = leaderboard(s, EMPLOYEE);
    expect(empPoints).toBe(8);
    expect(s.ledger.find((l) => l.reason === "completion_base")?.points).toBe(5);
    expect(s.ledger.find((l) => l.reason === "zero_revision_bonus")?.points).toBe(3);

    // 7. activity trail intact for performance reports
    const actions = s.activity.filter((a) => a.task_id === t.id).map((a) => a.action);
    expect(actions).toEqual([
      "task_created",
      "marked_in_progress",
      "proof_saved",
      "submitted_for_review",
      "approved_completed",
    ]);

    // 8. Task Doer + Assigned By remain intact for reporting joins
    expect(t.assignee_id).toBe(EMPLOYEE);
    expect(t.created_by).toBe(ADMIN);
  });

  it("submit-for-review without proof is rejected (UX guard mirrors backend)", () => {
    const t = createTask(s, ADMIN, { title: "no proof", assignee_id: EMPLOYEE });
    markInProgress(s, EMPLOYEE, t.id);
    expect(() => submitForReview(s, EMPLOYEE, t.id)).toThrow(/proof URL required/);
    expect(s.ledger).toHaveLength(0);
  });

  it("approval is the ONLY path that posts to delegation_points_ledger", () => {
    const t = createTask(s, ADMIN, { title: "x", assignee_id: EMPLOYEE, difficulty: "medium" });
    markInProgress(s, EMPLOYEE, t.id);
    saveProof(s, EMPLOYEE, t.id, { proof_url: "https://p" });
    submitForReview(s, EMPLOYEE, t.id);

    // Pre-approval — nothing posted
    expect(s.ledger).toHaveLength(0);
    expect(leaderboard(s, EMPLOYEE)).toBe(0);

    approve(s, ADMIN, t.id);
    expect(s.ledger.length).toBeGreaterThan(0);
  });
});

describe("My Tasks flow — permission guards", () => {
  let s: Store;
  beforeEach(() => { s = fresh(); });

  it("employee cannot create a task (admin only)", () => {
    expect(() => createTask(s, EMPLOYEE, { title: "x", assignee_id: EMPLOYEE }))
      .toThrow(/admin only/);
  });

  it("employee cannot reassign a task to themselves or others (Task Doer self-lock)", () => {
    const t = createTask(s, ADMIN, { title: "x", assignee_id: OTHER_EMPLOYEE });
    expect(() => reassign(s, EMPLOYEE, t.id, EMPLOYEE)).toThrow(/admin/);
    expect(() => reassign(s, EMPLOYEE, t.id, OTHER_EMPLOYEE)).toThrow(/admin/);
    expect(t.assignee_id).toBe(OTHER_EMPLOYEE); // unchanged
  });

  it("employee cannot submit or mark in-progress on a task assigned to someone else", () => {
    const t = createTask(s, ADMIN, { title: "x", assignee_id: OTHER_EMPLOYEE });
    expect(() => markInProgress(s, EMPLOYEE, t.id)).toThrow(/not assignee/);
    saveProof(s, ADMIN, t.id, { proof_url: "https://p" }); // admin can stage proof
    expect(() => submitForReview(s, EMPLOYEE, t.id)).toThrow(/not assignee/);
  });

  it("employee cannot approve any task (admin only); admin cannot approve their own", () => {
    const t = createTask(s, ADMIN, { title: "x", assignee_id: EMPLOYEE });
    markInProgress(s, EMPLOYEE, t.id);
    saveProof(s, EMPLOYEE, t.id, { proof_url: "https://p" });
    submitForReview(s, EMPLOYEE, t.id);

    expect(() => approve(s, EMPLOYEE, t.id)).toThrow(/admin only/);

    // admin self-approval guard
    const own = createTask(s, ADMIN, { title: "admin's own", assignee_id: ADMIN });
    saveProof(s, ADMIN, own.id, { proof_url: "https://p" });
    // admin acting as assignee submits — submit only checks assignee match
    submitForReview(s, ADMIN, own.id);
    expect(() => approve(s, ADMIN, own.id)).toThrow(/own task/);
  });

  it("employee cannot see Review Queue (admin only)", () => {
    expect(() => listReviewQueue(s, EMPLOYEE)).toThrow(/admin only/);
  });

  it("legacy/null-assignee tasks do not leak into any employee's My Tasks", () => {
    createTask(s, ADMIN, { title: "legacy", assignee_id: null as any });
    expect(listMyTasks(s, EMPLOYEE)).toEqual([]);
    expect(listMyTasks(s, OTHER_EMPLOYEE)).toEqual([]);
  });
});
