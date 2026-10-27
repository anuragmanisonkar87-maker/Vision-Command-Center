
-- ============================================================
-- Daily Lead Reporting (Media Buyer Performance) for Marketizers
-- Ported from IPC Control Center
-- ============================================================

-- Helper: is the user an active member (has any role)?
CREATE OR REPLACE FUNCTION public.is_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

-- ============ daily_lead_reports ============
CREATE TABLE public.daily_lead_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name text,
  report_date date NOT NULL,
  notes text,
  metric_template_id uuid,
  total_ad_spend numeric NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  overall_cpl numeric NOT NULL DEFAULT 0,
  whatsapp_message text,
  input_hash text,
  report_status text NOT NULL DEFAULT 'saved',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_dlr_report_date ON public.daily_lead_reports(report_date);
CREATE INDEX idx_dlr_created_by ON public.daily_lead_reports(created_by);
CREATE INDEX idx_dlr_hash ON public.daily_lead_reports(input_hash);
ALTER TABLE public.daily_lead_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlr_admin ON public.daily_lead_reports FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dlr_read ON public.daily_lead_reports FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()));
CREATE POLICY dlr_insert ON public.daily_lead_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlr_update_own ON public.daily_lead_reports FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlr_delete_own ON public.daily_lead_reports FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid());

-- ============ daily_lead_report_media_buyers ============
CREATE TABLE public.daily_lead_report_media_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_lead_reports(id) ON DELETE CASCADE,
  media_buyer_name text NOT NULL,
  media_buyer_key text,
  lead_source_url text,
  spreadsheet_id text,
  spreadsheet_title text,
  tab_name text,
  sheet_id text,
  date_column text,
  total_leads integer NOT NULL DEFAULT 0,
  lead_count_source text NOT NULL DEFAULT 'google_sheet',
  is_manual_lead_override boolean NOT NULL DEFAULT false,
  total_ad_spend numeric NOT NULL DEFAULT 0,
  cpl numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready',
  fetch_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dlrmb_report_id ON public.daily_lead_report_media_buyers(report_id);
ALTER TABLE public.daily_lead_report_media_buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlrmb_admin ON public.daily_lead_report_media_buyers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dlrmb_read ON public.daily_lead_report_media_buyers FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()));
CREATE POLICY dlrmb_insert ON public.daily_lead_report_media_buyers FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid()
  ));
CREATE POLICY dlrmb_update ON public.daily_lead_report_media_buyers FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid()
  )) WITH CHECK (public.is_active(auth.uid()));
CREATE POLICY dlrmb_delete ON public.daily_lead_report_media_buyers FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_reports r WHERE r.id = report_id AND r.created_by = auth.uid()
  ));

-- ============ daily_lead_report_ad_accounts ============
CREATE TABLE public.daily_lead_report_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_media_buyer_id uuid NOT NULL REFERENCES public.daily_lead_report_media_buyers(id) ON DELETE CASCADE,
  ad_account_name text NOT NULL,
  ad_spend numeric NOT NULL DEFAULT 0,
  metrics jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dlraa_mb_id ON public.daily_lead_report_ad_accounts(report_media_buyer_id);
ALTER TABLE public.daily_lead_report_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlraa_admin ON public.daily_lead_report_ad_accounts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dlraa_read ON public.daily_lead_report_ad_accounts FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()));
CREATE POLICY dlraa_insert ON public.daily_lead_report_ad_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_report_media_buyers mb
    JOIN public.daily_lead_reports r ON r.id = mb.report_id
    WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid()
  ));
CREATE POLICY dlraa_update ON public.daily_lead_report_ad_accounts FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_report_media_buyers mb
    JOIN public.daily_lead_reports r ON r.id = mb.report_id
    WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid()
  )) WITH CHECK (public.is_active(auth.uid()));
CREATE POLICY dlraa_delete ON public.daily_lead_report_ad_accounts FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_report_media_buyers mb
    JOIN public.daily_lead_reports r ON r.id = mb.report_id
    WHERE mb.id = report_media_buyer_id AND r.created_by = auth.uid()
  ));

-- ============ daily_lead_source_mappings ============
CREATE TABLE public.daily_lead_source_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_buyer_name text NOT NULL,
  lead_source_name text,
  sheet_url text NOT NULL,
  spreadsheet_id text,
  spreadsheet_title text,
  tab_name text,
  sheet_id text,
  date_column text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_dlsm_mb_name ON public.daily_lead_source_mappings(media_buyer_name);
ALTER TABLE public.daily_lead_source_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlsm_admin ON public.daily_lead_source_mappings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dlsm_read ON public.daily_lead_source_mappings FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dlsm_insert ON public.daily_lead_source_mappings FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlsm_update_own ON public.daily_lead_source_mappings FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dlsm_delete_own ON public.daily_lead_source_mappings FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid());

-- ============ daily_metric_templates ============
CREATE TABLE public.daily_metric_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.daily_metric_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY dmt_admin ON public.daily_metric_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dmt_read ON public.daily_metric_templates FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dmt_insert ON public.daily_metric_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY dmt_update_own ON public.daily_metric_templates FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dmt_delete_own ON public.daily_metric_templates FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid());

-- ============ daily_custom_metrics ============
CREATE TABLE public.daily_custom_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_key text NOT NULL,
  metric_type text NOT NULL,
  aggregation_method text NOT NULL DEFAULT 'display_only',
  show_in_whatsapp boolean NOT NULL DEFAULT true,
  show_in_exports boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX idx_dcm_key ON public.daily_custom_metrics(metric_key) WHERE is_active = true;
ALTER TABLE public.daily_custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY dcm_admin ON public.daily_custom_metrics FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY dcm_read ON public.daily_custom_metrics FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()) AND is_active = true);
CREATE POLICY dcm_insert ON public.daily_custom_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY dcm_update_own ON public.daily_custom_metrics FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY dcm_delete_own ON public.daily_custom_metrics FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid());

-- ============ quick_save_entries ============
CREATE TABLE public.quick_save_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qse_field_key ON public.quick_save_entries(field_key) WHERE is_active = true;
CREATE UNIQUE INDEX idx_qse_unique_value ON public.quick_save_entries(field_key, lower(value)) WHERE is_active = true;
ALTER TABLE public.quick_save_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY qse_admin ON public.quick_save_entries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY qse_read ON public.quick_save_entries FOR SELECT TO authenticated
  USING (public.is_active(auth.uid()) AND is_active = true);
CREATE POLICY qse_insert ON public.quick_save_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY qse_update_own ON public.quick_save_entries FOR UPDATE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (public.is_active(auth.uid()) AND created_by = auth.uid());
CREATE POLICY qse_delete_own ON public.quick_save_entries FOR DELETE TO authenticated
  USING (public.is_active(auth.uid()) AND created_by = auth.uid());

-- ============ Seed default metric template ============
INSERT INTO public.daily_metric_templates (template_name, description, is_default, metrics) VALUES (
  'Default Basic Metrics',
  'CPM, CTR, CPC, Link Clicks, Landing Page Views, Landing Page Visit Rate',
  true,
  '[
    {"key":"cpm","name":"CPM","type":"currency","aggregation":"average","whatsapp":false,"exports":true},
    {"key":"ctr","name":"CTR","type":"percentage","aggregation":"average","whatsapp":false,"exports":true},
    {"key":"cpc","name":"CPC","type":"currency","aggregation":"average","whatsapp":false,"exports":true},
    {"key":"link_clicks","name":"Link Clicks","type":"number","aggregation":"sum","whatsapp":false,"exports":true},
    {"key":"lp_views","name":"Landing Page Views","type":"number","aggregation":"sum","whatsapp":true,"exports":true},
    {"key":"lp_visit_rate","name":"Landing Page Visit Rate","type":"percentage","aggregation":"average","whatsapp":false,"exports":true}
  ]'::jsonb
);

-- ============ Purge function for 14-day soft delete TTL ============
CREATE OR REPLACE FUNCTION public.purge_old_deleted_daily_reports()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '14 days';
  daily_ids uuid[];
  mb_ids uuid[];
  daily_count int := 0;
BEGIN
  SELECT array_agg(id) INTO daily_ids
  FROM public.daily_lead_reports
  WHERE is_deleted = true AND deleted_at IS NOT NULL AND deleted_at < cutoff;

  IF daily_ids IS NOT NULL AND array_length(daily_ids, 1) > 0 THEN
    SELECT array_agg(id) INTO mb_ids
    FROM public.daily_lead_report_media_buyers WHERE report_id = ANY(daily_ids);
    IF mb_ids IS NOT NULL AND array_length(mb_ids, 1) > 0 THEN
      DELETE FROM public.daily_lead_report_ad_accounts WHERE report_media_buyer_id = ANY(mb_ids);
    END IF;
    DELETE FROM public.daily_lead_report_media_buyers WHERE report_id = ANY(daily_ids);
    DELETE FROM public.daily_lead_reports WHERE id = ANY(daily_ids);
    daily_count := COALESCE(array_length(daily_ids, 1), 0);
  END IF;

  RETURN jsonb_build_object('daily_purged', daily_count, 'cutoff', cutoff);
END $$;

GRANT EXECUTE ON FUNCTION public.purge_old_deleted_daily_reports() TO authenticated;
