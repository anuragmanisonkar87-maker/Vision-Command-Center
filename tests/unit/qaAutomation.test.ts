// Phase 3G — QA Automation Center: pure helpers + rollup logic.
import { describe, it, expect } from "vitest";
import { __test, type QaStepResult } from "@/lib/qa/qaAutomation.functions";

const { rollup, pass, fail, skip } = __test;

describe("qaAutomation helpers", () => {
  it("pass/fail/skip build the right shape", () => {
    expect(pass("k", "L", "d")).toEqual({ key: "k", label: "L", status: "pass", details: "d" });
    expect(skip("k", "L").status).toBe("skipped");
    const f = fail("k", "L", new Error("re_secret123 boom"));
    expect(f.status).toBe("fail");
    // sanitizer should redact obvious secret-looking strings (sanitizeProviderError covers re_*)
    expect(f.details).not.toMatch(/re_secret123/);
  });

  it("rollup → pass when all pass or pass+skipped", () => {
    const steps: QaStepResult[] = [pass("a", "A"), pass("b", "B"), skip("c", "C")];
    expect(rollup(steps)).toBe("pass");
  });

  it("rollup → fail when only fails (or fail+skipped)", () => {
    expect(rollup([fail("a", "A", "x"), skip("b", "B")])).toBe("fail");
  });

  it("rollup → partial when mix of pass and fail", () => {
    expect(rollup([pass("a", "A"), fail("b", "B", "x")])).toBe("partial");
  });
});
