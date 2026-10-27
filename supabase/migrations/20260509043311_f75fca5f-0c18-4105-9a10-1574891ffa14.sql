-- =========================================================================
-- 1. ROLES ENUM + USER_ROLES + PROFILES + has_role() helper
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin', 'finance_manager', 'brand_manager', 'operator', 'team_member', 'media_buyer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- has_role() — SECURITY DEFINER avoids RLS recursion on user_roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Convenience: any of the finance-viewing roles
CREATE OR REPLACE FUNCTION public.can_view_marketizers_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','finance_manager','brand_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_marketizers_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','finance_manager')
  );
$$;

-- =========================================================================
-- 2. PROFILE / FIRST-ADMIN BOOTSTRAP TRIGGER
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  -- First user becomes admin so the system is never locked out
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 3. PROFILES + USER_ROLES RLS
-- =========================================================================

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 4. TIGHTEN MARKETIZERS RLS (drop permissive Phase 1 policies)
-- =========================================================================

DROP POLICY IF EXISTS phase1_anon_all_clients ON public.marketizers_clients;
DROP POLICY IF EXISTS phase1_authenticated_all_clients ON public.marketizers_clients;
DROP POLICY IF EXISTS phase1_anon_all_entries ON public.marketizers_monthly_entries;
DROP POLICY IF EXISTS phase1_authenticated_all_entries ON public.marketizers_monthly_entries;
DROP POLICY IF EXISTS phase1_anon_all_targets ON public.marketizers_targets;
DROP POLICY IF EXISTS phase1_authenticated_all_targets ON public.marketizers_targets;

-- marketizers_clients
CREATE POLICY "Finance viewers can read clients"
  ON public.marketizers_clients FOR SELECT
  TO authenticated
  USING (public.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can insert clients"
  ON public.marketizers_clients FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can update clients"
  ON public.marketizers_clients FOR UPDATE
  TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Admins can delete clients"
  ON public.marketizers_clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- marketizers_monthly_entries
CREATE POLICY "Finance viewers can read entries"
  ON public.marketizers_monthly_entries FOR SELECT
  TO authenticated
  USING (public.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can insert entries"
  ON public.marketizers_monthly_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can update entries"
  ON public.marketizers_monthly_entries FOR UPDATE
  TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Admins can delete entries"
  ON public.marketizers_monthly_entries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- marketizers_targets
CREATE POLICY "Finance viewers can read targets"
  ON public.marketizers_targets FOR SELECT
  TO authenticated
  USING (public.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can insert targets"
  ON public.marketizers_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can update targets"
  ON public.marketizers_targets FOR UPDATE
  TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Admins can delete targets"
  ON public.marketizers_targets FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 5. UNIQUE CONSTRAINT + INDEXES
-- =========================================================================

DO $$ BEGIN
  ALTER TABLE public.marketizers_monthly_entries
    ADD CONSTRAINT marketizers_monthly_entries_client_month_uniq UNIQUE (client_id, month);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mz_entries_month
  ON public.marketizers_monthly_entries(month);
CREATE INDEX IF NOT EXISTS idx_mz_entries_client_month
  ON public.marketizers_monthly_entries(client_id, month);
CREATE INDEX IF NOT EXISTS idx_mz_entries_month_isdeleted
  ON public.marketizers_monthly_entries(month, is_deleted);

CREATE INDEX IF NOT EXISTS idx_mz_clients_status_isdeleted
  ON public.marketizers_clients(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_mz_clients_name
  ON public.marketizers_clients(client_name);