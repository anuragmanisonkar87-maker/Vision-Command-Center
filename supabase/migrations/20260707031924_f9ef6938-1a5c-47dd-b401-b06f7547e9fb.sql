
DROP POLICY IF EXISTS "attendance_settings_read_all_auth" ON public.gwv_attendance_settings;

DROP POLICY IF EXISTS "kpi_definitions: read for authenticated" ON public.kpi_definitions;
CREATE POLICY "kpi_definitions_read_active_members"
  ON public.kpi_definitions FOR SELECT
  USING (private.is_active(auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "kpi_position_config: read for authenticated" ON public.kpi_position_config;
CREATE POLICY "kpi_position_config_read_active_members"
  ON public.kpi_position_config FOR SELECT
  USING (private.is_active(auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role));
