
-- Helper: true when the assignee on a delegation_tasks row points to the
-- calling auth user, either via assignee_id or via assignee_team_member_id
-- linked to gwv_team_members.linked_user_id.
CREATE OR REPLACE FUNCTION public.dt_assignee_is_self(
  _assignee_id uuid,
  _assignee_team_member_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _assignee_id IS NULL AND _assignee_team_member_id IS NULL
    OR _assignee_id = auth.uid()
    OR (
      _assignee_team_member_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gwv_team_members tm
        WHERE tm.id = _assignee_team_member_id
          AND tm.linked_user_id = auth.uid()
      )
    )
$$;

-- INSERT: enforce that non-admins can only create tasks where the Task Doer
-- is themselves (or unassigned). Admins are unrestricted.
DROP POLICY IF EXISTS dt_insert ON public.delegation_tasks;
CREATE POLICY dt_insert ON public.delegation_tasks
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR public.dt_assignee_is_self(assignee_id, assignee_team_member_id)
    )
  );

-- UPDATE: keep existing visibility rule, and ensure that on update a non-admin
-- cannot reassign the task to a different person.
DROP POLICY IF EXISTS dt_update ON public.delegation_tasks;
CREATE POLICY dt_update ON public.delegation_tasks
  FOR UPDATE
  USING (
    assignee_id = auth.uid()
    OR created_by = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR (
      assignee_team_member_id IS NOT NULL
      AND assignee_team_member_id IN (
        SELECT id FROM public.gwv_team_members WHERE linked_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR public.dt_assignee_is_self(assignee_id, assignee_team_member_id)
  );
