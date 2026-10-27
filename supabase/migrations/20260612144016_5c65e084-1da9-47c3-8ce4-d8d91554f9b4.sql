
CREATE TABLE public.delegation_monthly_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL,
  award_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  reward_label TEXT,
  frozen_by UUID,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, award_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegation_monthly_awards TO authenticated;
GRANT ALL ON public.delegation_monthly_awards TO service_role;

ALTER TABLE public.delegation_monthly_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dma_select" ON public.delegation_monthly_awards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dma_insert" ON public.delegation_monthly_awards
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dma_update" ON public.delegation_monthly_awards
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dma_delete" ON public.delegation_monthly_awards
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
