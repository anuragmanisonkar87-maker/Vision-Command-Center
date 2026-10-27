
CREATE TABLE public.delegation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid,
  department text,
  category text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  status text NOT NULL DEFAULT 'Planned',
  system_stage text NOT NULL DEFAULT 'planned' CHECK (system_stage IN ('planned','in_progress','submitted','completed','revision','blocked','shifted','cancelled')),
  due_date date,
  due_date_locked boolean NOT NULL DEFAULT true,
  completed_at timestamptz,
  proof_url text,
  proof_note text,
  proof_required boolean NOT NULL DEFAULT false,
  revision_count int NOT NULL DEFAULT 0,
  delay_reason text,
  blocked_reason text,
  waiting_on_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegation_tasks TO authenticated;
GRANT ALL ON public.delegation_tasks TO service_role;
ALTER TABLE public.delegation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dt_select" ON public.delegation_tasks FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "dt_insert" ON public.delegation_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "dt_update" ON public.delegation_tasks FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (assignee_id = auth.uid() OR created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "dt_delete" ON public.delegation_tasks FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER delegation_tasks_updated
  BEFORE UPDATE ON public.delegation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dt_assignee ON public.delegation_tasks(assignee_id) WHERE is_deleted = false;
CREATE INDEX idx_dt_created_by ON public.delegation_tasks(created_by) WHERE is_deleted = false;
CREATE INDEX idx_dt_stage ON public.delegation_tasks(system_stage) WHERE is_deleted = false;

CREATE TABLE public.delegation_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.delegation_tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.delegation_activity TO authenticated;
GRANT ALL ON public.delegation_activity TO service_role;
ALTER TABLE public.delegation_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "da_select" ON public.delegation_activity FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.delegation_tasks t WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid()))
  );
CREATE POLICY "da_insert" ON public.delegation_activity FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid() AND (
      private.has_role(auth.uid(), 'admin'::public.app_role) OR
      EXISTS (SELECT 1 FROM public.delegation_tasks t WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid()))
    )
  );

CREATE INDEX idx_da_task ON public.delegation_activity(task_id);

CREATE TABLE public.delegation_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.delegation_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL,
  reason text NOT NULL,
  period_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, reason)
);

GRANT SELECT, INSERT ON public.delegation_points_ledger TO authenticated;
GRANT ALL ON public.delegation_points_ledger TO service_role;
ALTER TABLE public.delegation_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpl_select" ON public.delegation_points_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpl_insert" ON public.delegation_points_ledger FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.delegation_tasks t WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid()))
  );

CREATE INDEX idx_dpl_user ON public.delegation_points_ledger(user_id);
CREATE INDEX idx_dpl_period ON public.delegation_points_ledger(period_date);

CREATE TABLE public.delegation_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.delegation_settings TO authenticated;
GRANT ALL ON public.delegation_settings TO service_role;
ALTER TABLE public.delegation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ds_select" ON public.delegation_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ds_write" ON public.delegation_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.delegation_settings (id, settings) VALUES (1, jsonb_build_object(
  'statuses', jsonb_build_array(
    jsonb_build_object('label','Planned','stage','planned'),
    jsonb_build_object('label','In Progress','stage','in_progress'),
    jsonb_build_object('label','Submitted','stage','submitted'),
    jsonb_build_object('label','Completed','stage','completed'),
    jsonb_build_object('label','Revision Required','stage','revision'),
    jsonb_build_object('label','Blocked','stage','blocked'),
    jsonb_build_object('label','Shifted','stage','shifted'),
    jsonb_build_object('label','Cancelled','stage','cancelled')
  ),
  'categories', jsonb_build_array('Operations','Marketing','Finance','HR','Tech','Client','Other'),
  'delay_reasons', jsonb_build_array('Client delay','Waiting for input','Dependency blocked','Admin priority change','Personal delay','Other'),
  'scoring_rules', jsonb_build_object(
    'on_time_low', 3,
    'on_time_medium', 5,
    'on_time_high', 8,
    'on_time_critical', 12,
    'zero_revision_bonus', 3,
    'late_penalty', -3,
    'revision_penalty', -2,
    'shifted_penalty', -5
  ),
  'badge_rules', jsonb_build_object(
    'on_time_machine_min', 10,
    'zero_revision_min', 8,
    'deadline_warrior_min_critical', 3,
    'most_consistent_min_days', 5
  )
)) ON CONFLICT DO NOTHING;
