
DROP POLICY IF EXISTS "kpi_position_config_read_active_members" ON public.kpi_position_config;
DROP POLICY IF EXISTS "kpi_position_config: read for authenticated" ON public.kpi_position_config;

CREATE POLICY "kpi_position_config_read_own_or_admin"
  ON public.kpi_position_config FOR SELECT
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR position_id = (
      SELECT position_id FROM public.gwv_team_members
      WHERE id = private.current_team_member_id()
    )
  );

DROP POLICY IF EXISTS "kpi_definitions_read_active_members" ON public.kpi_definitions;
DROP POLICY IF EXISTS "kpi_definitions: read for authenticated" ON public.kpi_definitions;

CREATE POLICY "kpi_definitions_read_own_or_admin"
  ON public.kpi_definitions FOR SELECT
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR config_id IN (
      SELECT c.id FROM public.kpi_position_config c
      WHERE c.position_id = (
        SELECT position_id FROM public.gwv_team_members
        WHERE id = private.current_team_member_id()
      )
    )
  );
