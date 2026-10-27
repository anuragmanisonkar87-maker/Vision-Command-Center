ALTER TABLE public.marketizers_client_ledger_entries
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;