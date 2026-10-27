CREATE TABLE IF NOT EXISTS public.delegation_monthly_appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  user_id uuid NOT NULL,
  report_json jsonb NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  grade text NOT NULL DEFAULT 'Needs Attention',
  frozen_by uuid,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegation_monthly_appraisals TO authenticated;
GRANT ALL ON public.delegation_monthly_appraisals TO service_role;

ALTER TABLE public.delegation_monthly_appraisals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dma_appraisal_select"
  ON public.delegation_monthly_appraisals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dma_appraisal_insert"
  ON public.delegation_monthly_appraisals
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dma_appraisal_update"
  ON public.delegation_monthly_appraisals
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dma_appraisal_delete"
  ON public.delegation_monthly_appraisals
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS delegation_monthly_appraisals_month_idx
  ON public.delegation_monthly_appraisals (month);
CREATE INDEX IF NOT EXISTS delegation_monthly_appraisals_user_idx
  ON public.delegation_monthly_appraisals (user_id);
