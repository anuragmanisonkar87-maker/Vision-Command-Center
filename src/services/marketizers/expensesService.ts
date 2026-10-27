// Marketizers Expenses Center — unified service layer.
// Backwards-compatible: legacy salary/shared functions still exported.
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────
export type MasterOption = {
  id: string;
  option_type: string;
  label: string;
  description: string | null;
  status: string;
  sort_order: number;
  metadata: Record<string, any>;
};

export type ExpenseTemplate = {
  id: string;
  expense_name: string;
  expense_type: "one_time" | "recurring";
  category: string;
  expense_scope: string;
  client_id: string | null;
  amount: number;
  currency: string;
  conversion_rate: number | null;
  amount_in_inr: number;
  vendor_or_tool: string | null;
  employee_name: string | null;
  role: string | null;
  department: string | null;
  freelancer_name: string | null;
  platform: string | null;
  purpose: string | null;
  payment_mode: string | null;
  payment_handler: string | null;
  impact_type: string | null;
  receipt_status: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_start_month: string | null;
  recurring_end_month: string | null;
  recurring_period_start_day: number;
  recurring_period_end_day: number;
  payment_day: number | null;
  template_status: "active" | "paused" | "cancelled" | "review";
  review_status: string;
  cancellation_reason: string | null;
};

export type ExpenseEntry = {
  id: string;
  template_id: string | null;
  month: string;
  expense_date: string | null;
  expense_name: string;
  expense_type: "one_time" | "recurring";
  category: string;
  expense_scope: string;
  client_id: string | null;
  amount: number;
  currency: string;
  conversion_rate: number | null;
  amount_in_inr: number;
  payment_status: string;
  payment_mode: string | null;
  payment_handler: string | null;
  vendor_or_tool: string | null;
  employee_name: string | null;
  role: string | null;
  department: string | null;
  freelancer_name: string | null;
  platform: string | null;
  purpose: string | null;
  impact_type: string | null;
  receipt_status: string | null;
  receipt_url: string | null;
  notes: string | null;
  is_generated_from_recurring: boolean;
  recurring_period_start_day: number | null;
  recurring_period_end_day: number | null;
  payment_day: number | null;
  entry_status: "active" | "skipped" | "cancelled" | "eliminated";
  metadata: Record<string, any>;
};

export type ExpenseMonthlyClose = {
  id: string;
  month: string;
  total_expenses: number;
  recurring_expenses: number;
  one_time_expenses: number;
  client_specific_expenses: number;
  company_wide_expenses: number;
  team_salary_expenses: number;
  tools_expenses: number;
  pending_expenses: number;
  missing_receipts_count: number;
  review_items_count: number;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
};

const T_OPT = "marketizers_expense_master_options";
const T_TPL = "marketizers_expense_templates";
const T_ENT = "marketizers_expense_entries";
const T_CLOSE = "marketizers_expense_monthly_closures";

// ── Master options ────────────────────────────────────────────
export async function getExpenseMasterOptions(optionType?: string): Promise<MasterOption[]> {
  let q = supabase.from(T_OPT as any).select("*").eq("is_deleted", false).eq("status", "active").order("sort_order").order("label");
  if (optionType) q = q.eq("option_type", optionType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MasterOption[];
}

export async function createExpenseMasterOption(option_type: string, label: string, metadata: Record<string, any> = {}) {
  const { data, error } = await supabase.from(T_OPT as any).insert({ option_type, label: label.trim(), metadata }).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as MasterOption;
}

export async function updateExpenseMasterOption(id: string, p: Partial<MasterOption>) {
  const { error } = await supabase.from(T_OPT as any).update(p).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteExpenseMasterOption(id: string) {
  const { error } = await supabase.from(T_OPT as any).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Templates ─────────────────────────────────────────────────
export async function getExpenseTemplates(filters: { recurringOnly?: boolean } = {}): Promise<ExpenseTemplate[]> {
  let q = supabase.from(T_TPL as any).select("*").eq("is_deleted", false).order("created_at", { ascending: false });
  if (filters.recurringOnly) q = q.eq("is_recurring", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ExpenseTemplate[];
}

export async function createExpenseTemplate(p: Partial<ExpenseTemplate>) {
  const { data, error } = await supabase.from(T_TPL as any).insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as ExpenseTemplate;
}

export async function updateExpenseTemplate(id: string, p: Partial<ExpenseTemplate>) {
  const { error } = await supabase.from(T_TPL as any).update(p).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function pauseExpenseTemplate(id: string) {
  return updateExpenseTemplate(id, { template_status: "paused" });
}

export async function cancelExpenseTemplate(id: string, reason: string, endMonth?: string) {
  return updateExpenseTemplate(id, { template_status: "cancelled", cancellation_reason: reason, recurring_end_month: endMonth ?? null });
}

export async function softDeleteExpenseTemplate(id: string) {
  const { error } = await supabase.from(T_TPL as any).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Entries ───────────────────────────────────────────────────
export type EntryFilters = {
  month?: string;
  category?: string;
  scope?: string;
  payment_status?: string;
  impact_type?: string;
  client_id?: string;
  search?: string;
};

export async function getExpenseEntries(filters: EntryFilters = {}): Promise<ExpenseEntry[]> {
  let q = supabase.from(T_ENT as any).select("*").eq("is_deleted", false).order("expense_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (filters.month) q = q.eq("month", filters.month);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.scope) q = q.eq("expense_scope", filters.scope);
  if (filters.payment_status) q = q.eq("payment_status", filters.payment_status);
  if (filters.impact_type) q = q.eq("impact_type", filters.impact_type);
  if (filters.client_id) q = q.eq("client_id", filters.client_id);
  if (filters.search) q = q.ilike("expense_name", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ExpenseEntry[];
}

export const getExpenseEntriesByMonth = (month: string) => getExpenseEntries({ month });

export async function createExpenseEntry(p: Partial<ExpenseEntry>) {
  const { data, error } = await supabase.from(T_ENT as any).insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as ExpenseEntry;
}

export async function updateExpenseEntry(id: string, p: Partial<ExpenseEntry>) {
  const { error } = await supabase.from(T_ENT as any).update(p).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDeleteExpenseEntry(id: string) {
  const { error } = await supabase.from(T_ENT as any).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export const markExpensePaid = (id: string) => updateExpenseEntry(id, { payment_status: "paid" });
export const markExpenseSkipped = (id: string) => updateExpenseEntry(id, { entry_status: "skipped" });
export const markExpenseCancelled = (id: string) => updateExpenseEntry(id, { entry_status: "cancelled", payment_status: "cancelled" });

// ── Recurring generation ──────────────────────────────────────
function isMonthInRange(month: string, start: string | null, end: string | null) {
  if (start && month < start) return false;
  if (end && month > end) return false;
  return true;
}

export async function checkTemplateAlreadyGenerated(templateId: string, month: string): Promise<boolean> {
  const { data, error } = await supabase.from(T_ENT as any).select("id").eq("template_id", templateId).eq("month", month).eq("is_deleted", false).limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function getRecurringGenerationPreview(month: string) {
  const templates = await getExpenseTemplates({ recurringOnly: true });
  const eligible = templates.filter((t) => t.template_status === "active" && isMonthInRange(month, t.recurring_start_month, t.recurring_end_month));
  const existing = await getExpenseEntriesByMonth(month);
  const generated = new Set(existing.filter((e) => e.template_id).map((e) => e.template_id));
  return {
    eligible,
    toGenerate: eligible.filter((t) => !generated.has(t.id)),
    alreadyGenerated: eligible.filter((t) => generated.has(t.id)),
  };
}

export async function generateRecurringExpensesForMonth(month: string, filters: { category?: string } = {}) {
  const preview = await getRecurringGenerationPreview(month);
  const toGenerate = filters.category
    ? preview.toGenerate.filter((t) => t.category === filters.category)
    : preview.toGenerate;
  // Lazy import to avoid circular dep
  const { getAllocations, saveAllocations } = await import("@/services/allocations/sharedExpenseAllocationService");
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const t of toGenerate) {
    try {
      const alreadyGenerated = await checkTemplateAlreadyGenerated(t.id, month);
      if (alreadyGenerated) { skipped++; continue; }
      const payDay = Math.min(Math.max(Number(t.payment_day || 1), 1), 28);
      const entry = await createExpenseEntry({
        template_id: t.id,
        month,
        expense_date: `${month}-${String(payDay).padStart(2, "0")}`,
        expense_name: t.expense_name,
        expense_type: "recurring",
        category: t.category,
        expense_scope: t.expense_scope,
        client_id: t.client_id,
        amount: t.amount,
        currency: t.currency,
        conversion_rate: t.conversion_rate,
        amount_in_inr: t.amount_in_inr,
        payment_status: "pending",
        payment_mode: t.payment_mode,
        payment_handler: t.payment_handler,
        vendor_or_tool: t.vendor_or_tool,
        employee_name: t.employee_name,
        role: t.role,
        department: t.department,
        freelancer_name: t.freelancer_name,
        platform: t.platform,
        purpose: t.purpose,
        impact_type: t.impact_type,
        receipt_status: t.receipt_status,
        notes: t.notes,
        is_generated_from_recurring: true,
        recurring_period_start_day: t.recurring_period_start_day,
        recurring_period_end_day: t.recurring_period_end_day,
        payment_day: t.payment_day,
        is_shared_expense: (t as any).is_shared_expense ?? false,
        metadata: {
          ...((t as any).metadata ?? {}),
          source: t.category === "Team Salaries" ? "team_access_control" : "recurring_template",
          template_id: t.id,
          generated_for_month: month,
        },
      } as any);
      // Copy template allocations onto the new entry
      if ((t as any).is_shared_expense) {
        const tplAllocs = await getAllocations("marketizers_expense_template", t.id);
        if (tplAllocs.length) {
          await saveAllocations(
            "marketizers_expense_entry",
            entry.id,
            Number(t.amount_in_inr || 0),
            tplAllocs.map((a) => ({
              brand_id: a.brand_id,
              allocation_percentage: Number(a.allocation_percentage),
              month,
            }))
          );
        }
      }
      created++;
    } catch (e: any) {
      errors.push(`${t.expense_name}: ${e?.message ?? "generation failed"}`);
    }
  }
  return { created, skipped, failed: errors.length, total: toGenerate.length, errors };
}

// ── Monthly close ─────────────────────────────────────────────
export async function getExpenseMonthlyClose(month: string): Promise<ExpenseMonthlyClose | null> {
  const { data, error } = await supabase.from(T_CLOSE as any).select("*").eq("month", month).eq("is_deleted", false).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ExpenseMonthlyClose) ?? null;
}

export async function calculateExpenseMonthlyClose(month: string) {
  const entries = (await getExpenseEntriesByMonth(month)).filter((e) => e.entry_status === "active");
  const sum = (xs: ExpenseEntry[]) => xs.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
  return {
    total_expenses: sum(entries),
    recurring_expenses: sum(entries.filter((e) => e.expense_type === "recurring")),
    one_time_expenses: sum(entries.filter((e) => e.expense_type === "one_time")),
    client_specific_expenses: sum(entries.filter((e) => e.expense_scope === "Client-Specific")),
    company_wide_expenses: sum(entries.filter((e) => e.expense_scope === "Company-Wide")),
    team_salary_expenses: sum(entries.filter((e) => e.category === "Team Salaries")),
    tools_expenses: sum(entries.filter((e) => e.category === "Software & Tools")),
    pending_expenses: sum(entries.filter((e) => e.payment_status === "pending" || e.payment_status === "partial")),
    missing_receipts_count: entries.filter((e) => e.receipt_status === "Missing" || e.receipt_status === "Invoice Pending").length,
    review_items_count: entries.filter((e) => e.impact_type === "Under Review" || e.impact_type === "Wasteful").length,
  };
}

export async function lockExpenseMonth(month: string, notes?: string) {
  const totals = await calculateExpenseMonthlyClose(month);
  const existing = await getExpenseMonthlyClose(month);
  const payload = { month, ...totals, is_locked: true, locked_at: new Date().toISOString(), notes: notes ?? null };
  if (existing) {
    const { error } = await supabase.from(T_CLOSE as any).update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from(T_CLOSE as any).insert(payload);
    if (error) throw new Error(error.message);
  }
}

export async function unlockExpenseMonth(month: string) {
  const existing = await getExpenseMonthlyClose(month);
  if (!existing) return;
  const { error } = await supabase.from(T_CLOSE as any).update({ is_locked: false, locked_at: null, locked_by: null }).eq("id", existing.id);
  if (error) throw new Error(error.message);
}

// ── Summary (BACK-COMPAT + extended) ──────────────────────────
// Keep legacy shape (teamSalary, sharedTotal, salaries, shared) AND add new fields.
export async function getMarketizersExpenseSummary(month: string) {
  const entries = (await getExpenseEntriesByMonth(month)).filter((e) => e.entry_status === "active");
  const sum = (xs: ExpenseEntry[]) => xs.reduce((a, b) => a + Number(b.amount_in_inr || 0), 0);
  const teamSalary = sum(entries.filter((e) => e.category === "Team Salaries"));
  const toolsTotal = sum(entries.filter((e) => e.category === "Software & Tools"));
  const totalExpenses = sum(entries);
  const recurringTotal = sum(entries.filter((e) => e.expense_type === "recurring"));
  const oneTimeTotal = sum(entries.filter((e) => e.expense_type === "one_time"));
  const clientSpecificTotal = sum(entries.filter((e) => e.expense_scope === "Client-Specific"));
  const companyWideTotal = sum(entries.filter((e) => e.expense_scope === "Company-Wide"));
  const sharedTotal = totalExpenses - teamSalary; // legacy approx for back-compat
  const pendingTotal = sum(entries.filter((e) => e.payment_status === "pending" || e.payment_status === "partial"));
  const reviewCount = entries.filter((e) => e.impact_type === "Under Review" || e.impact_type === "Wasteful").length;
  return {
    teamSalary,
    sharedTotal,
    salaries: entries.filter((e) => e.category === "Team Salaries"),
    shared: entries.filter((e) => e.category !== "Team Salaries"),
    totalExpenses,
    recurringTotal,
    oneTimeTotal,
    clientSpecificTotal,
    companyWideTotal,
    toolsTotal,
    pendingTotal,
    reviewCount,
    entries,
  };
}

export async function getExpenseCategoryBreakdown(month: string) {
  const entries = (await getExpenseEntriesByMonth(month)).filter((e) => e.entry_status === "active");
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount_in_inr || 0));
  return Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export async function getExpenseOptimizationFlags(month: string) {
  const entries = (await getExpenseEntriesByMonth(month)).filter((e) => e.entry_status === "active");
  return {
    underReview: entries.filter((e) => e.impact_type === "Under Review"),
    wasteful: entries.filter((e) => e.impact_type === "Wasteful"),
    pending: entries.filter((e) => e.payment_status === "pending" || e.payment_status === "partial"),
    missingReceipts: entries.filter((e) => e.receipt_status === "Missing" || e.receipt_status === "Invoice Pending"),
  };
}

export async function getExpenseTrend(months: string[]) {
  if (!months.length) return [];
  const { data, error } = await supabase.from(T_ENT as any).select("month, amount_in_inr, entry_status, is_deleted").in("month", months).eq("is_deleted", false);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  return months.map((m) => ({
    month: m,
    total: rows.filter((r) => r.month === m && r.entry_status === "active").reduce((a, b) => a + Number(b.amount_in_inr || 0), 0),
  }));
}

// ── Legacy salary/shared (BACK-COMPAT) — still used by old code paths ──
export type TeamSalaryExpense = {
  id: string; month: string; team_member_name: string; role: string | null;
  salary_amount: number; payment_date: string | null;
  payment_status: "paid" | "pending" | "partial"; notes: string | null; is_deleted?: boolean;
};
export type SharedExpense = {
  id: string; month: string; category: string; amount: number;
  expense_date: string | null; description: string | null; paid_by: string | null; is_deleted?: boolean;
};
export const SHARED_EXPENSE_CATEGORIES = [
  "Software & Tools", "Office & Operations", "Sales / Calling Cost",
  "Freelancer / Contractor", "Ad Management Cost", "Travel & Meetings", "Miscellaneous",
];
export const SALARY_PAYMENT_STATUSES = ["paid", "pending", "partial"];
const T_SAL = "marketizers_team_salary_expenses";
const T_SHE = "marketizers_shared_expenses";

export async function getTeamSalaryExpenses(month?: string): Promise<TeamSalaryExpense[]> {
  let q = supabase.from(T_SAL as any).select("*").eq("is_deleted", false).order("created_at", { ascending: false });
  if (month) q = q.eq("month", month);
  const { data, error } = await q; if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TeamSalaryExpense[];
}
export async function createTeamSalaryExpense(p: Partial<TeamSalaryExpense>) {
  const { error } = await supabase.from(T_SAL as any).insert(p); if (error) throw new Error(error.message);
}
export async function updateTeamSalaryExpense(id: string, p: Partial<TeamSalaryExpense>) {
  const { error } = await supabase.from(T_SAL as any).update(p).eq("id", id); if (error) throw new Error(error.message);
}
export async function softDeleteTeamSalaryExpense(id: string) {
  const { error } = await supabase.from(T_SAL as any).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function getSharedExpenses(month?: string): Promise<SharedExpense[]> {
  let q = supabase.from(T_SHE as any).select("*").eq("is_deleted", false).order("created_at", { ascending: false });
  if (month) q = q.eq("month", month);
  const { data, error } = await q; if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SharedExpense[];
}
export async function createSharedExpense(p: Partial<SharedExpense>) {
  const { error } = await supabase.from(T_SHE as any).insert(p); if (error) throw new Error(error.message);
}
export async function updateSharedExpense(id: string, p: Partial<SharedExpense>) {
  const { error } = await supabase.from(T_SHE as any).update(p).eq("id", id); if (error) throw new Error(error.message);
}
export async function softDeleteSharedExpense(id: string) {
  const { error } = await supabase.from(T_SHE as any).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
