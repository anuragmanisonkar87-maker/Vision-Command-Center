
ALTER TABLE public.gwv_team_members
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS salary_amount numeric,
  ADD COLUMN IF NOT EXISTS salary_currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS expense_category text,
  ADD COLUMN IF NOT EXISTS auto_add_to_expenses boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gwv_team_brand_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.gwv_team_members(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.gwv_brands(id) ON DELETE CASCADE,
  percentage numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, brand_id)
);

ALTER TABLE public.gwv_team_brand_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tba_admin ON public.gwv_team_brand_allocations;
CREATE POLICY tba_admin ON public.gwv_team_brand_allocations
  FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid()))
  WITH CHECK (private.can_manage_team_access(auth.uid()));

DROP POLICY IF EXISTS tba_self_read ON public.gwv_team_brand_allocations;
CREATE POLICY tba_self_read ON public.gwv_team_brand_allocations
  FOR SELECT TO authenticated
  USING (team_member_id = private.current_team_member_id());

CREATE INDEX IF NOT EXISTS idx_tba_member ON public.gwv_team_brand_allocations(team_member_id);
CREATE INDEX IF NOT EXISTS idx_tba_brand ON public.gwv_team_brand_allocations(brand_id);

DROP TRIGGER IF EXISTS tr_tba_updated ON public.gwv_team_brand_allocations;
CREATE TRIGGER tr_tba_updated BEFORE UPDATE ON public.gwv_team_brand_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
