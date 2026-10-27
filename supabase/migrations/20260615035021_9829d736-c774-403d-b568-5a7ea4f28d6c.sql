CREATE TABLE IF NOT EXISTS public.discipline_automation_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL CHECK (run_type IN ('manual','scheduled')),
  status text NOT NULL CHECK (status IN ('pass','partial','fail')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scanned_count int NOT NULL DEFAULT 0,
  penalties_applied int NOT NULL DEFAULT 0,
  penalties_skipped int NOT NULL DEFAULT 0,
  drafts_created int NOT NULL DEFAULT 0,
  drafts_skipped int NOT NULL DEFAULT 0,
  emails_sent int NOT NULL DEFAULT 0,
  emails_failed int NOT NULL DEFAULT 0,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS darl_started_idx
  ON public.discipline_automation_run_logs(started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.discipline_automation_run_logs TO authenticated;
GRANT ALL ON public.discipline_automation_run_logs TO service_role;

ALTER TABLE public.discipline_automation_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "darl_select_admin" ON public.discipline_automation_run_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "darl_insert_admin" ON public.discipline_automation_run_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "darl_update_admin" ON public.discipline_automation_run_logs
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));