// useMyTeamMember — resolves auth.uid() -> gwv_team_members row + position.
// Generic (no role-specific helpers); positionMatches() lets callers gate UI.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/auth/useAuth";
import { positionMatches as pmatches } from "@/services/kpi/kpiService";

export type MyTeamMember = {
  id: string;
  name: string | null;
  positionId: string | null;
  positionName: string | null;
};

const CACHE = new Map<string, MyTeamMember | null>();

export function useMyTeamMember() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [data, setData] = useState<MyTeamMember | null>(uid ? CACHE.get(uid) ?? null : null);
  const [loading, setLoading] = useState(!!uid && !CACHE.has(uid));

  useEffect(() => {
    if (!uid) { setData(null); setLoading(false); return; }
    if (CACHE.has(uid)) { setData(CACHE.get(uid) ?? null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("gwv_team_members")
        .select("id, name, linked_user_id, position_id, gwv_positions(name)")
        .eq("linked_user_id", uid)
        .eq("is_deleted", false)
        .limit(1);
      const row = (rows as any[])?.[0];
      const val: MyTeamMember | null = row
        ? {
            id: row.id,
            name: row.name ?? null,
            positionId: row.position_id ?? null,
            positionName: row.gwv_positions?.name ?? null,
          }
        : null;
      CACHE.set(uid, val);
      if (!cancelled) { setData(val); setLoading(false); }
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  const isVideoEditor = pmatches(data?.positionName, "video editor");
  const positionMatches = (needle: string) => pmatches(data?.positionName, needle);
  return { teamMember: data, loading, isVideoEditor, positionMatches };
}
