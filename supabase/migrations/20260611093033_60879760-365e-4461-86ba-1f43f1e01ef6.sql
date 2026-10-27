
CREATE TABLE IF NOT EXISTS public.marketizers_ledger_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_type TEXT NOT NULL CHECK (category_type IN ('income','expense')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketizers_ledger_categories_type_lower_name_uq
  ON public.marketizers_ledger_categories (category_type, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_ledger_categories TO authenticated;
GRANT ALL ON public.marketizers_ledger_categories TO service_role;

ALTER TABLE public.marketizers_ledger_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_categories_read"
  ON public.marketizers_ledger_categories
  FOR SELECT TO authenticated
  USING (
    private.is_active(auth.uid()) AND (
      private.has_role(auth.uid(),'admin'::app_role)
      OR private.can_view_marketizers_finance(auth.uid())
    )
  );

CREATE POLICY "ledger_categories_write"
  ON public.marketizers_ledger_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_active(auth.uid()) AND (
      private.has_role(auth.uid(),'admin'::app_role)
      OR private.can_edit_marketizers_finance(auth.uid())
    )
  );

CREATE POLICY "ledger_categories_update"
  ON public.marketizers_ledger_categories
  FOR UPDATE TO authenticated
  USING (
    private.is_active(auth.uid()) AND (
      private.has_role(auth.uid(),'admin'::app_role)
      OR private.can_edit_marketizers_finance(auth.uid())
    )
  )
  WITH CHECK (
    private.is_active(auth.uid()) AND (
      private.has_role(auth.uid(),'admin'::app_role)
      OR private.can_edit_marketizers_finance(auth.uid())
    )
  );

CREATE POLICY "ledger_categories_delete"
  ON public.marketizers_ledger_categories
  FOR DELETE TO authenticated
  USING (
    private.is_active(auth.uid()) AND private.has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER trg_marketizers_ledger_categories_updated_at
  BEFORE UPDATE ON public.marketizers_ledger_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
