import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export type AccessSummaryRow = {
  team_member_id: string;
  brand_count: number;
  module_count: number;
};

export const listAccessSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AccessSummaryRow[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [brandsRes, modulesRes] = await Promise.all([
      supabaseAdmin
        .from("gwv_user_brand_access")
        .select("team_member_id")
        .eq("is_active", true),
      supabaseAdmin
        .from("gwv_user_module_access")
        .select("team_member_id")
        .eq("is_active", true),
    ]);
    if (brandsRes.error) throw new Error(brandsRes.error.message);
    if (modulesRes.error) throw new Error(modulesRes.error.message);

    const brandCounts = new Map<string, number>();
    for (const r of brandsRes.data ?? []) {
      const id = (r as any).team_member_id;
      if (!id) continue;
      brandCounts.set(id, (brandCounts.get(id) ?? 0) + 1);
    }
    const moduleCounts = new Map<string, number>();
    for (const r of modulesRes.data ?? []) {
      const id = (r as any).team_member_id;
      if (!id) continue;
      moduleCounts.set(id, (moduleCounts.get(id) ?? 0) + 1);
    }

    const ids = new Set<string>([...brandCounts.keys(), ...moduleCounts.keys()]);
    const rows: AccessSummaryRow[] = [];
    for (const id of ids) {
      rows.push({
        team_member_id: id,
        brand_count: brandCounts.get(id) ?? 0,
        module_count: moduleCounts.get(id) ?? 0,
      });
    }
    return { rows };
  });
