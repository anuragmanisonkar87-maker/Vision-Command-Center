
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'not_invited',
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  target_user_id uuid,
  target_email text NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_access_audit_log TO authenticated;
GRANT ALL ON public.user_access_audit_log TO service_role;

ALTER TABLE public.user_access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read user access audit" ON public.user_access_audit_log;
CREATE POLICY "Admins read user access audit"
ON public.user_access_audit_log FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS user_access_audit_log_created_at_idx
  ON public.user_access_audit_log (created_at DESC);
