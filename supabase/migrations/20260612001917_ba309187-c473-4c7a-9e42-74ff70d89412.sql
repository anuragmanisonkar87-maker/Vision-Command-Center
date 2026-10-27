
-- OAuth connections (one per admin who linked Google)
CREATE TABLE public.vc_google_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  google_email text,
  access_token text,
  refresh_token text,
  scopes text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, google_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vc_google_oauth_connections TO authenticated;
GRANT ALL ON public.vc_google_oauth_connections TO service_role;

ALTER TABLE public.vc_google_oauth_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage google oauth connections"
ON public.vc_google_oauth_connections
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vc_google_oauth_connections_updated
BEFORE UPDATE ON public.vc_google_oauth_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saved sheet connections
CREATE TABLE public.vc_google_sheet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_connection_id uuid NOT NULL REFERENCES public.vc_google_oauth_connections(id) ON DELETE CASCADE,
  connection_name text NOT NULL,
  spreadsheet_id text NOT NULL,
  sheet_url text NOT NULL,
  sheet_name text,
  date_column text,
  destination_module text,
  status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vc_google_sheet_connections TO authenticated;
GRANT ALL ON public.vc_google_sheet_connections TO service_role;

ALTER TABLE public.vc_google_sheet_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage google sheet connections"
ON public.vc_google_sheet_connections
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vc_google_sheet_connections_updated
BEFORE UPDATE ON public.vc_google_sheet_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync run history
CREATE TABLE public.vc_google_sheet_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_connection_id uuid NOT NULL REFERENCES public.vc_google_sheet_connections(id) ON DELETE CASCADE,
  synced_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  row_count integer,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vc_google_sheet_sync_runs TO authenticated;
GRANT ALL ON public.vc_google_sheet_sync_runs TO service_role;

ALTER TABLE public.vc_google_sheet_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage google sheet sync runs"
ON public.vc_google_sheet_sync_runs
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_vc_gs_sync_runs_connection ON public.vc_google_sheet_sync_runs(sheet_connection_id, started_at DESC);
CREATE INDEX idx_vc_gs_sheet_connections_google ON public.vc_google_sheet_connections(google_connection_id);
CREATE INDEX idx_vc_google_oauth_connections_user ON public.vc_google_oauth_connections(user_id);
