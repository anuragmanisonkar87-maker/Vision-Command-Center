-- Import batch tracking for client ledger imports
CREATE TABLE public.marketizers_client_ledger_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  ledger_month text NOT NULL,
  import_type text NOT NULL CHECK (import_type IN ('income','expense','mixed')),
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  income_total_excl_gst numeric NOT NULL DEFAULT 0,
  expense_total_excl_gst numeric NOT NULL DEFAULT 0,
  source_name text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_undone boolean NOT NULL DEFAULT false,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_client_ledger_import_batches TO authenticated;
GRANT ALL ON public.marketizers_client_ledger_import_batches TO service_role;

ALTER TABLE public.marketizers_client_ledger_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read import batches"
  ON public.marketizers_client_ledger_import_batches FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth insert import batches"
  ON public.marketizers_client_ledger_import_batches FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth update import batches"
  ON public.marketizers_client_ledger_import_batches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_ledger_import_batches_client_month
  ON public.marketizers_client_ledger_import_batches(client_id, ledger_month, created_at DESC);

-- Link ledger entries to batches
ALTER TABLE public.marketizers_client_ledger_entries
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.marketizers_client_ledger_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_source text;

CREATE INDEX IF NOT EXISTS idx_ledger_entries_import_batch
  ON public.marketizers_client_ledger_entries(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

-- Saved mapping templates (per-user; client_id null = global to that user)
CREATE TABLE public.marketizers_ledger_import_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  headers jsonb NOT NULL,
  mapping jsonb NOT NULL,
  default_row_type text NOT NULL DEFAULT 'income',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketizers_ledger_import_mapping_templates TO authenticated;
GRANT ALL ON public.marketizers_ledger_import_mapping_templates TO service_role;

ALTER TABLE public.marketizers_ledger_import_mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read mapping templates"
  ON public.marketizers_ledger_import_mapping_templates FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "owner insert mapping templates"
  ON public.marketizers_ledger_import_mapping_templates FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "owner update mapping templates"
  ON public.marketizers_ledger_import_mapping_templates FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner delete mapping templates"
  ON public.marketizers_ledger_import_mapping_templates FOR DELETE
  TO authenticated USING (user_id = auth.uid());
