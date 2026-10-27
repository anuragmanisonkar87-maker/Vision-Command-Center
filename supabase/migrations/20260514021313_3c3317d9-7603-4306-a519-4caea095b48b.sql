
-- ROAS sessions
CREATE TABLE public.marketizers_roas_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text,
  media_buyer_id uuid,
  media_buyer_name text,
  event_type text,
  event_name text,
  offer_name text,
  product_final_value numeric,
  token_amount numeric,
  campaign_date_from date,
  campaign_date_to date,
  event_dates jsonb DEFAULT '[]'::jsonb,
  event_day_pattern text,
  ad_spend numeric NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  cpm numeric,
  cpc numeric,
  cpl numeric,
  cpp numeric,
  ctr numeric,
  landing_page_views integer,
  token_purchases integer NOT NULL DEFAULT 0,
  final_purchases integer NOT NULL DEFAULT 0,
  token_revenue numeric NOT NULL DEFAULT 0,
  final_revenue numeric NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  manual_revenue_override numeric,
  roas numeric,
  pnl numeric,
  showup_count integer,
  showup_percent numeric,
  heard_count integer,
  sales_count integer,
  offer_showup_count integer,
  offer_showup_percent numeric,
  lead_drop_rate numeric,
  cpl_drop_percent numeric,
  final_purchase_conversion numeric,
  revenue_per_lead numeric,
  profit_per_lead numeric,
  performance_health text,
  source_type text DEFAULT 'manual',
  google_sheet_url text,
  meta_ad_account text,
  campaign_name text,
  notes text,
  currency text NOT NULL DEFAULT 'INR',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX idx_mrs_event_date ON public.marketizers_roas_sessions(campaign_date_to DESC);
CREATE INDEX idx_mrs_client ON public.marketizers_roas_sessions(client_id);
CREATE INDEX idx_mrs_media_buyer ON public.marketizers_roas_sessions(media_buyer_id);

ALTER TABLE public.marketizers_roas_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view roas sessions" ON public.marketizers_roas_sessions
  FOR SELECT TO authenticated USING (public.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "insert roas sessions" ON public.marketizers_roas_sessions
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "update roas sessions" ON public.marketizers_roas_sessions
  FOR UPDATE TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "delete roas sessions" ON public.marketizers_roas_sessions
  FOR DELETE TO authenticated USING (public.can_edit_marketizers_finance(auth.uid()));

CREATE TRIGGER mrs_set_updated BEFORE UPDATE ON public.marketizers_roas_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audience segments
CREATE TABLE public.marketizers_roas_audience_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.marketizers_roas_sessions(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_percentage numeric,
  segment_count integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mras_session ON public.marketizers_roas_audience_segments(session_id);

ALTER TABLE public.marketizers_roas_audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view roas segments" ON public.marketizers_roas_audience_segments
  FOR SELECT TO authenticated USING (public.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "write roas segments" ON public.marketizers_roas_audience_segments
  FOR ALL TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

-- Quick save options
CREATE TABLE public.marketizers_roas_quick_save_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_group, value)
);

CREATE INDEX idx_mrqs_group ON public.marketizers_roas_quick_save_options(option_group) WHERE is_active = true;

ALTER TABLE public.marketizers_roas_quick_save_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view roas quick save" ON public.marketizers_roas_quick_save_options
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "insert roas quick save" ON public.marketizers_roas_quick_save_options
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update roas quick save" ON public.marketizers_roas_quick_save_options
  FOR UPDATE TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "delete roas quick save" ON public.marketizers_roas_quick_save_options
  FOR DELETE TO authenticated USING (public.can_edit_marketizers_finance(auth.uid()));

CREATE TRIGGER mrqs_set_updated BEFORE UPDATE ON public.marketizers_roas_quick_save_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default event types and audience segments
INSERT INTO public.marketizers_roas_quick_save_options (option_group, label, value, sort_order) VALUES
  ('event_type', '1-Day Webinar', '1-Day Webinar', 1),
  ('event_type', '2-Day Webinar', '2-Day Webinar', 2),
  ('event_type', '3-Day Bootcamp', '3-Day Bootcamp', 3),
  ('event_type', 'Seminar', 'Seminar', 4),
  ('event_type', 'Challenge', 'Challenge', 5),
  ('event_type', 'Workshop', 'Workshop', 6),
  ('event_type', 'Custom', 'Custom', 7),
  ('event_day_pattern', 'Friday, Saturday, Sunday', 'Friday, Saturday, Sunday', 1),
  ('event_day_pattern', 'Wednesday, Thursday, Friday', 'Wednesday, Thursday, Friday', 2),
  ('event_day_pattern', 'Saturday, Sunday', 'Saturday, Sunday', 3),
  ('event_day_pattern', 'Single Day', 'Single Day', 4),
  ('event_day_pattern', 'Custom', 'Custom', 5),
  ('audience_segment', 'Business Owner', 'business_owner', 1),
  ('audience_segment', 'Coach', 'coach', 2),
  ('audience_segment', 'Working Professional', 'working_professional', 3),
  ('audience_segment', 'Homemaker', 'homemaker', 4),
  ('audience_segment', 'Others', 'others', 5);
