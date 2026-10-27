// Phase 3E.2A — admin-only Resend smoke test runner unit tests.
// We exercise the pure pieces (constants + sanitizer + core sender) with a
// mocked supabase client and stubbed `fetch`. We DO NOT call the real
// `runMissedEmailSmokeTest` serverFn here — that requires the TanStack
// runtime and a live Supabase session; it is verified end-to-end from the
// Discipline tab.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  SMOKE_TEST_RECIPIENT,
  SMOKE_TEST_TASK_TITLE,
  SMOKE_TEST_SUBJECT,
  SMOKE_TEST_BODY,
} from "@/lib/delegation/missedEmailSmokeTest.functions";
import {
  performSendMissedTaskEmail,
  sanitizeProviderError,
} from "@/lib/delegation/missedEmailSender.functions";

describe("Resend smoke test — safety constants", () => {
  it("recipient is fixed to Resend sandbox (no real inboxes)", () => {
    expect(SMOKE_TEST_RECIPIENT).toBe("delivered@resend.dev");
  });

  it("QA task/subject/body literals are stable and self-identifying", () => {
    expect(SMOKE_TEST_TASK_TITLE).toBe("QA Resend Smoke Test Missed Task");
    expect(SMOKE_TEST_SUBJECT).toBe("QA Resend Smoke Test — Please Ignore");
    expect(SMOKE_TEST_BODY).toContain("automated QA smoke test");
  });
});

describe("sanitizeProviderError", () => {
  it("redacts Resend API keys (re_...)", () => {
    const s = sanitizeProviderError("auth failed for re_abc123XYZ_token");
    expect(s).not.toContain("re_abc123XYZ_token");
    expect(s).toContain("[redacted]");
  });

  it("redacts Bearer tokens", () => {
    const s = sanitizeProviderError("Authorization: Bearer eyJabc.def.ghi failed");
    expect(s).toMatch(/Bearer \[redacted\]/);
    expect(s).not.toContain("eyJabc.def.ghi");
  });

  it("caps length at 500 characters", () => {
    expect(sanitizeProviderError("x".repeat(2000)).length).toBeLessThanOrEqual(500);
  });
});

// --------- performSendMissedTaskEmail with mocked supabase + fetch ----------

type LogRow = {
  id: string;
  email_to: string;
  email_subject: string;
  email_body: string;
  email_status: "draft" | "sent" | "failed";
};

function makeSupabase(initial: LogRow) {
  const updates: any[] = [];
  let current: LogRow = { ...initial };
  const supabase = {
    from(_table: string) {
      const builder: any = {
        _selectFields: "*",
        select(fields: string) {
          builder._selectFields = fields;
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          return { data: { ...current }, error: null };
        },
        update(payload: any) {
          updates.push(payload);
          current = { ...current, ...payload };
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return builder;
    },
  };
  return { supabase, updates, getCurrent: () => current };
}

describe("performSendMissedTaskEmail (smoke-test core)", () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key_DO_NOT_LEAK";
    process.env.RESEND_FROM_EMAIL = "no-reply@example.com";
    delete process.env.RESEND_REPLY_TO_EMAIL;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it("returns not_configured when secrets are missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { supabase } = makeSupabase({
      id: "log-1",
      email_to: SMOKE_TEST_RECIPIENT,
      email_subject: SMOKE_TEST_SUBJECT,
      email_body: SMOKE_TEST_BODY,
      email_status: "draft",
    });
    const r = await performSendMissedTaskEmail(supabase as any, "user-1", { logId: "log-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("not_configured");
  });

  it("sends via Resend and flips row to sent + records provider message id", async () => {
    const { supabase, getCurrent } = makeSupabase({
      id: "log-1",
      email_to: SMOKE_TEST_RECIPIENT,
      email_subject: SMOKE_TEST_SUBJECT,
      email_body: SMOKE_TEST_BODY,
      email_status: "draft",
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "resend-msg-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as any;

    const r = await performSendMissedTaskEmail(supabase as any, "admin-1", { logId: "log-1" });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe("sent");
      expect(r.providerMessageId).toBe("resend-msg-123");
    }

    // Resend endpoint hit with bearer header
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as any).headers.Authorization).toMatch(/^Bearer re_test_key_/);
    const body = JSON.parse((init as any).body);
    expect(body.to).toEqual([SMOKE_TEST_RECIPIENT]);
    expect(body.subject).toBe(SMOKE_TEST_SUBJECT);

    // Row flipped to sent
    const final = getCurrent();
    expect(final.email_status).toBe("sent");
  });

  it("marks row failed + sanitizes error on Resend HTTP error (never leaks api key)", async () => {
    const { supabase, getCurrent } = makeSupabase({
      id: "log-1",
      email_to: SMOKE_TEST_RECIPIENT,
      email_subject: SMOKE_TEST_SUBJECT,
      email_body: SMOKE_TEST_BODY,
      email_status: "draft",
    });
    globalThis.fetch = (vi.fn(async () =>
      new Response(
        JSON.stringify({
          message: "invalid api key re_test_key_DO_NOT_LEAK and Bearer abc.def.ghi",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    )) as any;

    const r = await performSendMissedTaskEmail(supabase as any, "admin-1", { logId: "log-1" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe("failed");
      expect(r.error).not.toContain("re_test_key_DO_NOT_LEAK");
      expect(r.error).not.toContain("abc.def.ghi");
    }
    expect(getCurrent().email_status).toBe("failed");
  });

  it("rejects already-sent rows unless allowResend=true", async () => {
    const { supabase } = makeSupabase({
      id: "log-1",
      email_to: SMOKE_TEST_RECIPIENT,
      email_subject: SMOKE_TEST_SUBJECT,
      email_body: SMOKE_TEST_BODY,
      email_status: "sent",
    });
    const r = await performSendMissedTaskEmail(supabase as any, "admin-1", { logId: "log-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("invalid");
  });
});
