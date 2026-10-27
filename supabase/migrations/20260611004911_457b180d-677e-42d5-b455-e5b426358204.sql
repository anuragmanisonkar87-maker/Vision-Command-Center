
DROP POLICY IF EXISTS "owner insert mapping templates" ON public.marketizers_ledger_import_mapping_templates;
DROP POLICY IF EXISTS "owner update mapping templates" ON public.marketizers_ledger_import_mapping_templates;
DROP POLICY IF EXISTS "owner delete mapping templates" ON public.marketizers_ledger_import_mapping_templates;

CREATE POLICY "finance owner insert mapping templates"
  ON public.marketizers_ledger_import_mapping_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_edit_marketizers_finance(auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "finance owner update mapping templates"
  ON public.marketizers_ledger_import_mapping_templates
  FOR UPDATE TO authenticated
  USING (
    private.can_edit_marketizers_finance(auth.uid())
    AND user_id = auth.uid()
  )
  WITH CHECK (
    private.can_edit_marketizers_finance(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "finance owner delete mapping templates"
  ON public.marketizers_ledger_import_mapping_templates
  FOR DELETE TO authenticated
  USING (
    private.can_edit_marketizers_finance(auth.uid())
    AND user_id = auth.uid()
  );
