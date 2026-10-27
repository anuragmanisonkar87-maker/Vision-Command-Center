// Fetches rows from a publicly-shared Google Sheet using the server-side
// GOOGLE_SHEETS_API_KEY. Authenticated Vision Center admins only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input)) return input;
  return null;
}

function quoteTab(name: string): string {
  // Always wrap in single quotes; escape embedded single quotes.
  return `'${String(name).replace(/'/g, "''")}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // Admin gate
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);
  } catch (e) {
    return json({ error: "Auth check failed: " + (e as Error).message }, 401);
  }

  const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_SHEETS_API_KEY not configured." }, 500);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const { sheet_url, spreadsheet_id, sheet_name, range } = payload ?? {};
  const sid = extractSpreadsheetId(spreadsheet_id || sheet_url || "");
  if (!sid) return json({ error: "Invalid Google Sheet URL or spreadsheet ID." }, 400);

  try {
    // ALWAYS fetch metadata so the caller has the full tabs list.
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}?fields=properties.title,sheets.properties&key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      const txt = await metaRes.text();
      if (metaRes.status === 403 || metaRes.status === 404) {
        return json({
          error: "Sheet must be shared as Anyone with the link → Viewer.",
          detail: txt.slice(0, 300),
        }, 200);
      }
      return json({ error: `Sheets API error (${metaRes.status}): ${txt.slice(0, 200)}` }, 200);
    }
    const meta = await metaRes.json();
    const spreadsheetTitle: string = meta.properties?.title ?? "";
    const tabs: { tabName: string; sheetId: string }[] = (meta.sheets ?? []).map((s: any) => ({
      tabName: s.properties.title,
      sheetId: String(s.properties.sheetId),
    }));

    // No tab requested → metadata-only response.
    if (!sheet_name && !range) {
      return json({
        spreadsheetId: sid,
        spreadsheetTitle,
        tabs,
        sheetName: null,
        range: "",
        headers: [],
        rows: [],
        totalRows: 0,
      });
    }

    // Validate the requested tab against metadata for a helpful error.
    if (sheet_name && !range) {
      const exists = tabs.some((t) => t.tabName === sheet_name);
      if (!exists) {
        const list = tabs.map((t) => `"${t.tabName}"`).join(", ");
        return json({
          error: `Tab not found. Please select one of: ${list}`,
          spreadsheetId: sid,
          spreadsheetTitle,
          tabs,
        }, 200);
      }
    }

    // Build safe range. Always wrap tab name in single quotes.
    const effectiveRange = range
      ? range
      : quoteTab(String(sheet_name));
    const valsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(effectiveRange)}?key=${apiKey}`;
    const valsRes = await fetch(valsUrl);
    if (!valsRes.ok) {
      const txt = await valsRes.text();
      if (valsRes.status === 403 || valsRes.status === 404) {
        return json({
          error: "Sheet must be shared as Anyone with the link → Viewer, or the tab name is wrong.",
          detail: txt.slice(0, 300),
          tabs,
          spreadsheetTitle,
          spreadsheetId: sid,
        }, 200);
      }
      if (valsRes.status === 400) {
        const list = tabs.map((t) => `"${t.tabName}"`).join(", ");
        return json({
          error: `Could not read tab/range. Available tabs: ${list}`,
          detail: txt.slice(0, 200),
          tabs,
          spreadsheetTitle,
          spreadsheetId: sid,
        }, 200);
      }
      return json({ error: `Sheets API error (${valsRes.status}): ${txt.slice(0, 200)}`, tabs }, 200);
    }
    const vals = await valsRes.json();
    const rows: any[][] = vals.values ?? [];
    const headers: string[] = (rows[0] ?? []).map((h: any) => String(h));
    const dataRows = rows.slice(1);

    return json({
      spreadsheetId: sid,
      spreadsheetTitle,
      tabs,
      sheetName: sheet_name ?? null,
      range: effectiveRange,
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
