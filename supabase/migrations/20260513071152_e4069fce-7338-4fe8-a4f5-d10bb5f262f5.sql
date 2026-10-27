
-- 1. Relax check constraints
ALTER TABLE public.marketizers_clients DROP CONSTRAINT IF EXISTS marketizers_clients_revenue_model_chk;
ALTER TABLE public.marketizers_clients DROP CONSTRAINT IF EXISTS marketizers_clients_status_chk;

-- 2. Add new optional columns
ALTER TABLE public.marketizers_clients
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS social_url text,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS client_stage text,
  ADD COLUMN IF NOT EXISTS monthly_retainer_amount numeric,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS billing_date text,
  ADD COLUMN IF NOT EXISTS collection_due_date text,
  ADD COLUMN IF NOT EXISTS gst_applicable boolean,
  ADD COLUMN IF NOT EXISTS revenue_share_percentage numeric,
  ADD COLUMN IF NOT EXISTS revenue_base text,
  ADD COLUMN IF NOT EXISTS settlement_frequency text,
  ADD COLUMN IF NOT EXISTS minimum_guarantee numeric,
  ADD COLUMN IF NOT EXISTS revenue_tracking_source text,
  ADD COLUMN IF NOT EXISTS base_retainer_amount numeric,
  ADD COLUMN IF NOT EXISTS bonus_trigger text,
  ADD COLUMN IF NOT EXISTS trigger_target_value numeric,
  ADD COLUMN IF NOT EXISTS bonus_type text,
  ADD COLUMN IF NOT EXISTS bonus_amount numeric,
  ADD COLUMN IF NOT EXISTS metric_used text,
  ADD COLUMN IF NOT EXISTS setup_fee numeric,
  ADD COLUMN IF NOT EXISTS setup_payment_status text,
  ADD COLUMN IF NOT EXISTS setup_delivery_deadline date,
  ADD COLUMN IF NOT EXISTS setup_scope text,
  ADD COLUMN IF NOT EXISTS trial_duration text,
  ADD COLUMN IF NOT EXISTS trial_fee numeric,
  ADD COLUMN IF NOT EXISTS trial_end_date date,
  ADD COLUMN IF NOT EXISTS trial_conversion_plan text,
  ADD COLUMN IF NOT EXISTS custom_revenue_terms text,
  ADD COLUMN IF NOT EXISTS expected_monthly_revenue numeric,
  ADD COLUMN IF NOT EXISTS billing_notes text,
  ADD COLUMN IF NOT EXISTS account_owner text,
  ADD COLUMN IF NOT EXISTS media_buyer text,
  ADD COLUMN IF NOT EXISTS sales_owner text,
  ADD COLUMN IF NOT EXISTS client_risk text,
  ADD COLUMN IF NOT EXISTS payment_risk text,
  ADD COLUMN IF NOT EXISTS important_reminder text;

-- 3. Quick-save options table
CREATE TABLE IF NOT EXISTS public.marketizers_quick_save_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_group text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  metadata jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketizers_qs_options_group_value_uq
  ON public.marketizers_quick_save_options (option_group, lower(value))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS marketizers_qs_options_group_idx
  ON public.marketizers_quick_save_options (option_group, is_active);

ALTER TABLE public.marketizers_quick_save_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance viewers can read qs options" ON public.marketizers_quick_save_options;
CREATE POLICY "Finance viewers can read qs options"
  ON public.marketizers_quick_save_options FOR SELECT
  TO authenticated
  USING (private.can_view_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "Finance editors can insert qs options" ON public.marketizers_quick_save_options;
CREATE POLICY "Finance editors can insert qs options"
  ON public.marketizers_quick_save_options FOR INSERT
  TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "Admins can update qs options" ON public.marketizers_quick_save_options;
CREATE POLICY "Admins can update qs options"
  ON public.marketizers_quick_save_options FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete qs options" ON public.marketizers_quick_save_options;
CREATE POLICY "Admins can delete qs options"
  ON public.marketizers_quick_save_options FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_mz_qs_options_updated ON public.marketizers_quick_save_options;
CREATE TRIGGER trg_mz_qs_options_updated
  BEFORE UPDATE ON public.marketizers_quick_save_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
