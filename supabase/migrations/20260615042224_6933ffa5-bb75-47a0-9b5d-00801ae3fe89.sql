
CREATE TABLE public.qa_autopilot_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL CHECK (run_type IN ('scheduled','manual','post_deploy','system')),
  status text NOT NULL CHECK (status IN ('pass','partial','fail')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  run_by uuid,
  trigger_source text,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  cleanup_status text CHECK (cleanup_status IN ('clean','partial','dirty','unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.qa_autopilot_run_logs TO authenticated;
GRANT ALL ON public.qa_autopilot_run_logs TO service_role;

ALTER TABLE public.qa_autopilot_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qarl_select_admin"
  ON public.qa_autopilot_run_logs FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "qarl_insert_admin"
  ON public.qa_autopilot_run_logs FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX qa_autopilot_run_logs_started_at_idx
  ON public.qa_autopilot_run_logs (started_at DESC);
