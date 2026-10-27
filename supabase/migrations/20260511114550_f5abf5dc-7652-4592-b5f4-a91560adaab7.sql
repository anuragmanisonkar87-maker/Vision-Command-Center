-- Audit log for Team Access Control (Phase 5)
CREATE TABLE public.gwv_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_label text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  target_team_member_id uuid,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_gwv_audit_created_at ON public.gwv_access_audit_log (created_at DESC);
CREATE INDEX idx_gwv_audit_entity ON public.gwv_access_audit_log (entity_type, entity_id);
CREATE INDEX idx_gwv_audit_target ON public.gwv_access_audit_log (target_team_member_id);

ALTER TABLE public.gwv_access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_admin_read
  ON public.gwv_access_audit_log
  FOR SELECT TO authenticated
  USING (private.can_manage_team_access(auth.uid()));

CREATE POLICY audit_insert_authed
  ON public.gwv_access_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);
