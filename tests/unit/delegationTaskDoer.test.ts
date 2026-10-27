import { describe, expect, it } from "vitest";
import {
  applyOrder, reorderKeys, loadOrder, saveOrder, resetOrder, isLockedFirst,
} from "@/services/delegation/columnOrder";
import { resolveTaskDoerName, type TaskDoer } from "@/services/delegation/taskDoers";

const mkStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
};

describe("column order helpers", () => {
  const cols = [
    { key: "row_no" }, { key: "assignee_id" }, { key: "title" },
    { key: "due_date" }, { key: "priority" }, { key: "actions" },
  ];

  it("row_no is locked first", () => {
    expect(isLockedFirst("row_no")).toBe(true);
    expect(isLockedFirst("title")).toBe(false);
  });

  it("applyOrder pins locked head and respects saved order", () => {
    const out = applyOrder(cols, ["priority", "title", "assignee_id"]);
    expect(out.map((c) => c.key)).toEqual(["row_no", "priority", "title", "assignee_id", "due_date", "actions"]);
  });

  it("applyOrder appends unknown keys", () => {
    const out = applyOrder(cols, []);
    expect(out[0].key).toBe("row_no");
    expect(out).toHaveLength(cols.length);
  });

  it("reorderKeys moves a column and refuses to move the locked head", () => {
    const keys = ["row_no", "assignee_id", "title", "due_date"];
    expect(reorderKeys(keys, 2, 1)).toEqual(["row_no", "title", "assignee_id", "due_date"]);
    expect(reorderKeys(keys, 0, 2)).toEqual(keys); // row_no cannot move
  });

  it("reorderKeys cannot drop a column before the locked head", () => {
    const keys = ["row_no", "assignee_id", "title"];
    expect(reorderKeys(keys, 2, 0)).toEqual(["row_no", "title", "assignee_id"]);
  });

  it("persists and resets order", () => {
    const s = mkStore();
    saveOrder(["title", "priority"], s);
    expect(loadOrder(s)).toEqual(["title", "priority"]);
    resetOrder(s);
    expect(loadOrder(s)).toEqual([]);
  });
});

describe("task doer name resolution", () => {
  const doers: TaskDoer[] = [
    { id: "tm1", name: "Abdullah", email: "a@x", position_name: null, linked_user_id: null, status: "active" },
    { id: "tm2", name: "Swati Agarwal", email: "s@x", position_name: null, linked_user_id: "auth-2", status: "active" },
  ];
  const users = [{ id: "auth-1", display_name: "Admin" }];

  it("prefers snapshot assignee_name", () => {
    expect(resolveTaskDoerName({ assignee_name: "Custom Name", assignee_id: null, assignee_team_member_id: null }, doers, users)).toBe("Custom Name");
  });

  it("falls back to matched team-member id", () => {
    expect(resolveTaskDoerName({ assignee_team_member_id: "tm1", assignee_id: null }, doers, users)).toBe("Abdullah");
  });

  it("matches by linked auth user id", () => {
    expect(resolveTaskDoerName({ assignee_team_member_id: null, assignee_id: "auth-2" }, doers, users)).toBe("Swati Agarwal");
  });

  it("falls back to legacy users list display_name", () => {
    expect(resolveTaskDoerName({ assignee_team_member_id: null, assignee_id: "auth-1" }, doers, users)).toBe("Admin");
  });

  it("renders em-dash for unknown", () => {
    expect(resolveTaskDoerName({ assignee_team_member_id: null, assignee_id: null }, doers, users)).toBe("—");
  });
});
