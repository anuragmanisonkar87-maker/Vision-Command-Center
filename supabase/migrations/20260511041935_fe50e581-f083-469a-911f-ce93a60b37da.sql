
-- ============================================================
-- Vision Center foundation: dynamic brands, brand access,
-- shared expense allocation, user invites
-- ============================================================

-- 1. gwv_brands ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.gwv_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legacy_slug text,
  route_path text,
  color text NOT NULL DEFAULT '#C9973A',
  category text,
  description text,
  status text NOT NULL DEFAULT 'active',
  include_in_sidebar boolean NOT NULL DEFAULT true,
  include_in_expense_allocation boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT gwv_brands_status_check CHECK (status IN ('active','paused','archived'))
);

CREATE INDEX IF NOT EXISTS gwv_brands_active_idx
  ON public.gwv_brands (sort_order) WHERE is_deleted = false AND status = 'active';

ALTER TABLE public.gwv_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view brands" ON public.gwv_brands;
CREATE POLICY "view brands" ON public.gwv_brands FOR SELECT TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS "admin insert brands" ON public.gwv_brands;
CREATE POLICY "admin insert brands" ON public.gwv_brands FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin update brands" ON public.gwv_brands;
CREATE POLICY "admin update brands" ON public.gwv_brands FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin delete brands" ON public.gwv_brands;
CREATE POLICY "admin delete brands" ON public.gwv_brands FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_gwv_brands_updated_at ON public.gwv_brands;
CREATE TRIGGER trg_gwv_brands_updated_at BEFORE UPDATE ON public.gwv_brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (idempotent)
INSERT INTO public.gwv_brands (name, slug, legacy_slug, route_path, color, category, sort_order)
VALUES
  ('India Photographers Club','india-photographers-club','ipc','/brands/india-photographers-club','#C9973A','Photography education and community',1),
  ('Marketizers','marketizers','marketizers','/brands/marketizers','#6090E0','Performance marketing agency',2),
  ('The Mulberry Weddings','mulberry-weddings','mulberry','/brands/mulberry-weddings','#c4697e','Wedding photography and filmmaking',3),
  ('Influence OS','influence-os','influence-os','/brands/influence-os','#9B7FCA','Influence and creator marketing',4)
ON CONFLICT (slug) DO NOTHING;

-- 2. user_brand_access ---------------------------------------
CREATE TABLE IF NOT EXISTS public.user_brand_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.gwv_brands(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT user_brand_access_level_check CHECK (access_level IN ('viewer','editor','manager','finance','admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_brand_access_unique_active
  ON public.user_brand_access (user_id, brand_id) WHERE is_deleted = false;

ALTER TABLE public.user_brand_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own access" ON public.user_brand_access;
CREATE POLICY "users view own access" ON public.user_brand_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin manage access" ON public.user_brand_access;
CREATE POLICY "admin manage access" ON public.user_brand_access FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_user_brand_access_updated_at ON public.user_brand_access;
CREATE TRIGGER trg_user_brand_access_updated_at BEFORE UPDATE ON public.user_brand_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. gwv_shared_expense_allocations --------------------------
CREATE TABLE IF NOT EXISTS public.gwv_shared_expense_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.gwv_brands(id),
  allocation_percentage numeric NOT NULL DEFAULT 0,
  allocated_amount_in_inr numeric NOT NULL DEFAULT 0,
  month text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS gwv_alloc_source_idx
  ON public.gwv_shared_expense_allocations (source_type, source_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS gwv_alloc_brand_month_idx
  ON public.gwv_shared_expense_allocations (brand_id, month) WHERE is_deleted = false;

ALTER TABLE public.gwv_shared_expense_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view allocations" ON public.gwv_shared_expense_allocations;
CREATE POLICY "view allocations" ON public.gwv_shared_expense_allocations FOR SELECT TO authenticated
  USING (private.can_view_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "edit allocations" ON public.gwv_shared_expense_allocations;
CREATE POLICY "edit allocations" ON public.gwv_shared_expense_allocations FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "update allocations" ON public.gwv_shared_expense_allocations;
CREATE POLICY "update allocations" ON public.gwv_shared_expense_allocations FOR UPDATE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));

DROP POLICY IF EXISTS "delete allocations" ON public.gwv_shared_expense_allocations;
CREATE POLICY "delete allocations" ON public.gwv_shared_expense_allocations FOR DELETE TO authenticated
  USING (private.can_edit_marketizers_finance(auth.uid()));

DROP TRIGGER IF EXISTS trg_gwv_alloc_updated_at ON public.gwv_shared_expense_allocations;
CREATE TRIGGER trg_gwv_alloc_updated_at BEFORE UPDATE ON public.gwv_shared_expense_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. user_invites --------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  roles text[] NOT NULL DEFAULT '{}',
  brand_ids uuid[],
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  notes text,
  CONSTRAINT user_invites_status_check CHECK (status IN ('pending','accepted','cancelled','expired'))
);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage invites" ON public.user_invites;
CREATE POLICY "admin manage invites" ON public.user_invites FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 5. Add is_shared_expense flags -----------------------------
ALTER TABLE public.marketizers_expense_templates
  ADD COLUMN IF NOT EXISTS is_shared_expense boolean NOT NULL DEFAULT false;

ALTER TABLE public.marketizers_expense_entries
  ADD COLUMN IF NOT EXISTS is_shared_expense boolean NOT NULL DEFAULT false;
