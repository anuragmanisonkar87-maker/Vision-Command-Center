
-- Import batches: replace open policies with finance-role gating
DROP POLICY IF EXISTS "auth read import batches" ON public.marketizers_client_ledger_import_batches;
DROP POLICY IF EXISTS "auth insert import batches" ON public.marketizers_client_ledger_import_batches;
DROP POLICY IF EXISTS "auth update import batches" ON public.marketizers_client_ledger_import_batches;

CREATE POLICY "finance read import batches"
  ON public.marketizers_client_ledger_import_batches
  FOR SELECT TO authenticated
  USING (private.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "finance insert import batches"
  ON public.marketizers_client_ledger_import_batches
  FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "finance update import batches"
  ON public.marketizers_client_ledger_import_batches
  FOR UPDATE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

-- Mapping templates: restrict reads to finance viewers or template owner
DROP POLICY IF EXISTS "auth read mapping templates" ON public.marketizers_ledger_import_mapping_templates;

CREATE POLICY "finance or owner read mapping templates"
  ON public.marketizers_ledger_import_mapping_templates
  FOR SELECT TO authenticated
  USING (
    private.can_view_marketizers_finance(auth.uid())
    OR user_id = auth.uid()
  );
