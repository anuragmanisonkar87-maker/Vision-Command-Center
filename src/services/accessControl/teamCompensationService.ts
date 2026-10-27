// Team compensation + brand allocation service.
// - Brand allocations split a team member's monthly cost across brands.
// - When `auto_add_to_expenses` is true and Marketizers has an allocation,
//   saving upserts a recurring template into `marketizers_expense_templates`
//   (category = "Team Salaries"). Salary Sheet reads templates directly;
//   the monthly entries for Salaries / Overview / Dashboard are produced by
//   `generateRecurringExpensesForMonth`. We key by `metadata.team_member_id`
//   for idempotent sync (no duplicates).
import { supabase } from "@/integrations/supabase/client";

export type BrandAllocation = {
  id?: string;
  team_member_id: string;
  brand_id: string;
  percentage: number;
  notes?: string | null;
};

const T_TPL = "marketizers_expense_templates";

export async function getBrandAllocations(memberId: string): Promise<BrandAllocation[]> {
  const { data, error } = await (supabase as any)
    .from("gwv_team_brand_allocations")
    .select("*")
    .eq("team_member_id", memberId);
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandAllocation[];
}

export async function saveBrandAllocations(memberId: string, rows: BrandAllocation[]): Promise<void> {
  const total = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  if (total > 100.01) throw new Error(`Brand allocations total ${total.toFixed(2)}% — must be 100% or less.`);

  const { error: delErr } = await (supabase as any)
    .from("gwv_team_brand_allocations").delete().eq("team_member_id", memberId);
  if (delErr) throw new Error(delErr.message);

  const clean = rows
    .filter((r) => r.brand_id && Number(r.percentage) > 0)
    .map((r) => ({
      team_member_id: memberId,
      brand_id: r.brand_id,
      percentage: Number(r.percentage),
      notes: r.notes ?? null,
    }));
  if (!clean.length) return;
  const { error } = await (supabase as any).from("gwv_team_brand_allocations").insert(clean);
  if (error) throw new Error(error.message);
}

/** Upsert a recurring "Team Salaries" template for one member.
 *  Idempotent on metadata.team_member_id — calling twice updates the same row. */
export async function syncMemberSalaryToMarketizersExpenses(params: {
  memberId: string;
  memberName: string;
  role?: string | null;
  department?: string | null;
  salaryAmount: number;
  marketizersPercentage: number; // 0-100
  paymentDay?: number | null;
  month: string; // "YYYY-MM" — used as recurring_start_month for new templates
}): Promise<void> {
  const { memberId, memberName, role, department, salaryAmount, marketizersPercentage, paymentDay, month } = params;
  const allocated = (Number(salaryAmount) * Number(marketizersPercentage)) / 100;
  if (allocated <= 0) return;

  // Look for an existing template tagged with this member id. Use limit(1) on an
  // array result instead of maybeSingle() — maybeSingle() can error on some
  // PostgREST configs even with zero rows, which previously made the bulk-sync
  // loop silently fail for some members.
  const { data: existingList, error: findErr } = await (supabase as any)
    .from(T_TPL)
    .select("id, metadata")
    .eq("category", "Team Salaries")
    .eq("is_deleted", false)
    .contains("metadata", { team_member_id: memberId })
    .limit(1);
  if (findErr) throw new Error(findErr.message);
  const existing = existingList?.[0];

  const patch: Record<string, any> = {
    expense_name: `${memberName} — Salary`,
    employee_name: memberName,
    role: role ?? null,
    department: department ?? null,
    amount: allocated,
    amount_in_inr: allocated,
    currency: "INR",
    payment_day: paymentDay ?? null,
    template_status: "active",
  };

  const metadata = {
    ...(existing?.metadata ?? {}),
    team_member_id: memberId,
    marketizers_percentage: marketizersPercentage,
    source: "team_access_control",
    brand_key: "marketizers",
  };

  if (existing?.id) {
    const { error } = await (supabase as any)
      .from(T_TPL).update({ ...patch, metadata }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await (supabase as any)
      .from(T_TPL)
      .insert({
        ...patch,
        category: "Team Salaries",
        expense_type: "recurring",
        expense_scope: "Team-Specific",
        is_recurring: true,
        recurring_start_month: month,
        recurring_period_start_day: 1,
        recurring_period_end_day: 30,
        is_shared_expense: false,
        notes: `Auto-synced from Team Access Control (${marketizersPercentage}% Marketizers allocation).`,
        metadata,
      });
    if (error) throw new Error(error.message);
  }
}

/** Pause the synced "Team Salaries" template for a member (auto-sync turned OFF,
 *  salary cleared, or Marketizers allocation removed). No-op if no template exists.
 *  Future Generate runs skip non-active templates, so this prevents salary entries
 *  from being created. Re-enabling auto-sync flips it back to active via upsert. */
export async function pauseMemberSalaryTemplate(memberId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from(T_TPL)
    .update({ template_status: "paused" })
    .eq("category", "Team Salaries")
    .eq("is_deleted", false)
    .contains("metadata", { team_member_id: memberId });
  if (error) throw new Error(error.message);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sync every team member with auto_add_to_expenses=true into Salary Sheet
 *  templates for the given month. Idempotent. */
export async function syncAllAutoAddedSalariesForMonth(
  month: string,
): Promise<{ synced: number; skipped: number; failed: number; errors: string[] }> {
  const { data: brand } = await (supabase as any)
    .from("gwv_brands").select("id").eq("slug", "marketizers").maybeSingle();
  if (!brand?.id) throw new Error("Marketizers brand not found.");

  const { data: members, error: mErr } = await (supabase as any)
    .from("gwv_team_members")
    .select("id, name, department, salary_amount, payment_date, auto_add_to_expenses, is_deleted, status, gwv_positions(name)")
    .eq("auto_add_to_expenses", true)
    .eq("is_deleted", false)
    .neq("status", "inactive");
  if (mErr) throw new Error(mErr.message);

  let synced = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  for (const m of members ?? []) {
    if (!m.salary_amount || Number(m.salary_amount) <= 0) { skipped++; continue; }
    const { data: alloc } = await (supabase as any)
      .from("gwv_team_brand_allocations")
      .select("percentage")
      .eq("team_member_id", m.id)
      .eq("brand_id", brand.id)
      .maybeSingle();
    const pct = Number(alloc?.percentage || 0);
    if (pct <= 0) { skipped++; continue; }
    const payDay = Number(String(m.payment_date ?? "").replace(/[^\d]/g, "")) || null;
    try {
      await syncMemberSalaryToMarketizersExpenses({
        memberId: m.id,
        memberName: m.name,
        role: (m as any).gwv_positions?.name ?? null,
        department: m.department ?? null,
        salaryAmount: Number(m.salary_amount),
        marketizersPercentage: pct,
        paymentDay: payDay,
        month,
      });
      synced++;
    } catch (e: any) {
      failed++;
      errors.push(`${m.name}: ${e?.message ?? "unknown error"}`);
    }
  }
  return { synced, skipped, failed, errors };
}
