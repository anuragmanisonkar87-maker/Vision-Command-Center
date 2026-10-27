import { describe, it, expect } from "vitest";
import {
  validateSendInputs,
  canSendFromStatus,
  sanitizeProviderError,
  hasResendConfig,
  MISSED_TASK_EMAIL_FOOTER,
} from "@/lib/delegation/missedEmailRules";

describe("hasResendConfig", () => {
  it("false when API key missing", () => {
    expect(hasResendConfig({ RESEND_FROM_EMAIL: "no-reply@x.com" })).toBe(false);
  });
  it("false when from email missing", () => {
    expect(hasResendConfig({ RESEND_API_KEY: "re_xxx" })).toBe(false);
  });
  it("false when both empty", () => {
    expect(hasResendConfig({})).toBe(false);
    expect(hasResendConfig({ RESEND_API_KEY: "", RESEND_FROM_EMAIL: "" })).toBe(false);
  });
  it("true when both present", () => {
    expect(hasResendConfig({ RESEND_API_KEY: "re_x", RESEND_FROM_EMAIL: "a@b.co" })).toBe(true);
  });
});

describe("validateSendInputs", () => {
  it("requires a valid recipient email", () => {
    expect(validateSendInputs({ recipient: "", subject: "s", body: "b" }).ok).toBe(false);
    expect(validateSendInputs({ recipient: "not-an-email", subject: "s", body: "b" }).ok).toBe(false);
    expect(validateSendInputs({ recipient: "alex@example.com", subject: "s", body: "b" }).ok).toBe(true);
  });
  it("requires a non-empty subject", () => {
    const r = validateSendInputs({ recipient: "a@b.com", subject: "  ", body: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Subject/);
  });
  it("requires a non-empty body", () => {
    const r = validateSendInputs({ recipient: "a@b.com", subject: "x", body: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Body/);
  });
});

describe("canSendFromStatus", () => {
  it("allows draft", () => expect(canSendFromStatus("draft", false).ok).toBe(true));
  it("allows failed (retry)", () => expect(canSendFromStatus("failed", false).ok).toBe(true));
  it("blocks sent without allowResend", () => {
    const r = canSendFromStatus("sent", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/already been sent/);
  });
  it("allows sent when allowResend is true", () => {
    expect(canSendFromStatus("sent", true).ok).toBe(true);
  });
  it("blocks unknown statuses", () => {
    expect(canSendFromStatus("queued", false).ok).toBe(false);
  });
});

describe("sanitizeProviderError", () => {
  it("redacts Resend api keys", () => {
    expect(sanitizeProviderError("auth failed for re_ABC123XYZ_secret")).toContain("[redacted]");
    expect(sanitizeProviderError("auth failed for re_ABC123XYZ_secret")).not.toContain("re_ABC123XYZ_secret");
  });
  it("redacts Bearer tokens", () => {
    expect(sanitizeProviderError("Bearer abcdef.ghijk.lmnop bad")).toContain("Bearer [redacted]");
  });
  it("truncates long messages", () => {
    const s = sanitizeProviderError("x".repeat(2000));
    expect(s.length).toBeLessThanOrEqual(500);
  });
  it("stringifies non-string errors", () => {
    expect(sanitizeProviderError({ code: 401 })).toContain("401");
  });
});

describe("footer", () => {
  it("includes Vision Center disclaimer", () => {
    expect(MISSED_TASK_EMAIL_FOOTER).toMatch(/Vision Center/);
  });
});
