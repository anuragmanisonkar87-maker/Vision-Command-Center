
CREATE TABLE IF NOT EXISTS public.marketizers_roas_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  client_id uuid NULL,
  event_type text NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.marketizers_roas_import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roas_map_view"
  ON public.marketizers_roas_import_mappings
  FOR SELECT TO authenticated
  USING (is_deleted = false AND public.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "roas_map_insert"
  ON public.marketizers_roas_import_mappings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "roas_map_update"
  ON public.marketizers_roas_import_mappings
  FOR UPDATE TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "roas_map_delete"
  ON public.marketizers_roas_import_mappings
  FOR DELETE TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()));

CREATE TRIGGER trg_roas_map_updated_at
  BEFORE UPDATE ON public.marketizers_roas_import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
