
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  note text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_name text,
  assigned_initials text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  tag text NOT NULL DEFAULT 'Operations',
  due_date date,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tasks_assigned_to_idx ON public.tasks(assigned_to);
CREATE INDEX tasks_status_idx ON public.tasks(status) WHERE is_archived = false;

CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_activity TO authenticated;
GRANT ALL ON public.task_activity TO service_role;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_activity_select" ON public.task_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_activity.task_id
    AND (private.has_role(auth.uid(), 'admin'::app_role) OR t.assigned_to = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "task_activity_insert" ON public.task_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_activity.task_id
    AND (private.has_role(auth.uid(), 'admin'::app_role) OR t.assigned_to = auth.uid() OR t.created_by = auth.uid())));

CREATE INDEX task_activity_task_id_idx ON public.task_activity(task_id);

CREATE TABLE public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_name text,
  submission_url text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_submissions TO authenticated;
GRANT ALL ON public.task_submissions TO service_role;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_submissions_select" ON public.task_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_submissions.task_id
    AND (private.has_role(auth.uid(), 'admin'::app_role) OR t.assigned_to = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "task_submissions_insert" ON public.task_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_submissions.task_id
    AND (private.has_role(auth.uid(), 'admin'::app_role) OR t.assigned_to = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "task_submissions_update" ON public.task_submissions FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (submitted_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "task_submissions_delete" ON public.task_submissions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER task_submissions_updated_at BEFORE UPDATE ON public.task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX task_submissions_task_id_idx ON public.task_submissions(task_id);
