
CREATE TABLE public.recurring_daily_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recurring_daily_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team_member_id uuid,
  email_to text NOT NULL,
  email_subject text NOT NULL,
  email_body text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('missed_task_reminder')),
  email_status text NOT NULL CHECK (email_status IN ('draft','sent','failed')),
  points_date date NOT NULL,
  sent_at timestamptz,
  sent_by uuid,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rdel_sent_unique ON public.recurring_daily_email_logs
  (template_id, user_id, points_date, email_type)
  WHERE email_status = 'sent';

CREATE INDEX rdel_user_date_idx ON public.recurring_daily_email_logs (user_id, points_date DESC);

GRANT SELECT, INSERT ON public.recurring_daily_email_logs TO authenticated;
GRANT ALL ON public.recurring_daily_email_logs TO service_role;

ALTER TABLE public.recurring_daily_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rdel_select ON public.recurring_daily_email_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY rdel_insert ON public.recurring_daily_email_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
