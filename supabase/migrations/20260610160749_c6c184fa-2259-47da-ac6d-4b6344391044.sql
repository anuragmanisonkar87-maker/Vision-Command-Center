
CREATE TABLE public.marketizers_client_ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  ledger_month TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  entry_date DATE,
  name TEXT,
  category TEXT,
  amount_inclusive_gst NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_excluding_gst NUMERIC(14,2) NOT NULL DEFAULT 0,
  source TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcle_client_month ON public.marketizers_client_ledger_entries(client_id, ledger_month) WHERE is_deleted = false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_client_ledger_entries TO authenticated;
GRANT ALL ON public.marketizers_client_ledger_entries TO service_role;
ALTER TABLE public.marketizers_client_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view" ON public.marketizers_client_ledger_entries FOR SELECT TO authenticated USING (private.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "insert" ON public.marketizers_client_ledger_entries FOR INSERT TO authenticated WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "update" ON public.marketizers_client_ledger_entries FOR UPDATE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid())) WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "delete" ON public.marketizers_client_ledger_entries FOR DELETE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid()));
CREATE TRIGGER trg_mcle_updated_at BEFORE UPDATE ON public.marketizers_client_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.marketizers_client_profit_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  receiver_type TEXT NOT NULL CHECK (receiver_type IN ('Marketizers','Partner','Other')),
  split_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  is_marketizers_revenue BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcps_client ON public.marketizers_client_profit_splits(client_id) WHERE is_deleted = false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_client_profit_splits TO authenticated;
GRANT ALL ON public.marketizers_client_profit_splits TO service_role;
ALTER TABLE public.marketizers_client_profit_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view" ON public.marketizers_client_profit_splits FOR SELECT TO authenticated USING (private.can_view_marketizers_finance(auth.uid()));
CREATE POLICY "insert" ON public.marketizers_client_profit_splits FOR INSERT TO authenticated WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "update" ON public.marketizers_client_profit_splits FOR UPDATE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid())) WITH CHECK (private.can_edit_marketizers_finance(auth.uid()));
CREATE POLICY "delete" ON public.marketizers_client_profit_splits FOR DELETE TO authenticated USING (private.can_edit_marketizers_finance(auth.uid()));
CREATE TRIGGER trg_mcps_updated_at BEFORE UPDATE ON public.marketizers_client_profit_splits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
