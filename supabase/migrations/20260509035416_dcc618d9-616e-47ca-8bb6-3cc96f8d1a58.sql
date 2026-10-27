-- Marketizers Phase 1 tables

CREATE TABLE public.marketizers_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  founder_name text,
  niche text,
  revenue_model text NOT NULL,
  start_date date,
  status text NOT NULL DEFAULT 'active',
  assigned_manager text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT marketizers_clients_revenue_model_chk CHECK (revenue_model IN ('Fixed Retainer','Revenue Share','Hybrid','One-Time Setup','Performance Bonus','Other')),
  CONSTRAINT marketizers_clients_status_chk CHECK (status IN ('active','paused','closed','trial'))
);

CREATE UNIQUE INDEX marketizers_clients_unique_name_active
  ON public.marketizers_clients (lower(client_name)) WHERE is_deleted = false;

CREATE TABLE public.marketizers_monthly_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  month text NOT NULL,
  revenue_model text,
  account_status text DEFAULT 'active',
  marketizers_revenue numeric NOT NULL DEFAULT 0,
  amount_collected numeric NOT NULL DEFAULT 0,
  amount_pending numeric NOT NULL DEFAULT 0,
  client_gross_revenue numeric NOT NULL DEFAULT 0,
  ad_spend numeric NOT NULL DEFAULT 0,
  leads_generated integer NOT NULL DEFAULT 0,
  qualified_leads integer NOT NULL DEFAULT 0,
  sales_closed integer NOT NULL DEFAULT 0,
  total_direct_expense numeric NOT NULL DEFAULT 0,
  notes text,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT marketizers_monthly_entries_month_fmt CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX marketizers_monthly_entries_unique
  ON public.marketizers_monthly_entries (client_id, month) WHERE is_deleted = false;

CREATE TABLE public.marketizers_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE,
  revenue_target numeric NOT NULL DEFAULT 0,
  profit_target numeric NOT NULL DEFAULT 0,
  collection_target numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketizers_targets_month_fmt CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_mc_updated BEFORE UPDATE ON public.marketizers_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mme_updated BEFORE UPDATE ON public.marketizers_monthly_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mt_updated BEFORE UPDATE ON public.marketizers_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.marketizers_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_monthly_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketizers_targets ENABLE ROW LEVEL SECURITY;

-- TODO Phase 2: replace with role-based policies via has_role() once gwv_users / user_roles table exists.
-- For Phase 1, allow signed-in users full access; UI layer (MarketizersAccessGuard) restricts by role.
CREATE POLICY "phase1_authenticated_all_clients" ON public.marketizers_clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "phase1_authenticated_all_entries" ON public.marketizers_monthly_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "phase1_authenticated_all_targets" ON public.marketizers_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 1 scaffold also allows anon read/write because login is not yet wired.
-- TODO Phase 2: remove anon policies once auth is enforced.
CREATE POLICY "phase1_anon_all_clients" ON public.marketizers_clients
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "phase1_anon_all_entries" ON public.marketizers_monthly_entries
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "phase1_anon_all_targets" ON public.marketizers_targets
  FOR ALL TO anon USING (true) WITH CHECK (true);