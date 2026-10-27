ALTER TABLE public.marketizers_clients
  ADD COLUMN IF NOT EXISTS delete_reason text;