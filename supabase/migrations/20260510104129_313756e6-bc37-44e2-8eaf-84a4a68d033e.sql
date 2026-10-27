
-- ============================================================
-- Marketizers Expenses Center
-- ============================================================

-- Helper: updated_at trigger reuses existing public.set_updated_at()

-- ── Table 1: master options ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketizers_expense_master_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type text NOT NULL,
  label text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mz_master_option_label
  ON public.marketizers_expense_master_options (option_type, lower(label))
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mz_master_option_type ON public.marketizers_expense_master_options(option_type) WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_mz_master_options_updated ON public.marketizers_expense_master_options;
CREATE TRIGGER trg_mz_master_options_updated BEFORE UPDATE ON public.marketizers_expense_master_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Table 2: templates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketizers_expense_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name text NOT NULL,
  expense_type text NOT NULL DEFAULT 'one_time',
  category text NOT NULL,
  expense_scope text NOT NULL DEFAULT 'Company-Wide',
  client_id uuid REFERENCES public.marketizers_clients(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  conversion_rate numeric,
  amount_in_inr numeric NOT NULL DEFAULT 0,
  vendor_or_tool text,
  employee_name text,
  role text,
  department text,
  freelancer_name text,
  platform text,
  purpose text,
  payment_mode text,
  payment_handler text,
  impact_type text,
  receipt_status text,
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_start_month text,
  recurring_end_month text,
  recurring_period_start_day integer NOT NULL DEFAULT 1,
  recurring_period_end_day integer NOT NULL DEFAULT 30,
  payment_day integer,
  template_status text NOT NULL DEFAULT 'active',
  review_status text NOT NULL DEFAULT 'Needed',
  cancellation_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS idx_mz_tpl_recurring ON public.marketizers_expense_templates(is_recurring, template_status) WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_mz_tpl_updated ON public.marketizers_expense_templates;
CREATE TRIGGER trg_mz_tpl_updated BEFORE UPDATE ON public.marketizers_expense_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Table 3: entries (main ledger) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketizers_expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.marketizers_expense_templates(id),
  month text NOT NULL,
  expense_date date,
  expense_name text NOT NULL,
  expense_type text NOT NULL DEFAULT 'one_time',
  category text NOT NULL,
  expense_scope text NOT NULL DEFAULT 'Company-Wide',
  client_id uuid REFERENCES public.marketizers_clients(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  conversion_rate numeric,
  amount_in_inr numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_mode text,
  payment_handler text,
  vendor_or_tool text,
  employee_name text,
  role text,
  department text,
  freelancer_name text,
  platform text,
  purpose text,
  impact_type text,
  receipt_status text,
  receipt_url text,
  notes text,
  is_generated_from_recurring boolean NOT NULL DEFAULT false,
  recurring_period_start_day integer,
  recurring_period_end_day integer,
  payment_day integer,
  entry_status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mz_entry_template_month
  ON public.marketizers_expense_entries(template_id, month)
  WHERE template_id IS NOT NULL AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mz_entry_month ON public.marketizers_expense_entries(month) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mz_entry_category ON public.marketizers_expense_entries(category) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mz_entry_scope ON public.marketizers_expense_entries(expense_scope) WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_mz_entry_updated ON public.marketizers_expense_entries;
CREATE TRIGGER trg_mz_entry_updated BEFORE UPDATE ON public.marketizers_expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Table 4: monthly closures ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketizers_expense_monthly_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE,
  total_expenses numeric NOT NULL DEFAULT 0,
  recurring_expenses numeric NOT NULL DEFAULT 0,
  one_time_expenses numeric NOT NULL DEFAULT 0,
  client_specific_expenses numeric NOT NULL DEFAULT 0,
  company_wide_expenses numeric NOT NULL DEFAULT 0,
  team_salary_expenses numeric NOT NULL DEFAULT 0,
  tools_expenses numeric NOT NULL DEFAULT 0,
  pending_expenses numeric NOT NULL DEFAULT 0,
  missing_receipts_count integer NOT NULL DEFAULT 0,
  review_items_count integer NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

DROP TRIGGER IF EXISTS trg_mz_close_updated ON public.marketizers_expense_monthly_closures;
CREATE TRIGGER trg_mz_close_updated BEFORE UPDATE ON public.marketizers_expense_monthly_closures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.marketizers_expense_master_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_expense_monthly_closures ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'marketizers_expense_master_options',
    'marketizers_expense_templates',
    'marketizers_expense_entries',
    'marketizers_expense_monthly_closures'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "view" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "delete" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "view" ON public.%I FOR SELECT TO authenticated USING (private.can_view_marketizers_finance(auth.uid()))$p$, t);
    EXECUTE format($p$CREATE POLICY "insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.can_edit_marketizers_finance(auth.uid()))$p$, t);
    EXECUTE format($p$CREATE POLICY "update" ON public.%I FOR UPDATE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid())) WITH CHECK (private.can_edit_marketizers_finance(auth.uid()))$p$, t);
    EXECUTE format($p$CREATE POLICY "delete" ON public.%I FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))$p$, t);
  END LOOP;
END $$;

-- ── Seed master options ───────────────────────────────────────
INSERT INTO public.marketizers_expense_master_options (option_type, label, sort_order) VALUES
  ('category','Team Salaries',10),
  ('category','Software & Tools',20),
  ('category','Advertising / Internal Marketing',30),
  ('category','Freelancer / Contractor',40),
  ('category','Client-Specific Expense',50),
  ('category','Office & Operations',60),
  ('category','Sales / Calling Cost',70),
  ('category','Travel & Meetings',80),
  ('category','Miscellaneous',90),
  ('category','AI Tools',100),
  ('payment_status','paid',10),
  ('payment_status','pending',20),
  ('payment_status','partial',30),
  ('payment_status','skipped',40),
  ('payment_status','cancelled',50),
  ('payment_mode','Bank Transfer',10),
  ('payment_mode','UPI',20),
  ('payment_mode','Credit Card',30),
  ('payment_mode','Cash',40),
  ('payment_mode','Other',50),
  ('expense_scope','Company-Wide',10),
  ('expense_scope','Client-Specific',20),
  ('expense_scope','Team-Specific',30),
  ('expense_scope','Tool-Specific',40),
  ('impact_type','Essential',10),
  ('impact_type','Growth',20),
  ('impact_type','Operational',30),
  ('impact_type','Wasteful',40),
  ('impact_type','Under Review',50),
  ('role','Senior Media Buyer',10),
  ('role','Client Manager',20),
  ('role','Sales Caller',30),
  ('role','Video Editor',40),
  ('role','Designer',50),
  ('role','Operations Executive',60),
  ('department','Performance',10),
  ('department','Operations',20),
  ('department','Sales',30),
  ('department','Creative',40),
  ('department','Finance',50),
  ('platform','Meta Ads',10),
  ('platform','Google Ads',20),
  ('platform','YouTube Ads',30),
  ('platform','Other',40),
  ('receipt_status','Available',10),
  ('receipt_status','Missing',20),
  ('receipt_status','Invoice Pending',30),
  ('receipt_status','Not Required',40)
ON CONFLICT DO NOTHING;

-- ── Migrate legacy salary rows (idempotent) ───────────────────
INSERT INTO public.marketizers_expense_entries (
  month, expense_date, expense_name, expense_type, category, expense_scope,
  amount, currency, amount_in_inr, payment_status, payment_handler,
  employee_name, role, notes, metadata
)
SELECT
  s.month, s.payment_date, COALESCE(s.team_member_name,'Unknown') || ' Salary',
  'recurring', 'Team Salaries', 'Team-Specific',
  COALESCE(s.salary_amount,0), 'INR', COALESCE(s.salary_amount,0),
  COALESCE(s.payment_status,'paid'), 'Finance Team',
  s.team_member_name, s.role, s.notes,
  jsonb_build_object('source_table','marketizers_team_salary_expenses','source_id', s.id)
FROM public.marketizers_team_salary_expenses s
WHERE COALESCE(s.is_deleted,false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.marketizers_expense_entries e
    WHERE e.metadata->>'source_table' = 'marketizers_team_salary_expenses'
      AND e.metadata->>'source_id' = s.id::text
  );

-- ── Migrate legacy shared rows (idempotent) ───────────────────
INSERT INTO public.marketizers_expense_entries (
  month, expense_date, expense_name, expense_type, category, expense_scope,
  amount, currency, amount_in_inr, payment_status, payment_handler,
  notes, metadata
)
SELECT
  s.month, s.expense_date, COALESCE(s.category,'Misc') || ' Expense',
  'one_time', COALESCE(s.category,'Miscellaneous'), 'Company-Wide',
  COALESCE(s.amount,0), 'INR', COALESCE(s.amount,0),
  'paid', s.paid_by, s.description,
  jsonb_build_object('source_table','marketizers_shared_expenses','source_id', s.id)
FROM public.marketizers_shared_expenses s
WHERE COALESCE(s.is_deleted,false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.marketizers_expense_entries e
    WHERE e.metadata->>'source_table' = 'marketizers_shared_expenses'
      AND e.metadata->>'source_id' = s.id::text
  );
