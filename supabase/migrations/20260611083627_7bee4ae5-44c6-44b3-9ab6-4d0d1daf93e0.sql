-- Restrict gwv_company_positions reads to active users or admins
DROP POLICY IF EXISTS pos_read ON public.gwv_company_positions;
CREATE POLICY pos_read ON public.gwv_company_positions
  FOR SELECT
  USING (
    (is_deleted = false AND private.is_active(auth.uid()))
    OR private.has_role(auth.uid(), 'admin')
  );

-- Restrict ROAS quick-save options reads to Marketizers finance viewers
DROP POLICY IF EXISTS "view roas quick save" ON public.marketizers_roas_quick_save_options;
CREATE POLICY "view roas quick save" ON public.marketizers_roas_quick_save_options
  FOR SELECT
  USING (
    is_active = true
    AND private.can_view_marketizers_finance(auth.uid())
  );
