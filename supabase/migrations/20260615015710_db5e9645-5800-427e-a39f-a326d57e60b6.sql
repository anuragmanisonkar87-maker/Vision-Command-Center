ALTER TABLE public.task_missed_email_logs
  ADD COLUMN IF NOT EXISTS provider text;

DROP POLICY IF EXISTS "tmel_update_admin" ON public.task_missed_email_logs;
CREATE POLICY "tmel_update_admin"
  ON public.task_missed_email_logs
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));