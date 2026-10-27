
CREATE TABLE public.marketizers_ledger_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('income','expense','both')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX marketizers_ledger_sources_type_name_idx
  ON public.marketizers_ledger_sources (source_type, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_ledger_sources TO authenticated;
GRANT ALL ON public.marketizers_ledger_sources TO service_role;

ALTER TABLE public.marketizers_ledger_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_sources_read ON public.marketizers_ledger_sources
  FOR SELECT TO authenticated
  USING (private.is_active(auth.uid()) AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_view_marketizers_finance(auth.uid())));

CREATE POLICY ledger_sources_write ON public.marketizers_ledger_sources
  FOR INSERT TO authenticated
  WITH CHECK (private.is_active(auth.uid()) AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_marketizers_finance(auth.uid())));

CREATE POLICY ledger_sources_update ON public.marketizers_ledger_sources
  FOR UPDATE TO authenticated
  USING (private.is_active(auth.uid()) AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_marketizers_finance(auth.uid())))
  WITH CHECK (private.is_active(auth.uid()) AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_marketizers_finance(auth.uid())));

CREATE POLICY ledger_sources_delete ON public.marketizers_ledger_sources
  FOR DELETE TO authenticated
  USING (private.is_active(auth.uid()) AND private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_marketizers_ledger_sources_updated_at
  BEFORE UPDATE ON public.marketizers_ledger_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
