
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- KPI settings
CREATE TABLE IF NOT EXISTS public.gwv_hr_kpi_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  label text, category text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gwv_hr_kpi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_read_all" ON public.gwv_hr_kpi_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_admin_write" ON public.gwv_hr_kpi_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.gwv_hr_kpi_settings (setting_key, setting_value, label, category) VALUES
  ('hiring_mode_override', '"automatic"'::jsonb, 'Hiring Mode', 'mode'),
  ('default_sla_days', '4'::jsonb, 'Default SLA Days', 'sla'),
  ('high_mode_interview_target', '6'::jsonb, 'High Mode Daily Target', 'targets'),
  ('normal_mode_interview_target', '5'::jsonb, 'Normal Mode Daily Target', 'targets'),
  ('low_mode_interview_target', '3'::jsonb, 'Low Mode Daily Target', 'targets'),
  ('maintenance_mode_interview_target', '1'::jsonb, 'Maintenance Mode Target', 'targets'),
  ('pool_target_per_position', '20'::jsonb, 'Pool Target / Position', 'pool'),
  ('minimum_ready_now', '5'::jsonb, 'Minimum Ready Now / Position', 'pool'),
  ('report_deadline_hour', '20'::jsonb, 'Report Deadline (24h)', 'reporting'),
  ('missed_report_penalty', '-20'::jsonb, 'Missed Report Penalty', 'scoring'),
  ('missed_sla_penalty', '-15'::jsonb, 'Missed SLA Penalty', 'scoring'),
  ('bonus_close_before_sla', '10'::jsonb, 'Bonus: Close Before SLA', 'scoring'),
  ('bonus_high_quality_candidate', '5'::jsonb, 'Bonus: High Quality Candidate', 'scoring'),
  ('bonus_candidate_joined', '15'::jsonb, 'Bonus: Candidate Joined', 'scoring'),
  ('checklist_items', '["Hiring dashboard checked","New requirements reviewed","Hiring inbox checked","Candidate follow-ups completed","Daily report submitted"]'::jsonb, 'Daily Checklist', 'checklist')
ON CONFLICT (setting_key) DO NOTHING;

-- Positions
CREATE TABLE IF NOT EXISTS public.gwv_company_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid, brand_name text, department text,
  position_name text NOT NULL,
  reporting_manager text, work_mode text, location text, salary_range text,
  default_sla_days integer NOT NULL DEFAULT 4,
  pool_target integer NOT NULL DEFAULT 20,
  minimum_ready_now integer NOT NULL DEFAULT 5,
  daily_interview_target_override integer,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  hiring_bible_route text, hiring_bible_table_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.gwv_company_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_read" ON public.gwv_company_positions FOR SELECT TO authenticated
  USING (is_deleted = false OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pos_write" ON public.gwv_company_positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.gwv_company_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hiring requirements
CREATE TABLE IF NOT EXISTS public.gwv_hr_hiring_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid, brand_name text, department text,
  position_name text NOT NULL, position_id uuid,
  openings integer NOT NULL DEFAULT 1,
  priority text NOT NULL DEFAULT 'normal',
  reporting_manager text, work_mode text, location text, salary_range text,
  experience_required text, skills_required text, reason_for_hiring text, special_notes text,
  source text NOT NULL DEFAULT 'director_form',
  assigned_to_user_id uuid, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assigned_date date NOT NULL DEFAULT current_date,
  sla_days integer NOT NULL DEFAULT 4,
  deadline_date date,
  status text NOT NULL DEFAULT 'new',
  filled_count integer NOT NULL DEFAULT 0,
  is_filled boolean NOT NULL DEFAULT false,
  filled_at timestamptz,
  sla_status text NOT NULL DEFAULT 'on_track',
  missed_sla boolean NOT NULL DEFAULT false,
  missed_sla_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, deleted_by uuid
);
ALTER TABLE public.gwv_hr_hiring_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_read" ON public.gwv_hr_hiring_requirements FOR SELECT TO authenticated
  USING (is_deleted = false AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')
    OR public.has_role(auth.uid(),'brand_manager')
    OR assigned_to_user_id = auth.uid() OR created_by = auth.uid()
  ));
CREATE POLICY "req_write" ON public.gwv_hr_hiring_requirements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_req_updated BEFORE UPDATE ON public.gwv_hr_hiring_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gwv_hr_set_deadline()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deadline_date IS NULL THEN
    NEW.deadline_date := COALESCE(NEW.assigned_date, current_date) + COALESCE(NEW.sla_days, 4);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_req_deadline BEFORE INSERT OR UPDATE ON public.gwv_hr_hiring_requirements
  FOR EACH ROW EXECUTE FUNCTION public.gwv_hr_set_deadline();

-- Candidate pool
CREATE TABLE IF NOT EXISTS public.gwv_hr_candidate_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name text NOT NULL, phone text NOT NULL, email text,
  brand_id uuid, brand_name text,
  position_id uuid, position_name text NOT NULL,
  brand_fit text, skill_level text, expected_salary text, availability text,
  ready_to_join_from date, location text, work_mode text, interview_status text,
  readiness_tier text NOT NULL DEFAULT 'warm',
  freshness_status text NOT NULL DEFAULT 'fresh',
  last_contacted_at timestamptz,
  source text, hiring_source text,
  hiring_bible_candidate_id uuid, hiring_bible_route text, hiring_bible_table_key text,
  interview_score numeric, interview_decision text,
  hr_remarks text, manager_remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.gwv_hr_candidate_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool_read" ON public.gwv_hr_candidate_pool FOR SELECT TO authenticated
  USING (is_deleted = false AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')));
CREATE POLICY "pool_write" ON public.gwv_hr_candidate_pool FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_pool_updated BEFORE UPDATE ON public.gwv_hr_candidate_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily reports
CREATE TABLE IF NOT EXISTS public.gwv_hr_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  hr_user_id uuid, hr_name text,
  login_time timestamptz, logout_time timestamptz, submitted_at timestamptz,
  report_status text NOT NULL DEFAULT 'draft',
  hiring_mode text,
  interview_target integer NOT NULL DEFAULT 5,
  interviews_conducted integer NOT NULL DEFAULT 0,
  shortlisted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  ready_pool_added_count integer NOT NULL DEFAULT 0,
  open_positions_count integer NOT NULL DEFAULT 0,
  sla_missed_count integer NOT NULL DEFAULT 0,
  checklist_completed_count integer NOT NULL DEFAULT 0,
  checklist_total_count integer NOT NULL DEFAULT 0,
  key_outcomes text, blockers text, tomorrow_focus text, followup_notes text,
  whatsapp_summary text, pdf_url text,
  score_total numeric NOT NULL DEFAULT 0,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  penalty_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonus_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  UNIQUE(report_date, hr_user_id)
);
ALTER TABLE public.gwv_hr_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_read" ON public.gwv_hr_daily_reports FOR SELECT TO authenticated
  USING (is_deleted = false AND (public.has_role(auth.uid(),'admin') OR hr_user_id = auth.uid()));
CREATE POLICY "rep_insert" ON public.gwv_hr_daily_reports FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
              AND (hr_user_id = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "rep_update" ON public.gwv_hr_daily_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR hr_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR hr_user_id = auth.uid());
CREATE POLICY "rep_delete" ON public.gwv_hr_daily_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rep_updated BEFORE UPDATE ON public.gwv_hr_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Score events
CREATE TABLE IF NOT EXISTS public.gwv_hr_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_user_id uuid, event_date date NOT NULL,
  event_type text NOT NULL, score_delta numeric NOT NULL,
  score_category text, reason text, source_type text, source_id uuid,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.gwv_hr_score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_read" ON public.gwv_hr_score_events FOR SELECT TO authenticated
  USING (is_deleted = false AND (public.has_role(auth.uid(),'admin') OR hr_user_id = auth.uid()));
CREATE POLICY "score_write" ON public.gwv_hr_score_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

-- Notifications
CREATE TABLE IF NOT EXISTS public.gwv_hr_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, role_target text,
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL, message text,
  source_type text, source_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.gwv_hr_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read" ON public.gwv_hr_notifications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR user_id = auth.uid()
    OR (role_target = 'hr' AND public.has_role(auth.uid(),'hr'))
    OR (role_target = 'admin' AND public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "notif_write" ON public.gwv_hr_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

-- Work sessions
CREATE TABLE IF NOT EXISTS public.gwv_hr_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_date date NOT NULL,
  login_time timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz, last_activity_at timestamptz,
  source text NOT NULL DEFAULT 'vision_center',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);
ALTER TABLE public.gwv_hr_work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sess_read" ON public.gwv_hr_work_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
CREATE POLICY "sess_insert" ON public.gwv_hr_work_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "sess_update" ON public.gwv_hr_work_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
