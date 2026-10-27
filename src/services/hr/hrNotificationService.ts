import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;

export type HrNotification = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  message: string | null;
  source_type: string | null;
  is_read: boolean;
  created_at: string;
};

export async function listNotifications(limit = 20): Promise<HrNotification[]> {
  const { data, error } = await sb.from("gwv_hr_notifications")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []) as HrNotification[];
}

export async function markRead(id: string) {
  const { error } = await sb.from("gwv_hr_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
