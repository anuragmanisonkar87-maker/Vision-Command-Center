
-- Points ledger for missed stand-up / ad hoc tasks
CREATE TABLE IF NOT EXISTS public.task_missed_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.delegation_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid,
  points integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('standup_task_missed','ad_hoc_task_missed')),
  reason text,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tmpl_task_event_uniq
  ON public.task_missed_points_ledger(task_id, event_type);
CREATE INDEX IF NOT EXISTS tmpl_user_date_idx
  ON public.task_missed_points_ledger(user_id, period_date DESC);

GRANT SELECT, INSERT ON public.task_missed_points_ledger TO authenticated;
GRANT ALL ON public.task_missed_points_ledger TO service_role;

ALTER TABLE public.task_missed_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmpl_select" ON public.task_missed_points_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "tmpl_insert" ON public.task_missed_points_ledger
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- Email-draft log for missed stand-up / ad hoc tasks
CREATE TABLE IF NOT EXISTS public.task_missed_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.delegation_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid,
  email_to text NOT NULL,
  email_subject text NOT NULL,
  email_body text NOT NULL,
  email_type text NOT NULL CHECK (email_type = 'missed_task_alert'),
  email_status text NOT NULL CHECK (email_status IN ('draft','sent','failed')),
  sent_at timestamptz,
  sent_by uuid,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tmel_sent_unique
  ON public.task_missed_email_logs(task_id, email_type)
  WHERE email_status = 'sent';
CREATE INDEX IF NOT EXISTS tmel_user_idx
  ON public.task_missed_email_logs(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.task_missed_email_logs TO authenticated;
GRANT ALL ON public.task_missed_email_logs TO service_role;

ALTER TABLE public.task_missed_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmel_select" ON public.task_missed_email_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "tmel_insert" ON public.task_missed_email_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
