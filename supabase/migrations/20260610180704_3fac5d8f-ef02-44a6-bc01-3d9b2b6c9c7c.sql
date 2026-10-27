ALTER TABLE public.marketizers_monthly_entries
  ADD COLUMN IF NOT EXISTS ledger_source text,
  ADD COLUMN IF NOT EXISTS ledger_pushed_amount numeric,
  ADD COLUMN IF NOT EXISTS ledger_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ledger_pushed_by uuid;