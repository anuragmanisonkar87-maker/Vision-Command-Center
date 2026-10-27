// @ts-nocheck
// Audit log service for Team Access Control (Phase 5).
import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_team_member_id: string | null;
  summary: string | null;
  details: Record<string, any>;
};

export async function logAudit(entry: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  target_team_member_id?: string | null;
  summary?: string;
  details?: Record<string, any>;
}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await (supabase as any).from("gwv_access_audit_log").insert({
      actor_user_id: u.user?.id ?? null,
      actor_label: u.user?.email ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      target_team_member_id: entry.target_team_member_id ?? null,
      summary: entry.summary ?? null,
      details: entry.details ?? {},
    });
  } catch (e) {
    // Non-fatal; audit failures must never break the user action.
    console.warn("[audit] failed to log", e);
  }
}

export async function getAuditLog(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_access_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
