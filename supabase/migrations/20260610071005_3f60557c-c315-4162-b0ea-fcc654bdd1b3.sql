
-- 1) Fix ROAS quick-save INSERT policy: require finance-edit permission
DROP POLICY IF EXISTS "insert roas quick save" ON public.marketizers_roas_quick_save_options;
CREATE POLICY "insert roas quick save" ON public.marketizers_roas_quick_save_options
  FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

-- 2) Rewrite the UPDATE/DELETE/SELECT policies on this table to use private.* as well
DROP POLICY IF EXISTS "delete roas quick save" ON public.marketizers_roas_quick_save_options;
CREATE POLICY "delete roas quick save" ON public.marketizers_roas_quick_save_options
  FOR DELETE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "update roas quick save" ON public.marketizers_roas_quick_save_options;
CREATE POLICY "update roas quick save" ON public.marketizers_roas_quick_save_options
  FOR UPDATE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

-- 3) Migrate every remaining policy that references unqualified has_role / can_*_marketizers_finance
--    to call the private.* schema versions. This lets us drop the publicly-executable SECURITY DEFINER
--    duplicates in public schema.

-- gwv_company_positions
DROP POLICY IF EXISTS pos_read ON public.gwv_company_positions;
CREATE POLICY pos_read ON public.gwv_company_positions FOR SELECT TO authenticated
  USING ((is_deleted = false) OR private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS pos_write ON public.gwv_company_positions;
CREATE POLICY pos_write ON public.gwv_company_positions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role));

-- gwv_hr_candidate_pool
DROP POLICY IF EXISTS pool_read ON public.gwv_hr_candidate_pool;
CREATE POLICY pool_read ON public.gwv_hr_candidate_pool FOR SELECT TO authenticated
  USING ((is_deleted = false) AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role)));
DROP POLICY IF EXISTS pool_write ON public.gwv_hr_candidate_pool;
CREATE POLICY pool_write ON public.gwv_hr_candidate_pool FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role));

-- gwv_hr_daily_reports
DROP POLICY IF EXISTS rep_delete ON public.gwv_hr_daily_reports;
CREATE POLICY rep_delete ON public.gwv_hr_daily_reports FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS rep_insert ON public.gwv_hr_daily_reports;
CREATE POLICY rep_insert ON public.gwv_hr_daily_reports FOR INSERT TO authenticated
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
              AND ((hr_user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS rep_read ON public.gwv_hr_daily_reports;
CREATE POLICY rep_read ON public.gwv_hr_daily_reports FOR SELECT TO authenticated
  USING ((is_deleted = false) AND (private.has_role(auth.uid(), 'admin'::app_role) OR (hr_user_id = auth.uid())));
DROP POLICY IF EXISTS rep_update ON public.gwv_hr_daily_reports;
CREATE POLICY rep_update ON public.gwv_hr_daily_reports FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR (hr_user_id = auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR (hr_user_id = auth.uid()));

-- gwv_hr_hiring_requirements
DROP POLICY IF EXISTS req_read ON public.gwv_hr_hiring_requirements;
CREATE POLICY req_read ON public.gwv_hr_hiring_requirements FOR SELECT TO authenticated
  USING ((is_deleted = false) AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'hr'::app_role)
    OR private.has_role(auth.uid(), 'brand_manager'::app_role)
    OR (assigned_to_user_id = auth.uid())
    OR (created_by = auth.uid())));
DROP POLICY IF EXISTS req_write ON public.gwv_hr_hiring_requirements;
CREATE POLICY req_write ON public.gwv_hr_hiring_requirements FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role));

-- gwv_hr_kpi_settings
DROP POLICY IF EXISTS kpi_admin_write ON public.gwv_hr_kpi_settings;
CREATE POLICY kpi_admin_write ON public.gwv_hr_kpi_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- gwv_hr_notifications
DROP POLICY IF EXISTS notif_read ON public.gwv_hr_notifications;
CREATE POLICY notif_read ON public.gwv_hr_notifications FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)
         OR (user_id = auth.uid())
         OR ((role_target = 'hr'::text) AND private.has_role(auth.uid(), 'hr'::app_role))
         OR ((role_target = 'admin'::text) AND private.has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS notif_write ON public.gwv_hr_notifications;
CREATE POLICY notif_write ON public.gwv_hr_notifications FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role));

-- gwv_hr_score_events
DROP POLICY IF EXISTS score_read ON public.gwv_hr_score_events;
CREATE POLICY score_read ON public.gwv_hr_score_events FOR SELECT TO authenticated
  USING ((is_deleted = false) AND (private.has_role(auth.uid(), 'admin'::app_role) OR (hr_user_id = auth.uid())));
DROP POLICY IF EXISTS score_write ON public.gwv_hr_score_events;
CREATE POLICY score_write ON public.gwv_hr_score_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'hr'::app_role));

-- gwv_hr_work_sessions
DROP POLICY IF EXISTS sess_read ON public.gwv_hr_work_sessions;
CREATE POLICY sess_read ON public.gwv_hr_work_sessions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid()));

-- marketizers_roas_audience_segments
DROP POLICY IF EXISTS "view roas segments" ON public.marketizers_roas_audience_segments;
CREATE POLICY "view roas segments" ON public.marketizers_roas_audience_segments FOR SELECT TO authenticated
  USING (private.can_view_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS "write roas segments" ON public.marketizers_roas_audience_segments;
CREATE POLICY "write roas segments" ON public.marketizers_roas_audience_segments FOR ALL TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

-- marketizers_roas_import_mappings
DROP POLICY IF EXISTS roas_map_delete ON public.marketizers_roas_import_mappings;
CREATE POLICY roas_map_delete ON public.marketizers_roas_import_mappings FOR DELETE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS roas_map_insert ON public.marketizers_roas_import_mappings;
CREATE POLICY roas_map_insert ON public.marketizers_roas_import_mappings FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS roas_map_update ON public.marketizers_roas_import_mappings;
CREATE POLICY roas_map_update ON public.marketizers_roas_import_mappings FOR UPDATE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS roas_map_view ON public.marketizers_roas_import_mappings;
CREATE POLICY roas_map_view ON public.marketizers_roas_import_mappings FOR SELECT TO authenticated
  USING ((is_deleted = false) AND private.can_view_marketizers_finance(auth.uid()));

-- marketizers_roas_sessions
DROP POLICY IF EXISTS "delete roas sessions" ON public.marketizers_roas_sessions;
CREATE POLICY "delete roas sessions" ON public.marketizers_roas_sessions FOR DELETE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS "insert roas sessions" ON public.marketizers_roas_sessions;
CREATE POLICY "insert roas sessions" ON public.marketizers_roas_sessions FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS "update roas sessions" ON public.marketizers_roas_sessions;
CREATE POLICY "update roas sessions" ON public.marketizers_roas_sessions FOR UPDATE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
DROP POLICY IF EXISTS "view roas sessions" ON public.marketizers_roas_sessions;
CREATE POLICY "view roas sessions" ON public.marketizers_roas_sessions FOR SELECT TO authenticated
  USING (private.can_view_marketizers_finance(auth.uid()));

-- 4) Drop the publicly-executable SECURITY DEFINER helpers from public schema.
--    The private.* equivalents remain and are used by all RLS policies.
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.can_view_marketizers_finance(uuid);
DROP FUNCTION IF EXISTS public.can_edit_marketizers_finance(uuid);
