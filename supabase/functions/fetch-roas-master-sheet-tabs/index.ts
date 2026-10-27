// Detects tabs (sheets) in a Google Spreadsheet using the Sheets API + API key.
// Sheet must be link-shared "Anyone with the link can view" for API key access.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require a Supabase bearer token — block unauthenticated callers from
  // consuming the server-side Google Sheets API key.
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

  try {
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_SHEETS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { masterSheetUrl } = await req.json();
    const spreadsheetId = extractSpreadsheetId(masterSheetUrl || "");
    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: "Invalid Google Sheet URL." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get spreadsheet metadata (title + tabs)
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties&key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      const txt = await metaRes.text();
      return new Response(JSON.stringify({ error: `Sheets API error (${metaRes.status}): ${txt.slice(0, 200)}. Make sure the sheet is shared as 'Anyone with the link can view'.` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = await metaRes.json();
    const tabs = (meta.sheets || []).map((s: any) => ({
      tabName: s.properties.title,
      sheetId: String(s.properties.sheetId),
    }));

    // Fetch first row (headers) for each tab via batchGet
    const ranges = tabs.map((t: any) => `${encodeURIComponent("'" + t.tabName.replace(/'/g, "''") + "'")}!1:1`);
    const headersByTab: Record<string, string[]> = {};
    if (ranges.length) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges.map((r: string) => `ranges=${r}`).join("&")}&key=${apiKey}`;
      const batchRes = await fetch(batchUrl);
      if (batchRes.ok) {
        const batch = await batchRes.json();
        (batch.valueRanges || []).forEach((vr: any, i: number) => {
          headersByTab[tabs[i].tabName] = (vr.values?.[0] || []).map((v: any) => String(v));
        });
      }
    }

    return new Response(
      JSON.stringify({
        spreadsheetId,
        spreadsheetTitle: meta.properties?.title || "",
        tabs: tabs.map((t: any) => ({ ...t, detectedHeaders: headersByTab[t.tabName] || [] })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
