import { describe, it, expect } from "vitest";
import { computeGoodDay, positionMatches, type KpiPositionConfig, type KpiDefinition } from "@/services/kpi/kpiService";

const baseCfg = (rule: any = {}): Pick<KpiPositionConfig, "good_day_rule"> => ({
  good_day_rule: { min_ship_ratio: 1, require_quality_gate: true, required_kpis: [], ...rule },
});

const def = (patch: Partial<KpiDefinition> = {}): KpiDefinition => ({
  id: "d", config_id: "c", kpi_key: "k", label: "K", description: null,
  kpi_type: "number", unit: null, target: null, direction: "higher_better",
  is_quality_gate: false, weight: 1, sort_order: 0, is_active: true, ...patch,
});

describe("computeGoodDay", () => {
  it("returns false when committed is zero", () => {
    expect(computeGoodDay(baseCfg(), [], { committed: 0, shipped: 0, quality_passed: true, values: {} })).toBe(false);
  });
  it("returns true when shipped meets committed and quality passes", () => {
    expect(computeGoodDay(baseCfg(), [], { committed: 3, shipped: 3, quality_passed: true, values: {} })).toBe(true);
  });
  it("returns false when shipped falls short of ratio", () => {
    expect(computeGoodDay(baseCfg({ min_ship_ratio: 1 }), [], { committed: 4, shipped: 3, quality_passed: true, values: {} })).toBe(false);
  });
  it("respects min_ship_ratio < 1", () => {
    expect(computeGoodDay(baseCfg({ min_ship_ratio: 0.5 }), [], { committed: 4, shipped: 2, quality_passed: true, values: {} })).toBe(true);
  });
  it("returns false when quality gate is required but fails", () => {
    expect(computeGoodDay(baseCfg({ require_quality_gate: true }), [], { committed: 1, shipped: 1, quality_passed: false, values: {} })).toBe(false);
  });
  it("ignores quality gate when require_quality_gate is false", () => {
    expect(computeGoodDay(baseCfg({ require_quality_gate: false }), [], { committed: 1, shipped: 1, quality_passed: false, values: {} })).toBe(true);
  });
  it("fails when a quality_gate definition is not true", () => {
    const defs = [def({ kpi_key: "backed_up", is_quality_gate: true, kpi_type: "boolean" })];
    expect(computeGoodDay(baseCfg(), defs, { committed: 1, shipped: 1, quality_passed: true, values: { backed_up: false } })).toBe(false);
    expect(computeGoodDay(baseCfg(), defs, { committed: 1, shipped: 1, quality_passed: true, values: { backed_up: true } })).toBe(true);
  });
  it("enforces required KPI numeric target respecting direction", () => {
    const defs = [def({ kpi_key: "rev", target: 5, direction: "higher_better" })];
    const cfg = baseCfg({ required_kpis: ["rev"] });
    expect(computeGoodDay(cfg, defs, { committed: 1, shipped: 1, quality_passed: true, values: { rev: 4 } })).toBe(false);
    expect(computeGoodDay(cfg, defs, { committed: 1, shipped: 1, quality_passed: true, values: { rev: 5 } })).toBe(true);
    const defsLower = [def({ kpi_key: "rev", target: 5, direction: "lower_better" })];
    expect(computeGoodDay(cfg, defsLower, { committed: 1, shipped: 1, quality_passed: true, values: { rev: 6 } })).toBe(false);
    expect(computeGoodDay(cfg, defsLower, { committed: 1, shipped: 1, quality_passed: true, values: { rev: 5 } })).toBe(true);
  });
  it("fails when a required KPI value is missing", () => {
    const cfg = baseCfg({ required_kpis: ["thing"] });
    expect(computeGoodDay(cfg, [], { committed: 1, shipped: 1, quality_passed: true, values: {} })).toBe(false);
  });
});

describe("positionMatches (case-insensitive contains)", () => {
  it("matches case-insensitively", () => {
    expect(positionMatches("Senior Video Editor", "video editor")).toBe(true);
    expect(positionMatches("VIDEO EDITOR", "editor")).toBe(true);
  });
  it("returns false for no match or empty", () => {
    expect(positionMatches("Media Buyer", "video editor")).toBe(false);
    expect(positionMatches(null, "x")).toBe(false);
    expect(positionMatches("x", "")).toBe(false);
  });
});
