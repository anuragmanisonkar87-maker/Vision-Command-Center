// AI Smart Import — analyzes pasted messy sheet/CSV/table data and returns
// a structured draft of income/expense ledger rows. Returns draft only;
// the user reviews and approves before saving.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a finance import assistant for an Indian marketing agency's client ledger.

You receive messy pasted text from Google Sheets / Excel / CSV / table dumps that may include income (payments received from clients/students) and expenses (ad spend, salaries, refunds, tools, video editing, etc.).

Your job: extract clean structured ledger rows. Do NOT save anything — return a draft only.

INCOME column hints: "Payment Received", "Amount Paid", "Collection", "Excluding GST & Charges", "Client Name", "Student", "Payer", "Remarks", "Razorpay", "Bajaj", "Source".
EXPENSE column hints: "Expenses", "Expense Name", "Expense Incl GST", "Expense Excl GST", "Paid By", "Vendor", "Source", "Refund", "Salary", "FB Ads Spend", "Tool Cost", "Video Editing".

Category suggestions:
- FB Ads / Facebook / Meta Ads Spend → "Ad Spend"
- Google Ads / YouTube Ads → "Ad Spend"
- Refund → "Refund"
- Salary / Stipend → "Salary"
- Aisensy / IVR / WhatsApp tool / CRM / Zoom / Razorpay fee → "Tool Cost"
- Video Editing / Editor → "Video Editing"
- Company Incorporation / Legal / CA / Compliance → "Legal / Compliance"
- Otherwise leave blank or pick the most obvious category.

Rules:
- Parse Indian-formatted amounts ("₹12,500", "1,00,000", "12.5k" → 12500).
- Dates: support yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy. If unclear, return null.
- If a row clearly has no amount, drop it.
- amount_excluding_gst is the preferred net figure. If only one amount column exists, copy it into both incl and excl.
- Flag warnings: ambiguous columns, missing dates, suspiciously large/small amounts, possible duplicates within the paste, mixed currencies, rows that look like totals/subtotals.
- If the data mentions profit splits / revenue shares / partner percentages, surface them in suggested_profit_splits.
- confidence_score is 0-1; lower if columns are ambiguous.

Return ONLY the structured tool call. Never narrate.`;

type ToolCall = {
  function?: { name?: string; arguments?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated user
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ai_not_configured", message: "AI import is not configured yet." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { paste, defaultMonth, defaultType } = await req.json();
    if (!paste || typeof paste !== "string" || !paste.trim()) {
      return new Response(JSON.stringify({ error: "Missing 'paste' text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paste.length > 30000) {
      return new Response(
        JSON.stringify({ error: "Paste too large. Trim to under 30,000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tool = {
      type: "function",
      function: {
        name: "submit_ledger_draft",
        description: "Return a structured draft of the import for the user to review.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            detected_columns: { type: "array", items: { type: "string" } },
            suggested_mapping: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Map of source column name → field (entry_type, entry_date, name, category, amount_inclusive_gst, amount_excluding_gst, source, notes, ignore).",
            },
            income_rows: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  entry_date: { type: ["string", "null"] },
                  name: { type: ["string", "null"] },
                  category: { type: ["string", "null"] },
                  amount_inclusive_gst: { type: "number" },
                  amount_excluding_gst: { type: "number" },
                  source: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                },
                required: ["amount_inclusive_gst", "amount_excluding_gst"],
              },
            },
            expense_rows: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  entry_date: { type: ["string", "null"] },
                  name: { type: ["string", "null"] },
                  category: { type: ["string", "null"] },
                  amount_inclusive_gst: { type: "number" },
                  amount_excluding_gst: { type: "number" },
                  source: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                },
                required: ["amount_inclusive_gst", "amount_excluding_gst"],
              },
            },
            warnings: { type: "array", items: { type: "string" } },
            duplicate_risk_notes: { type: "array", items: { type: "string" } },
            suggested_profit_splits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  receiver_name: { type: "string" },
                  split_percent: { type: "number" },
                  note: { type: ["string", "null"] },
                },
                required: ["receiver_name", "split_percent"],
              },
            },
            confidence_score: { type: "number" },
          },
          required: [
            "detected_columns",
            "suggested_mapping",
            "income_rows",
            "expense_rows",
            "warnings",
            "duplicate_risk_notes",
            "confidence_score",
          ],
        },
      },
    };

    const userPrompt = [
      `Default month for rows missing a date: ${defaultMonth ?? "(unknown)"}.`,
      `User's default row type when ambiguous: ${defaultType ?? "expense"}.`,
      ``,
      `PASTED DATA:`,
      `"""`,
      paste,
      `"""`,
    ].join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_ledger_draft" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "AI rate limit hit. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "credits_exhausted", message: "AI credits exhausted. Add credits in workspace billing." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "ai_error", message: `AI gateway error (${aiRes.status})`, detail: txt.slice(0, 400) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall: ToolCall | undefined = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const rawArgs = toolCall?.function?.arguments;
    if (!rawArgs) {
      return new Response(
        JSON.stringify({ error: "ai_no_output", message: "AI did not return a structured draft." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let draft: any;
    try {
      draft = JSON.parse(rawArgs);
    } catch {
      return new Response(
        JSON.stringify({ error: "ai_parse_error", message: "AI returned malformed JSON." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ draft }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
