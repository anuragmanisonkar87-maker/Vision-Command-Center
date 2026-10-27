
ALTER TABLE public.vc_google_sheet_connections
  DROP CONSTRAINT IF EXISTS vc_google_sheet_connections_google_connection_id_fkey;
ALTER TABLE public.vc_google_sheet_connections
  DROP COLUMN IF EXISTS google_connection_id;
DROP INDEX IF EXISTS public.idx_vc_gs_sheet_connections_google;

ALTER TABLE public.vc_google_sheet_sync_runs
  DROP CONSTRAINT IF EXISTS vc_google_sheet_sync_runs_sheet_connection_id_fkey;
ALTER TABLE public.vc_google_sheet_sync_runs
  RENAME COLUMN sheet_connection_id TO connection_id;
ALTER TABLE public.vc_google_sheet_sync_runs
  ADD CONSTRAINT vc_google_sheet_sync_runs_connection_id_fkey
    FOREIGN KEY (connection_id) REFERENCES public.vc_google_sheet_connections(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS public.idx_vc_gs_sync_runs_connection;
CREATE INDEX idx_vc_gs_sync_runs_connection
  ON public.vc_google_sheet_sync_runs(connection_id, started_at DESC);

DROP TABLE IF EXISTS public.vc_google_oauth_connections CASCADE;
