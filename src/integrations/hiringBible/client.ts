// Separate Supabase client pointing at the Hiring Bible project.
// Hiring Bible exposes hb_vc_* RPCs (SECURITY DEFINER, EXECUTE granted to anon)
// so the anon key is sufficient for read-only command-center access.
import { createClient } from "@supabase/supabase-js";

// Hiring Bible project — public anon (read-only RPC access).
// See src/docs/vision-center-sync-contract.md in the Hiring Bible project.
const HB_URL = "https://rtqvpjztkfevcknyeefa.supabase.co";
const HB_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cXZwanp0a2ZldmNrbnllZWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzcxMjksImV4cCI6MjA5MTQ1MzEyOX0.HkqnDO1WP-ADJzvZ9cmLPEVYEhAaIo_KBRz3HHGa8zI";

// Public/published Hiring Bible app URL — used by "Open Hiring Bible" buttons.
export const HIRING_BIBLE_URL = "https://grateful-hiring-bible.lovable.app";

export const hiringBible = createClient(HB_URL, HB_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
