DROP POLICY IF EXISTS gwv_attendance_settings_read_all_auth ON public.gwv_attendance_settings;
CREATE POLICY gwv_attendance_settings_read_active_members
  ON public.gwv_attendance_settings FOR SELECT
  TO authenticated
  USING (private.is_active(auth.uid()));