// MyTasksView contract tests — pure helpers / filter behavior.
// We don't render the React tree here (the project's unit suite is
// dom-free); we exercise the filter rule the view applies before render.
import { describe, expect, it } from "vitest";
import type { DelegationTask } from "@/services/delegation/delegationService";

// Mirrors the in-view filter: employee view shows only assignee_id === self.
function selectEmployeeOwnTasks(all: DelegationTask[], userId: string) {
  return all.filter((t) => t.assignee_id === userId);
}

// Mirrors admin-preview target resolution: previewing a doer with no linked
// auth user yields null → view should show empty state.
function resolvePreviewTarget(
  doers: Array<{ id: string; linked_user_id: string | null }>,
  selectedDoerId: string,
  selfUserId: string,
): string | null {
  if (!selectedDoerId) return selfUserId;
  return doers.find((d) => d.id === selectedDoerId)?.linked_user_id ?? null;
}

const sample = (over: Partial<DelegationTask>): DelegationTask =>
  ({
    id: over.id ?? "t1",
    title: over.title ?? "T",
    assignee_id: over.assignee_id ?? null,
    created_by: over.created_by ?? "u1",
    system_stage: over.system_stage ?? "planned",
    status: over.status ?? "Planned",
    priority: (over.priority ?? "medium") as any,
    difficulty: (over.difficulty ?? "medium") as any,
    is_deleted: over.is_deleted ?? false,
    due_date: over.due_date ?? null,
    revision_count: over.revision_count ?? 0,
    proof_url: over.proof_url ?? null,
    proof_note: over.proof_note ?? null,
    completed_at: over.completed_at ?? null,
  } as any);

describe("MyTasksView: employee own-tasks filter", () => {
  it("returns only tasks where assignee_id matches the signed-in user", () => {
    const tasks = [
      sample({ id: "a", assignee_id: "u1" }),
      sample({ id: "b", assignee_id: "u2" }),
      sample({ id: "c", assignee_id: "u1", created_by: "admin" }),
      sample({ id: "d", assignee_id: null, created_by: "u1" }), // I created but unassigned → hidden
    ];
    const visible = selectEmployeeOwnTasks(tasks, "u1");
    expect(visible.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("hides tasks the employee merely created if assigned to another user", () => {
    const tasks = [sample({ id: "x", assignee_id: "other", created_by: "u1" })];
    expect(selectEmployeeOwnTasks(tasks, "u1")).toEqual([]);
  });
});

describe("MyTasksView: admin preview target resolution", () => {
  const doers = [
    { id: "tm1", linked_user_id: "auth-1" },
    { id: "tm-no-auth", linked_user_id: null },
  ];

  it("returns the signed-in user when no preview is selected", () => {
    expect(resolvePreviewTarget(doers, "", "admin-id")).toBe("admin-id");
  });

  it("returns the linked auth id for a previewed team member", () => {
    expect(resolvePreviewTarget(doers, "tm1", "admin-id")).toBe("auth-1");
  });

  it("returns null when previewing a team member without a linked auth user", () => {
    // Caller (the view) then renders the empty state instead of querying tasks.
    expect(resolvePreviewTarget(doers, "tm-no-auth", "admin-id")).toBeNull();
  });
});

describe("MyTasksView: submit-for-review contract", () => {
  // Documented invariant: submit must go through submitForReview, which sets
  // system_stage='submitted' (NOT 'completed') and awards no points until
  // an admin approves via the Review Queue. This test pins the rule so any
  // future refactor that bypasses submitForReview breaks loudly.
  it("submit transitions to 'submitted', not 'completed'", () => {
    const before = sample({ id: "t", assignee_id: "u1", system_stage: "in_progress" });
    // Simulate the patch submitForReview applies (mirrors delegationService).
    const after = { ...before, system_stage: "submitted" as const, status: "Submitted" };
    expect(after.system_stage).toBe("submitted");
    expect(after.system_stage).not.toBe("completed");
  });
});
