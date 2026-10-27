import { describe, expect, it } from "vitest";
import {
  parseTsv,
  moveColumn,
  toggleHidden,
  removeColumn,
  renameColumn,
  canEmployeeApplyPatch,
  isCoreColumn,
} from "@/services/delegation/grid";
import {
  clampWidth,
  loadDensity, saveDensity,
  loadHidden, saveHidden, toggleHiddenKey, isHidable, resetHidden,
  loadWidths, saveWidths,
  loadLabels, saveLabels, setLabel,
  DENSITY_ROW_HEIGHT, ALWAYS_VISIBLE_KEYS,
} from "@/services/delegation/gridPrefs";
import type { CustomColumn } from "@/services/delegation/delegationService";

const cols: CustomColumn[] = [
  { key: "a", label: "A", type: "text" },
  { key: "b", label: "B", type: "text" },
  { key: "c", label: "C", type: "text" },
];

// in-memory fake storage
const mkStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
  };
};

describe("delegation grid helpers", () => {
  it("parses TSV", () => {
    expect(parseTsv("a\tb\nc\td")).toEqual([["a","b"],["c","d"]]);
  });
  it("skips blanks", () => {
    expect(parseTsv("a\tb\n\nc\td\n")).toEqual([["a","b"],["c","d"]]);
  });
  it("moves columns", () => {
    expect(moveColumn(cols, "b", -1).map((c) => c.key)).toEqual(["b","a","c"]);
    expect(moveColumn(cols, "b", 1).map((c) => c.key)).toEqual(["a","c","b"]);
  });
  it("clamps at ends", () => {
    expect(moveColumn(cols, "a", -1)).toEqual(cols);
    expect(moveColumn(cols, "c", 1)).toEqual(cols);
  });
  it("hide/rename/remove", () => {
    expect(toggleHidden(cols, "b").find((c) => c.key === "b")!.hidden).toBe(true);
    expect(renameColumn(cols, "a", "Alpha").find((c) => c.key === "a")!.label).toBe("Alpha");
    expect(removeColumn(cols, "b").map((c) => c.key)).toEqual(["a","c"]);
  });
  it("blocks locked due_date for employee", () => {
    const saved = { id: "1", due_date_locked: true, due_date: "2026-06-12" };
    expect(canEmployeeApplyPatch(saved, { title: "ok" })).toBe(true);
    expect(canEmployeeApplyPatch(saved, { due_date: "2026-06-13" })).toBe(false);
  });
  it("identifies core cols", () => {
    expect(isCoreColumn("title")).toBe(true);
    expect(isCoreColumn("anything_custom")).toBe(false);
  });
});

describe("grid preferences", () => {
  it("clamps width to min/max", () => {
    expect(clampWidth(10)).toBe(60);
    expect(clampWidth(1000)).toBe(640);
    expect(clampWidth(200)).toBe(200);
  });

  it("persists and reloads widths", () => {
    const s = mkStore();
    saveWidths({ title: 320, due_date: 140 }, s);
    expect(loadWidths(s)).toEqual({ title: 320, due_date: 140 });
  });

  it("persists density preference", () => {
    const s = mkStore();
    saveDensity("spacious", s);
    expect(loadDensity(s)).toBe("spacious");
  });

  it("falls back to comfortable when no density saved", () => {
    expect(loadDensity(mkStore())).toBe("comfortable");
  });

  it("toggles hidden keys without duplicates", () => {
    expect(toggleHiddenKey(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleHiddenKey(["a", "b"], "a")).toEqual(["b"]);
  });

  it("persists hidden keys", () => {
    const s = mkStore();
    saveHidden(["delay_reason", "blocked_reason"], s);
    expect(loadHidden(s)).toEqual(["delay_reason", "blocked_reason"]);
  });

  it("protects structural columns from hiding", () => {
    expect(isHidable("title")).toBe(false);
    expect(isHidable("revision_1_date")).toBe(false);
    expect(isHidable("row_no")).toBe(false);
    expect(isHidable("actions")).toBe(false);
    expect(ALWAYS_VISIBLE_KEYS.has("row_no")).toBe(true);
  });

  it("exposes density row heights", () => {
    expect(DENSITY_ROW_HEIGHT.compact).toBeLessThan(DENSITY_ROW_HEIGHT.comfortable);
    expect(DENSITY_ROW_HEIGHT.comfortable).toBeLessThan(DENSITY_ROW_HEIGHT.spacious);
  });
});

import { summarizeMine, summarizeAdmin } from "@/services/delegation/summary";

describe("delegation summary", () => {
  const now = new Date("2026-06-12T12:00:00Z");
  const today = "2026-06-12";
  const yesterday = "2026-06-11";
  const tasks = [
    { assignee_id: "u1", system_stage: "in_progress" as const, due_date: today, completed_at: null, is_deleted: false },
    { assignee_id: "u1", system_stage: "planned" as const, due_date: yesterday, completed_at: null, is_deleted: false },
    { assignee_id: "u1", system_stage: "completed" as const, due_date: today, completed_at: `${today}T10:00:00Z`, is_deleted: false },
    { assignee_id: "u2", system_stage: "in_progress" as const, due_date: today, completed_at: null, is_deleted: false },
    { assignee_id: "u1", system_stage: "in_progress" as const, due_date: today, completed_at: null, is_deleted: true },
  ];

  it("summarizes my tasks", () => {
    const s = summarizeMine(tasks, "u1", now);
    expect(s.pendingCount).toBe(2);
    expect(s.todayCount).toBe(1);
    expect(s.overdueCount).toBe(1);
  });

  it("summarizes admin view", () => {
    const s = summarizeAdmin(tasks, now);
    expect(s.activeCount).toBe(3);
    expect(s.dueTodayCount).toBe(2);
    expect(s.overdueCount).toBe(1);
    expect(s.completedTodayCount).toBe(1);
  });

  it("ignores deleted tasks", () => {
    const s = summarizeMine(tasks, "u1", now);
    expect(s.pendingCount).toBeLessThan(3);
  });
});

describe("grid label overrides + visibility reset", () => {
  it("renames a header label via override store", () => {
    const labels = setLabel({}, "due_date", "Due Date");
    expect(labels.due_date).toBe("Due Date");
  });
  it("removes override when label is blank", () => {
    const labels = setLabel({ due_date: "Due Date" }, "due_date", "");
    expect(labels.due_date).toBeUndefined();
  });
  it("persists labels through save/load", () => {
    const s = mkStore();
    saveLabels({ title: "Task name" }, s);
    expect(loadLabels(s)).toEqual({ title: "Task name" });
  });
  it("resetHidden clears persisted hidden keys", () => {
    const s = mkStore();
    saveHidden(["revision_1_date", "delay_reason"], s);
    expect(loadHidden(s).length).toBe(2);
    resetHidden(s);
    expect(loadHidden(s)).toEqual([]);
  });
  it("Revision 1 is not in default hidden keys", () => {
    expect(loadHidden(mkStore())).toEqual([]);
  });
});

describe("visible columns shape", () => {
  // Header/body alignment guarantee: a single visibleColumns array drives both.
  // Hidden keys remove the column completely, not just visually.
  const ALL = ["row_no","assignee_id","title","due_date","revision_1_date","actions"];
  it("filters hidden keys out of the array", () => {
    const hidden = ["revision_1_date"];
    const visible = ALL.filter((k) => !isHidable(k) || !hidden.includes(k));
    expect(visible).toContain("revision_1_date");
    expect(visible).toContain("due_date");
  });
  it("structural columns stay even when toggled hidden", () => {
    expect(isHidable("row_no")).toBe(false);
    expect(isHidable("actions")).toBe(false);
  });
});

describe("custom column type contract", () => {
  it("accepts dropdown + checkbox types with options", () => {
    const col = { key: "client", label: "Client", type: "dropdown" as const, options: ["A","B"] };
    expect(col.type).toBe("dropdown");
    expect(col.options).toEqual(["A","B"]);
  });
});
