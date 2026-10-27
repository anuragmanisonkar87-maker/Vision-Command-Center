
DO $$ BEGIN
  CREATE TYPE public.delegation_task_type AS ENUM ('recurring_daily','standup','ad_hoc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.delegation_tasks
  ADD COLUMN IF NOT EXISTS task_type public.delegation_task_type NOT NULL DEFAULT 'standup';

CREATE TABLE IF NOT EXISTS public.recurring_daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  task_doer_team_member_id uuid REFERENCES public.gwv_team_members(id) ON DELETE SET NULL,
  task_doer_user_id uuid,
  task_doer_name text NOT NULL,
  task_doer_email text,
  due_time time,
  points_on_completion int NOT NULL DEFAULT 2,
  negative_points_if_missed int NOT NULL DEFAULT -2,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_daily_tasks TO authenticated;
GRANT ALL ON public.recurring_daily_tasks TO service_role;
ALTER TABLE public.recurring_daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdt_admin_all" ON public.recurring_daily_tasks;
CREATE POLICY "rdt_admin_all" ON public.recurring_daily_tasks
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "rdt_employee_select_own" ON public.recurring_daily_tasks;
CREATE POLICY "rdt_employee_select_own" ON public.recurring_daily_tasks
  FOR SELECT TO authenticated
  USING (
    task_doer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gwv_team_members tm
      WHERE tm.id = recurring_daily_tasks.task_doer_team_member_id
        AND tm.linked_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS recurring_daily_tasks_updated_at ON public.recurring_daily_tasks;
CREATE TRIGGER recurring_daily_tasks_updated_at
  BEFORE UPDATE ON public.recurring_daily_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.recurring_daily_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recurring_daily_tasks(id) ON DELETE CASCADE,
  completion_date date NOT NULL,
  completed_by_user_id uuid,
  completed_by_team_member_id uuid REFERENCES public.gwv_team_members(id) ON DELETE SET NULL,
  completed_by_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  proof_url text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, completion_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_daily_completions TO authenticated;
GRANT ALL ON public.recurring_daily_completions TO service_role;
ALTER TABLE public.recurring_daily_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdc_admin_all" ON public.recurring_daily_completions;
CREATE POLICY "rdc_admin_all" ON public.recurring_daily_completions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "rdc_employee_select_own" ON public.recurring_daily_completions;
CREATE POLICY "rdc_employee_select_own" ON public.recurring_daily_completions
  FOR SELECT TO authenticated
  USING (
    completed_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recurring_daily_tasks t
      WHERE t.id = recurring_daily_completions.template_id
        AND (
          t.task_doer_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.gwv_team_members tm
            WHERE tm.id = t.task_doer_team_member_id AND tm.linked_user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "rdc_employee_insert_own" ON public.recurring_daily_completions;
CREATE POLICY "rdc_employee_insert_own" ON public.recurring_daily_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    completed_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.recurring_daily_tasks t
      WHERE t.id = template_id
        AND t.active = true
        AND (
          t.task_doer_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.gwv_team_members tm
            WHERE tm.id = t.task_doer_team_member_id AND tm.linked_user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "rdc_employee_update_own" ON public.recurring_daily_completions;
CREATE POLICY "rdc_employee_update_own" ON public.recurring_daily_completions
  FOR UPDATE TO authenticated
  USING (completed_by_user_id = auth.uid())
  WITH CHECK (completed_by_user_id = auth.uid());

DROP TRIGGER IF EXISTS recurring_daily_completions_updated_at ON public.recurring_daily_completions;
CREATE TRIGGER recurring_daily_completions_updated_at
  BEFORE UPDATE ON public.recurring_daily_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS rdt_active_idx ON public.recurring_daily_tasks (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS rdc_template_date_idx ON public.recurring_daily_completions (template_id, completion_date);
