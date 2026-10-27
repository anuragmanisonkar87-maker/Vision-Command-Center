
DROP POLICY IF EXISTS dt_insert ON public.delegation_tasks;
CREATE POLICY dt_insert ON public.delegation_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR public.dt_assignee_is_self(assignee_id, assignee_team_member_id)
    )
  );

DROP POLICY IF EXISTS dt_update ON public.delegation_tasks;
CREATE POLICY dt_update ON public.delegation_tasks
  FOR UPDATE
  TO authenticated
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
