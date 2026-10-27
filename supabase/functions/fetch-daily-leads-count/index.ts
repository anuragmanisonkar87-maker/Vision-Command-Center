// Counts leads in a Google Sheet tab matching a given report date.
// Auto-detects date column if not provided. Sheet must be link-shared.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

// Try to parse a cell into YYYY-MM-DD. Supports common formats.
function normalizeDate(raw: any): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  // Already ISO
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY or D/M/YYYY (also handles - and .)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // Try Date.parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
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

    const { sheetUrl, tabName, reportDate, dateColumn } = await req.json();
    const spreadsheetId = extractSpreadsheetId(sheetUrl || "");
    if (!spreadsheetId || !tabName || !reportDate) {
      return new Response(JSON.stringify({ error: "Missing sheetUrl, tabName or reportDate." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get spreadsheet title (cheap)
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title&key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    let spreadsheetTitle = "";
    if (metaRes.ok) {
      const meta = await metaRes.json();
      spreadsheetTitle = meta.properties?.title || "";
    }

    // Fetch the entire tab values
    const range = `'${tabName.replace(/'/g, "''")}'`;
    const valsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const valsRes = await fetch(valsUrl);
    if (!valsRes.ok) {
      const txt = await valsRes.text();
      return new Response(JSON.stringify({ error: `Sheets API error (${valsRes.status}): ${txt.slice(0, 200)}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const vals = await valsRes.json();
    const rows: any[][] = vals.values || [];
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ spreadsheetId, spreadsheetTitle, dateColumn: dateColumn || "", totalRows: 0, matchingRows: 0, validLeadRows: 0, sampleRows: [], warnings: ["Tab is empty."] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers: string[] = rows[0].map((h) => String(h).trim());
    const dataRows = rows.slice(1);

    // Resolve date column index
    let dateColIdx = -1;
    let resolvedDateCol = dateColumn || "";
    if (dateColumn) {
      dateColIdx = headers.findIndex((h) => h.toLowerCase() === String(dateColumn).toLowerCase());
    }
    if (dateColIdx === -1) {
      // Auto-detect: pick first header containing 'date'
      dateColIdx = headers.findIndex((h) => /date/i.test(h));
      if (dateColIdx >= 0) resolvedDateCol = headers[dateColIdx];
    }
    if (dateColIdx === -1) {
      return new Response(
        JSON.stringify({ error: `Could not find a date column. Headers: ${headers.join(", ")}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const target = normalizeDate(reportDate);
    let matching = 0;
    let valid = 0;
    const sample: any[] = [];
    for (const row of dataRows) {
      const cell = row[dateColIdx];
      const norm = normalizeDate(cell);
      if (norm === target) {
        matching++;
        const hasAny = row.some((v) => v != null && String(v).trim() !== "");
        if (hasAny) {
          valid++;
          if (sample.length < 3) sample.push(row);
        }
      }
    }

    return new Response(
      JSON.stringify({
        spreadsheetId,
        spreadsheetTitle,
        dateColumn: resolvedDateCol,
        totalRows: dataRows.length,
        matchingRows: matching,
        validLeadRows: valid,
        sampleRows: sample,
        warnings: [],
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
