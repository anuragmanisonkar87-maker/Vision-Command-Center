
CREATE TABLE IF NOT EXISTS public.marketizers_team_salary_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  team_member_name text NOT NULL,
  role text,
  salary_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_status text NOT NULL DEFAULT 'paid',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.marketizers_shared_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date,
  description text,
  paid_by text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE public.marketizers_team_salary_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_shared_expenses ENABLE ROW LEVEL SECURITY;

-- team_salary policies
CREATE POLICY "Finance viewers can read salaries" ON public.marketizers_team_salary_expenses
  FOR SELECT TO authenticated USING (private.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "Finance editors can insert salaries" ON public.marketizers_team_salary_expenses
  FOR INSERT TO authenticated WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "Finance editors can update salaries" ON public.marketizers_team_salary_expenses
  FOR UPDATE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "Admins can delete salaries" ON public.marketizers_team_salary_expenses
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

-- shared_expenses policies
CREATE POLICY "Finance viewers can read shared expenses" ON public.marketizers_shared_expenses
  FOR SELECT TO authenticated USING (private.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "Finance editors can insert shared expenses" ON public.marketizers_shared_expenses
  FOR INSERT TO authenticated WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "Finance editors can update shared expenses" ON public.marketizers_shared_expenses
  FOR UPDATE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "Admins can delete shared expenses" ON public.marketizers_shared_expenses
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tr_msal_updated BEFORE UPDATE ON public.marketizers_team_salary_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_mshe_updated BEFORE UPDATE ON public.marketizers_shared_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_msal_month ON public.marketizers_team_salary_expenses(month) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mshe_month ON public.marketizers_shared_expenses(month) WHERE is_deleted = false;
