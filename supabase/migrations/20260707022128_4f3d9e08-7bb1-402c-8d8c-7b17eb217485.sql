
-- Generic KPI module: position config, KPI definitions, personal daily entries.

-- 1. Position config (admin-editable)
CREATE TABLE public.kpi_position_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL UNIQUE REFERENCES public.gwv_positions(id) ON DELETE CASCADE,
  critical_number text,
  critical_number_target numeric,
  critical_number_unit text,
  quarter_label text,
  daily_commit_target numeric NOT NULL DEFAULT 0,
  good_day_rule jsonb NOT NULL DEFAULT '{"min_ship_ratio":1.0,"require_quality_gate":true,"required_kpis":[]}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_position_config TO authenticated;
GRANT ALL ON public.kpi_position_config TO service_role;
ALTER TABLE public.kpi_position_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read config (so employees see their own position's KPIs)
CREATE POLICY "kpi_position_config: read for authenticated"
  ON public.kpi_position_config FOR SELECT TO authenticated USING (true);
-- Only admins can write
CREATE POLICY "kpi_position_config: admin write"
  ON public.kpi_position_config FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_kpi_position_config_upd
  BEFORE UPDATE ON public.kpi_position_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. KPI definitions
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.kpi_position_config(id) ON DELETE CASCADE,
  kpi_key text NOT NULL,
  label text NOT NULL,
  description text,
  kpi_type text NOT NULL CHECK (kpi_type IN ('commit_ship','number','boolean','quality_gate')),
  unit text,
  target numeric,
  direction text NOT NULL DEFAULT 'higher_better' CHECK (direction IN ('higher_better','lower_better')),
  is_quality_gate boolean NOT NULL DEFAULT false,
  weight numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, kpi_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_definitions TO authenticated;
GRANT ALL ON public.kpi_definitions TO service_role;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_definitions: read for authenticated"
  ON public.kpi_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_definitions: admin write"
  ON public.kpi_definitions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_kpi_definitions_upd
  BEFORE UPDATE ON public.kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Daily entries (personal, own-or-admin)
CREATE TABLE public.kpi_daily_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.gwv_team_members(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.gwv_positions(id) ON DELETE SET NULL,
  entry_date date NOT NULL,
  committed numeric,
  shipped numeric,
  quality_passed boolean,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  good_day boolean,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_daily_entry TO authenticated;
GRANT ALL ON public.kpi_daily_entry TO service_role;
ALTER TABLE public.kpi_daily_entry ENABLE ROW LEVEL SECURITY;

-- Owner or admin: SELECT
CREATE POLICY "kpi_daily_entry: owner or admin read"
  ON public.kpi_daily_entry FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR team_member_id = private.current_team_member_id()
  );
-- Owner or admin: INSERT
CREATE POLICY "kpi_daily_entry: owner or admin insert"
  ON public.kpi_daily_entry FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR team_member_id = private.current_team_member_id()
  );
-- Owner or admin: UPDATE
CREATE POLICY "kpi_daily_entry: owner or admin update"
  ON public.kpi_daily_entry FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR team_member_id = private.current_team_member_id()
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR team_member_id = private.current_team_member_id()
  );
-- Owner or admin: DELETE
CREATE POLICY "kpi_daily_entry: owner or admin delete"
  ON public.kpi_daily_entry FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR team_member_id = private.current_team_member_id()
  );

CREATE TRIGGER trg_kpi_daily_entry_upd
  BEFORE UPDATE ON public.kpi_daily_entry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_kpi_daily_entry_member_date ON public.kpi_daily_entry(team_member_id, entry_date DESC);
CREATE INDEX idx_kpi_definitions_config ON public.kpi_definitions(config_id, sort_order);

-- 4. Register modules for access control
INSERT INTO public.gwv_modules (module_key, module_name, route_path, description, sensitivity, default_access_level, module_status, is_assignable, show_in_sidebar, show_in_module_hub, sort_order)
VALUES
  ('kpi_daily_reporting', 'KPI Daily Reporting', '/kpi/daily', 'Log your daily KPIs and see your good-day status.', 'personal', 'view', 'active', true, true, true, 500),
  ('kpi_history', 'KPI History', '/kpi/history', 'Your past KPI entries and good-day streak.', 'personal', 'view', 'active', true, true, true, 501),
  ('kpi_settings', 'KPI Settings', '/kpi/settings', 'Admin: configure per-position KPIs, Critical Number, and good-day rule.', 'confidential', 'none', 'active', true, false, true, 502)
ON CONFLICT (module_key) DO NOTHING;
