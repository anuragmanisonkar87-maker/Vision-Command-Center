
CREATE TABLE public.gwv_attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name text NOT NULL DEFAULT 'Head Office',
  office_lat double precision,
  office_lng double precision,
  allowed_radius_meters integer NOT NULL DEFAULT 100,
  allowed_check_in_start_time time,
  expected_check_in_time time,
  expected_check_out_time time,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  enable_location_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gwv_attendance_settings TO authenticated;
GRANT ALL ON public.gwv_attendance_settings TO service_role;

ALTER TABLE public.gwv_attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_settings_read_all_auth"
  ON public.gwv_attendance_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "attendance_settings_admin_write"
  ON public.gwv_attendance_settings FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_gwv_attendance_settings_updated
  BEFORE UPDATE ON public.gwv_attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.gwv_attendance_settings (office_name) VALUES ('Head Office');

CREATE TABLE public.gwv_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_member_id uuid,
  date date NOT NULL DEFAULT current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  total_work_seconds integer NOT NULL DEFAULT 0,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  check_in_accuracy double precision,
  check_out_accuracy double precision,
  check_in_status text NOT NULL DEFAULT 'not_checked_in',
  check_out_status text NOT NULL DEFAULT 'not_checked_in',
  location_status text NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_gwv_attendance_user_date ON public.gwv_attendance_records (user_id, date DESC);
CREATE INDEX idx_gwv_attendance_date ON public.gwv_attendance_records (date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gwv_attendance_records TO authenticated;
GRANT ALL ON public.gwv_attendance_records TO service_role;

ALTER TABLE public.gwv_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_self_select"
  ON public.gwv_attendance_records FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "attendance_self_insert"
  ON public.gwv_attendance_records FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance_self_update"
  ON public.gwv_attendance_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance_admin_all"
  ON public.gwv_attendance_records FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_gwv_attendance_records_updated
  BEFORE UPDATE ON public.gwv_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
