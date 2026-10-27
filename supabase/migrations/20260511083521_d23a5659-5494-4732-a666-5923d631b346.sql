
-- Recreate is_active in the private schema (matches has_role pattern).
CREATE OR REPLACE FUNCTION private.is_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION private.is_active(uuid) FROM PUBLIC;

-- Repoint every policy that referenced public.is_active.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'daily_lead_reports','daily_lead_report_media_buyers','daily_lead_report_ad_accounts',
    'daily_lead_source_mappings','daily_metric_templates','daily_custom_metrics','quick_save_entries'
  ]) LOOP
    -- nothing to do here; we will recreate per-table below
    NULL;
  END LOOP;
END $$;

-- Drop and recreate the policies that reference public.is_active.
-- daily_lead_reports
DROP POLICY IF EXISTS dlr_read ON public.daily_lead_reports;
DROP POLICY IF EXISTS dlr_insert ON public.daily_lead_reports;
DROP POLICY IF EXISTS dlr_update_own ON public.daily_lead_reports;
DROP POLICY IF EXISTS dlr_delete_own ON public.daily_lead_reports;
CREATE POLICY dlr_read ON public.daily_lead_reports FOR SELECT TO authenticated USING (private.is_active(auth.uid()));
CREATE POLICY dlr_insert ON public.daily_lead_reports FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlr_update_own ON public.daily_lead_reports FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid()) WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlr_delete_own ON public.daily_lead_reports FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid());

-- daily_lead_report_media_buyers
DROP POLICY IF EXISTS dlrmb_read ON public.daily_lead_report_media_buyers;
DROP POLICY IF EXISTS dlrmb_insert ON public.daily_lead_report_media_buyers;
DROP POLICY IF EXISTS dlrmb_update ON public.daily_lead_report_media_buyers;
DROP POLICY IF EXISTS dlrmb_delete ON public.daily_lead_report_media_buyers;
CREATE POLICY dlrmb_read ON public.daily_lead_report_media_buyers FOR SELECT TO authenticated USING (private.is_active(auth.uid()));
CREATE POLICY dlrmb_insert ON public.daily_lead_report_media_buyers FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid()));
CREATE POLICY dlrmb_update ON public.daily_lead_report_media_buyers FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid())) WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY dlrmb_delete ON public.daily_lead_report_media_buyers FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid()));

-- daily_lead_report_ad_accounts
DROP POLICY IF EXISTS dlraa_read ON public.daily_lead_report_ad_accounts;
DROP POLICY IF EXISTS dlraa_insert ON public.daily_lead_report_ad_accounts;
DROP POLICY IF EXISTS dlraa_update ON public.daily_lead_report_ad_accounts;
DROP POLICY IF EXISTS dlraa_delete ON public.daily_lead_report_ad_accounts;
CREATE POLICY dlraa_read ON public.daily_lead_report_ad_accounts FOR SELECT TO authenticated USING (private.is_active(auth.uid()));
CREATE POLICY dlraa_insert ON public.daily_lead_report_ad_accounts FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_report_media_buyers mb JOIN public.daily_lead_reports r ON r.id = mb.report_id WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid()));
CREATE POLICY dlraa_update ON public.daily_lead_report_ad_accounts FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_report_media_buyers mb JOIN public.daily_lead_reports r ON r.id = mb.report_id WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid())) WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY dlraa_delete ON public.daily_lead_report_ad_accounts FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND EXISTS (SELECT 1 FROM public.daily_lead_report_media_buyers mb JOIN public.daily_lead_reports r ON r.id = mb.report_id WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid()));

-- daily_lead_source_mappings
DROP POLICY IF EXISTS dlsm_read ON public.daily_lead_source_mappings;
DROP POLICY IF EXISTS dlsm_insert ON public.daily_lead_source_mappings;
DROP POLICY IF EXISTS dlsm_update_own ON public.daily_lead_source_mappings;
DROP POLICY IF EXISTS dlsm_delete_own ON public.daily_lead_source_mappings;
CREATE POLICY dlsm_read ON public.daily_lead_source_mappings FOR SELECT TO authenticated USING (private.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dlsm_insert ON public.daily_lead_source_mappings FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlsm_update_own ON public.daily_lead_source_mappings FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid()) WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlsm_delete_own ON public.daily_lead_source_mappings FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid());

-- daily_metric_templates
DROP POLICY IF EXISTS dmt_read ON public.daily_metric_templates;
DROP POLICY IF EXISTS dmt_insert ON public.daily_metric_templates;
DROP POLICY IF EXISTS dmt_update_own ON public.daily_metric_templates;
DROP POLICY IF EXISTS dmt_delete_own ON public.daily_metric_templates;
CREATE POLICY dmt_read ON public.daily_metric_templates FOR SELECT TO authenticated USING (private.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dmt_insert ON public.daily_metric_templates FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY dmt_update_own ON public.daily_metric_templates FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid()) WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dmt_delete_own ON public.daily_metric_templates FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid());

-- daily_custom_metrics
DROP POLICY IF EXISTS dcm_read ON public.daily_custom_metrics;
DROP POLICY IF EXISTS dcm_insert ON public.daily_custom_metrics;
DROP POLICY IF EXISTS dcm_update_own ON public.daily_custom_metrics;
DROP POLICY IF EXISTS dcm_delete_own ON public.daily_custom_metrics;
CREATE POLICY dcm_read ON public.daily_custom_metrics FOR SELECT TO authenticated USING (private.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dcm_insert ON public.daily_custom_metrics FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY dcm_update_own ON public.daily_custom_metrics FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid()) WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dcm_delete_own ON public.daily_custom_metrics FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid());

-- quick_save_entries
DROP POLICY IF EXISTS qse_read ON public.quick_save_entries;
DROP POLICY IF EXISTS qse_insert ON public.quick_save_entries;
DROP POLICY IF EXISTS qse_update_own ON public.quick_save_entries;
DROP POLICY IF EXISTS qse_delete_own ON public.quick_save_entries;
CREATE POLICY qse_read ON public.quick_save_entries FOR SELECT TO authenticated USING (private.is_active(auth.uid()) AND is_active = true);
CREATE POLICY qse_insert ON public.quick_save_entries FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY qse_update_own ON public.quick_save_entries FOR UPDATE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid()) WITH CHECK (private.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY qse_delete_own ON public.quick_save_entries FOR DELETE TO authenticated USING (private.is_active(auth.uid()) AND created_by = auth.uid());

-- Drop the public version (now unused).
DROP FUNCTION IF EXISTS public.is_active(uuid);

-- Also move purge function to private schema.
CREATE OR REPLACE FUNCTION private.purge_old_deleted_daily_reports()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '14 days';
  daily_ids uuid[];
  mb_ids uuid[];
  daily_count int := 0;
BEGIN
  SELECT array_agg(id) INTO daily_ids FROM public.daily_lead_reports
  WHERE is_deleted = true AND deleted_at IS NOT NULL AND deleted_at < cutoff;
  IF daily_ids IS NOT NULL AND array_length(daily_ids, 1) > 0 THEN
    SELECT array_agg(id) INTO mb_ids FROM public.daily_lead_report_media_buyers WHERE report_id = ANY(daily_ids);
    IF mb_ids IS NOT NULL AND array_length(mb_ids, 1) > 0 THEN
      DELETE FROM public.daily_lead_report_ad_accounts WHERE report_media_buyer_id = ANY(mb_ids);
    END IF;
    DELETE FROM public.daily_lead_report_media_buyers WHERE report_id = ANY(daily_ids);
    DELETE FROM public.daily_lead_reports WHERE id = ANY(daily_ids);
    daily_count := COALESCE(array_length(daily_ids, 1), 0);
  END IF;
  RETURN jsonb_build_object('daily_purged', daily_count, 'cutoff', cutoff);
END $$;
REVOKE EXECUTE ON FUNCTION private.purge_old_deleted_daily_reports() FROM PUBLIC;
DROP FUNCTION IF EXISTS public.purge_old_deleted_daily_reports();
