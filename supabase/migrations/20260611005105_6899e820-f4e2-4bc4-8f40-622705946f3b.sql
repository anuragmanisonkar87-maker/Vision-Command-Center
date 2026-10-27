
DROP POLICY IF EXISTS "view brands" ON public.gwv_brands;
CREATE POLICY "view brands" ON public.gwv_brands FOR SELECT TO authenticated
  USING (is_deleted = false AND private.is_active(auth.uid()));

DROP POLICY IF EXISTS "modules_read" ON public.gwv_modules;
CREATE POLICY "modules_read" ON public.gwv_modules FOR SELECT TO authenticated
  USING (is_deleted = false AND private.is_active(auth.uid()));

DROP POLICY IF EXISTS "positions_read" ON public.gwv_positions;
CREATE POLICY "positions_read" ON public.gwv_positions FOR SELECT TO authenticated
  USING (is_deleted = false AND private.is_active(auth.uid()));

DROP POLICY IF EXISTS "mo_read" ON public.gwv_master_options;
CREATE POLICY "mo_read" ON public.gwv_master_options FOR SELECT TO authenticated
  USING (is_active = true AND private.is_active(auth.uid()));

DROP POLICY IF EXISTS "pma_read" ON public.gwv_position_module_access;
CREATE POLICY "pma_read" ON public.gwv_position_module_access FOR SELECT TO authenticated
  USING (private.is_active(auth.uid()));

DROP POLICY IF EXISTS "kpi_read_all" ON public.gwv_hr_kpi_settings;
CREATE POLICY "kpi_read_all" ON public.gwv_hr_kpi_settings FOR SELECT TO authenticated
  USING (private.is_active(auth.uid()));
