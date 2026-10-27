
-- =========================================================
-- TEAM ACCESS CONTROL — PHASE 1 FOUNDATION
-- =========================================================

-- ---------- POSITIONS ----------
CREATE TABLE public.gwv_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  default_access_level text NOT NULL DEFAULT 'viewer',
  default_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

-- ---------- TEAM MEMBERS ----------
CREATE TABLE public.gwv_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  position_id uuid REFERENCES public.gwv_positions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  access_level text NOT NULL DEFAULT 'viewer',
  notes text,
  invited_at timestamptz,
  last_active_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX gtm_email_idx ON public.gwv_team_members(email);
CREATE INDEX gtm_phone_idx ON public.gwv_team_members(phone);
CREATE INDEX gtm_user_idx ON public.gwv_team_members(linked_user_id);
CREATE INDEX gtm_status_idx ON public.gwv_team_members(status);

-- ---------- MODULES ----------
CREATE TABLE public.gwv_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.gwv_brands(id) ON DELETE SET NULL,
  parent_module_id uuid REFERENCES public.gwv_modules(id) ON DELETE SET NULL,
  module_name text NOT NULL,
  module_key text UNIQUE NOT NULL,
  route_path text,
  description text,
  sensitivity text NOT NULL DEFAULT 'normal',
  default_access_level text NOT NULL DEFAULT 'viewer',
  module_status text NOT NULL DEFAULT 'active',
  is_assignable boolean NOT NULL DEFAULT true,
  show_in_sidebar boolean NOT NULL DEFAULT false,
  show_in_module_hub boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX gm_brand_idx ON public.gwv_modules(brand_id);
CREATE INDEX gm_status_idx ON public.gwv_modules(module_status);

-- ---------- USER BRAND ACCESS ----------
CREATE TABLE public.gwv_user_brand_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.gwv_team_members(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.gwv_brands(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer',
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (team_member_id, brand_id)
);

-- ---------- USER MODULE ACCESS ----------
CREATE TABLE public.gwv_user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.gwv_team_members(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.gwv_brands(id) ON DELETE SET NULL,
  module_id uuid NOT NULL REFERENCES public.gwv_modules(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer',
  scope text NOT NULL DEFAULT 'assigned',
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  can_view_finance boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (team_member_id, module_id)
);

-- ---------- POSITION MODULE ACCESS ----------
CREATE TABLE public.gwv_position_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.gwv_positions(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.gwv_brands(id) ON DELETE SET NULL,
  module_id uuid NOT NULL REFERENCES public.gwv_modules(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer',
  scope text NOT NULL DEFAULT 'assigned',
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  can_view_finance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, module_id)
);

-- ---------- MASTER OPTIONS ----------
CREATE TABLE public.gwv_master_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type text NOT NULL,
  option_key text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  brand_id uuid REFERENCES public.gwv_brands(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX gmo_unique_idx ON public.gwv_master_options(option_type, value, COALESCE(brand_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- =========================================================
-- TRIGGERS — updated_at
-- =========================================================
CREATE TRIGGER trg_gwv_positions_updated BEFORE UPDATE ON public.gwv_positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_team_members_updated BEFORE UPDATE ON public.gwv_team_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_modules_updated BEFORE UPDATE ON public.gwv_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_uba_updated BEFORE UPDATE ON public.gwv_user_brand_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_uma_updated BEFORE UPDATE ON public.gwv_user_module_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_pma_updated BEFORE UPDATE ON public.gwv_position_module_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gwv_mo_updated BEFORE UPDATE ON public.gwv_master_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- HELPER FUNCTIONS (private schema, security definer)
-- =========================================================
CREATE OR REPLACE FUNCTION private.can_manage_team_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, 'admin'::app_role) $$;

CREATE OR REPLACE FUNCTION private.current_team_member_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.gwv_team_members WHERE linked_user_id = auth.uid() AND is_deleted = false LIMIT 1 $$;

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.gwv_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_user_brand_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_position_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwv_master_options ENABLE ROW LEVEL SECURITY;

-- Positions: admin full; authed read
CREATE POLICY positions_admin ON public.gwv_positions FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY positions_read ON public.gwv_positions FOR SELECT TO authenticated USING (is_deleted = false);

-- Modules: admin full; authed read
CREATE POLICY modules_admin ON public.gwv_modules FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY modules_read ON public.gwv_modules FOR SELECT TO authenticated USING (is_deleted = false);

-- Team Members: admin full; user reads own
CREATE POLICY team_members_admin ON public.gwv_team_members FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY team_members_self_read ON public.gwv_team_members FOR SELECT TO authenticated
  USING (linked_user_id = auth.uid());

-- User Brand Access: admin full; user reads own
CREATE POLICY uba_admin ON public.gwv_user_brand_access FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY uba_self_read ON public.gwv_user_brand_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR team_member_id = private.current_team_member_id());

-- User Module Access: admin full; user reads own
CREATE POLICY uma_admin ON public.gwv_user_module_access FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY uma_self_read ON public.gwv_user_module_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR team_member_id = private.current_team_member_id());

-- Position Module Access: admin full; authed read
CREATE POLICY pma_admin ON public.gwv_position_module_access FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY pma_read ON public.gwv_position_module_access FOR SELECT TO authenticated USING (true);

-- Master Options: admin full; authed read; authed insert (quick-save)
CREATE POLICY mo_admin ON public.gwv_master_options FOR ALL TO authenticated
  USING (private.can_manage_team_access(auth.uid())) WITH CHECK (private.can_manage_team_access(auth.uid()));
CREATE POLICY mo_read ON public.gwv_master_options FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY mo_insert_authed ON public.gwv_master_options FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- =========================================================
-- SEED — POSITIONS
-- =========================================================
INSERT INTO public.gwv_positions (name, slug, description, default_access_level, sort_order) VALUES
  ('Admin', 'admin', 'Full system access', 'admin', 1),
  ('Finance Manager', 'finance-manager', 'Manages revenue, expenses, P&L', 'finance', 2),
  ('Brand Manager', 'brand-manager', 'Owns brand operations', 'manager', 3),
  ('Media Buyer Operations', 'media-buyer-ops', 'Operates daily reporting and performance for media buyers', 'editor', 4),
  ('Media Buyer', 'media-buyer', 'Runs and reports on assigned ad accounts', 'creator', 5),
  ('Backend Operations Executive', 'backend-ops', 'Backend operational support', 'editor', 6),
  ('Creative Team', 'creative-team', 'Creative production and reporting', 'creator', 7),
  ('Sales Executive', 'sales-executive', 'Sales pipeline and reporting', 'creator', 8),
  ('Client Success Manager', 'client-success', 'Client relationship and renewals', 'editor', 9);

-- =========================================================
-- SEED — MARKETIZERS MODULES
-- =========================================================
DO $$
DECLARE mz_brand_id uuid;
BEGIN
  SELECT id INTO mz_brand_id FROM public.gwv_brands WHERE slug = 'marketizers' LIMIT 1;

  INSERT INTO public.gwv_modules (brand_id, module_name, module_key, route_path, sensitivity, default_access_level, module_status, sort_order, description) VALUES
    (mz_brand_id, 'Marketizers Hub', 'marketizers_hub', '/brands/marketizers', 'normal', 'viewer', 'active', 1, 'Brand landing page'),
    (mz_brand_id, 'Revenue & Finance', 'marketizers_revenue_finance', '/brands/marketizers/revenue', 'finance', 'finance', 'active', 2, 'Revenue dashboard and finance overview'),
    (mz_brand_id, 'Client Accounts', 'marketizers_client_accounts', '/brands/marketizers/revenue/clients', 'finance', 'editor', 'active', 3, 'Client roster and accounts'),
    (mz_brand_id, 'Pending Collections', 'marketizers_pending_collections', '/brands/marketizers/revenue/collections', 'finance', 'finance', 'active', 4, 'Collection followups'),
    (mz_brand_id, 'Monthly Entry', 'marketizers_monthly_entry', '/brands/marketizers/revenue/entry', 'finance', 'finance', 'active', 5, 'Monthly revenue and expense entries'),
    (mz_brand_id, 'Expenses Center', 'marketizers_expenses_center', '/brands/marketizers/revenue/expenses', 'finance', 'finance', 'active', 6, 'Expense tracking'),
    (mz_brand_id, 'Reports', 'marketizers_reports', '/brands/marketizers/revenue/reports', 'finance', 'finance', 'active', 7, 'Reports hub'),
    (mz_brand_id, 'P&L Report', 'marketizers_pl_report', '/brands/marketizers/revenue/reports/pl', 'finance', 'finance', 'active', 8, 'Profit & loss report'),
    (mz_brand_id, 'Team Performance', 'marketizers_team_performance', '/brands/marketizers/team-performance', 'performance', 'editor', 'active', 9, 'Team performance hub'),
    (mz_brand_id, 'Media Buyer Performance', 'marketizers_media_buyer_performance', '/brands/marketizers/team-performance/media-buyer', 'performance', 'editor', 'active', 10, 'Media buyer performance module'),
    (mz_brand_id, 'Daily Reporting', 'marketizers_daily_reporting', '/brands/marketizers/team-performance/media-buyer', 'performance', 'creator', 'active', 11, 'Daily lead reporting'),
    (mz_brand_id, 'Daily Reporting History', 'marketizers_daily_reporting_history', '/brands/marketizers/team-performance/media-buyer', 'performance', 'viewer', 'active', 12, 'History of daily reports'),
    (mz_brand_id, 'Daily Reporting Analytics', 'marketizers_daily_reporting_analytics', '/brands/marketizers/team-performance/media-buyer', 'performance', 'viewer', 'active', 13, 'Analytics across daily reports');
END $$;

-- =========================================================
-- SEED — MASTER OPTIONS
-- =========================================================
INSERT INTO public.gwv_master_options (option_type, option_key, label, value, sort_order) VALUES
  -- team_member_status
  ('team_member_status','active','Active','active',1),
  ('team_member_status','paused','Paused','paused',2),
  ('team_member_status','invited','Invited','invited',3),
  ('team_member_status','training','Training','training',4),
  ('team_member_status','probation','Probation','probation',5),
  ('team_member_status','contractor','Contractor','contractor',6),
  ('team_member_status','notice_period','Notice Period','notice_period',7),
  -- access_level
  ('access_level','viewer','Viewer','viewer',1),
  ('access_level','creator','Creator','creator',2),
  ('access_level','editor','Editor','editor',3),
  ('access_level','manager','Manager','manager',4),
  ('access_level','finance','Finance','finance',5),
  ('access_level','admin','Admin','admin',6),
  -- module_sensitivity
  ('module_sensitivity','normal','Normal','normal',1),
  ('module_sensitivity','performance','Performance','performance',2),
  ('module_sensitivity','finance','Finance','finance',3),
  ('module_sensitivity','admin','Admin','admin',4),
  ('module_sensitivity','confidential','Confidential','confidential',5),
  -- module_status
  ('module_status','active','Active','active',1),
  ('module_status','coming_soon','Coming Soon','coming_soon',2),
  ('module_status','foundation_ready','Foundation Ready','foundation_ready',3),
  ('module_status','paused','Paused','paused',4),
  ('module_status','archived','Archived','archived',5),
  -- permission_type
  ('permission_type','view','View','view',1),
  ('permission_type','create','Create','create',2),
  ('permission_type','edit','Edit','edit',3),
  ('permission_type','delete','Delete/Archive','delete',4),
  ('permission_type','export','Export','export',5),
  ('permission_type','finance','Finance Visibility','finance',6),
  ('permission_type','manage_access','Manage Access','manage_access',7);
