
-- Add Task Doer (team-member based) and Assigned By auto-capture fields to delegation_tasks.
-- Keep backward compatibility with existing assignee_id (auth.users FK).

ALTER TABLE public.delegation_tasks
  ALTER COLUMN assignee_id DROP NOT NULL;

ALTER TABLE public.delegation_tasks
  ADD COLUMN IF NOT EXISTS assignee_team_member_id uuid REFERENCES public.gwv_team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS assignee_email text,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_name text,
  ADD COLUMN IF NOT EXISTS assigned_by_email text;

CREATE INDEX IF NOT EXISTS idx_dt_assignee_team_member
  ON public.delegation_tasks(assignee_team_member_id)
  WHERE is_deleted = false;

-- Expand SELECT policy so team members with a linked auth user can see their own tasks.
DROP POLICY IF EXISTS "dt_select" ON public.delegation_tasks;
CREATE POLICY "dt_select" ON public.delegation_tasks
  FOR SELECT TO authenticated
  USING (
    (assignee_id = auth.uid())
    OR (created_by = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR (assignee_team_member_id IS NOT NULL AND assignee_team_member_id IN (
          SELECT id FROM public.gwv_team_members WHERE linked_user_id = auth.uid()
        ))
  );

DROP POLICY IF EXISTS "dt_update" ON public.delegation_tasks;
CREATE POLICY "dt_update" ON public.delegation_tasks
  FOR UPDATE TO authenticated
  USING (
    (assignee_id = auth.uid())
    OR (created_by = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR (assignee_team_member_id IS NOT NULL AND assignee_team_member_id IN (
          SELECT id FROM public.gwv_team_members WHERE linked_user_id = auth.uid()
        ))
  );
